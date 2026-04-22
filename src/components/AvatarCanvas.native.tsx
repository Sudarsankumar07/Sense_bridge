import React, { useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

interface AvatarCanvasProps {
    onReady: (mixer: THREE.AnimationMixer) => void;
    onError?: (message: string) => void;
    onBonesDetected?: (bones: string[], reportPath: string) => void;
}

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({ onReady, onError, onBonesDetected }) => {
    const mixerRef   = useRef<THREE.AnimationMixer | null>(null);
    const clockRef   = useRef(new THREE.Clock());

    // ── Orbit camera state (updated by PanResponder, read every frame) ────
    const orbitTheta  = useRef(0);              // horizontal angle (0 = front)
    const orbitPhi    = useRef(Math.PI / 2);   // vertical angle   (PI/2 = level)
    const orbitRadius = useRef(1.7);            // distance from target
    const orbitTarget = useRef(new THREE.Vector3(0, 1.0, 0)); // look-at point

    // Touch tracking refs
    const prevTouch1  = useRef<{ x: number; y: number } | null>(null);
    const prevPinch   = useRef<number | null>(null);

    // ── Build PanResponder ─────────────────────────────────────────────────
    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // Let the gesture system know we want control
        onMoveShouldSetPanResponder: (_, g) =>
            Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
        // Prevent the parent ScrollView from stealing the gesture
        onMoveShouldSetPanResponderCapture: (_, g) =>
            Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,

        onPanResponderGrant: (e) => {
            const touches = e.nativeEvent.touches;
            if (touches.length >= 2) {
                const dx = touches[0].pageX - touches[1].pageX;
                const dy = touches[0].pageY - touches[1].pageY;
                prevPinch.current  = Math.sqrt(dx * dx + dy * dy);
                prevTouch1.current = null;
            } else {
                prevTouch1.current = { x: touches[0].pageX, y: touches[0].pageY };
                prevPinch.current  = null;
            }
        },

        onPanResponderMove: (e) => {
            const touches = e.nativeEvent.touches;

            if (touches.length >= 2) {
                // ── Pinch to zoom ──────────────────────────────────────────
                const dx   = touches[0].pageX - touches[1].pageX;
                const dy   = touches[0].pageY - touches[1].pageY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (prevPinch.current !== null) {
                    const delta = prevPinch.current - dist;   // + = pinch in = zoom out
                    orbitRadius.current = Math.max(0.6, Math.min(6.0,
                        orbitRadius.current + delta * 0.006
                    ));
                }
                prevPinch.current  = dist;
                prevTouch1.current = null;

            } else if (touches.length === 1 && prevTouch1.current) {
                // ── Single finger drag to orbit ────────────────────────────
                const dx = touches[0].pageX - prevTouch1.current.x;
                const dy = touches[0].pageY - prevTouch1.current.y;

                orbitTheta.current -= dx * 0.009;   // left/right → rotate Y
                orbitPhi.current    = Math.max(
                    0.08,
                    Math.min(Math.PI - 0.08,
                        orbitPhi.current - dy * 0.009  // up/down → elevate
                    )
                );

                prevTouch1.current = { x: touches[0].pageX, y: touches[0].pageY };
                prevPinch.current  = null;
            }
        },

        onPanResponderRelease: () => {
            prevTouch1.current = null;
            prevPinch.current  = null;
        },
        onPanResponderTerminate: () => {
            prevTouch1.current = null;
            prevPinch.current  = null;
        },
    }), []);

    const onContextCreate = async (gl: any) => {
        // ── Suppress noisy EXGL warnings about unsupported pixelStorei params ──
        const _origLog = console.log;
        console.log = (...args: any[]) => {
            const msg = typeof args[0] === 'string' ? args[0] : '';
            if (msg.includes('EXGL:') || msg.includes('pixelStorei')) return;
            _origLog(...args);
        };

        const renderer = new Renderer({ gl });
        renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
        renderer.setClearColor(0x0b1021);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            42,   // narrower FOV = more zoom on the upper body
            gl.drawingBufferWidth / gl.drawingBufferHeight,
            0.01,
            1000
        );
        // Initial position — frameModel() will override this after loading
        camera.position.set(0, 1.45, 1.8);
        camera.lookAt(0, 1.2, 0);

        const ambient = new THREE.AmbientLight(0xffffff, 0.65);
        const key = new THREE.DirectionalLight(0xffffff, 1.0);
        key.position.set(1.2, 2.4, 2.0);
        const fill = new THREE.DirectionalLight(0xa5b4fc, 0.45);
        fill.position.set(-1.6, 1.0, 0.6);
        scene.add(ambient, key, fill);

        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(1.2, 48),
            new THREE.MeshStandardMaterial({ color: 0x1f2937 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.02;
        scene.add(floor);

        const frameModel = (root: THREE.Object3D) => {
            const box = new THREE.Box3().setFromObject(root);
            if (box.isEmpty()) {
                console.warn('[AvatarCanvas] Bounding box is empty — model may have no geometry');
                return;
            }

            const size = new THREE.Vector3();
            box.getSize(size);
            const center = new THREE.Vector3();
            box.getCenter(center);

            console.log('[AvatarCanvas] Model raw size:', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));
            console.log('[AvatarCanvas] Model center:', center.x.toFixed(2), center.y.toFixed(2), center.z.toFixed(2));

            // ── AUTO-SCALE ──────────────────────────────────────────────────
            // FBX→GLB exports from Mixamo are often in centimeters (170 units
            // tall) instead of meters (1.7 units). Scale so the model is
            // always ~1.8 units (meters) tall regardless of source unit.
            const TARGET_HEIGHT = 1.8;
            const scale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
            root.scale.set(scale, scale, scale);
            console.log('[AvatarCanvas] Applied scale:', scale.toFixed(4));

            // Re-compute bounding box after scaling
            const scaledBox = new THREE.Box3().setFromObject(root);
            const scaledSize = new THREE.Vector3();
            scaledBox.getSize(scaledSize);
            const scaledCenter = new THREE.Vector3();
            scaledBox.getCenter(scaledCenter);

            // Center horizontally, place feet at y=0
            root.position.x -= scaledCenter.x;
            root.position.z -= scaledCenter.z;
            root.position.y -= scaledBox.min.y;

            // ── CAMERA — Zoomed on upper body ────────────────────────────────
            // We want to frame the avatar from roughly waist to top of head,
            // making arm/hand signs clearly visible.
            // eyeHeight targets ~65% up the model (mid-chest / shoulder area).
            // camDist is kept shorter (1.7) combined with narrow FOV (42°)
            // to fill the canvas with just the signing zone.
            const eyeHeight = scaledSize.y * 0.65;  // shoulder / upper-chest
            const camDist = 1.7;                   // closer than before
            camera.fov = 42;                          // narrow FOV for zoom
            camera.near = 0.01;
            camera.far  = 1000;
            camera.updateProjectionMatrix();

            // ── Seed orbit state from computed camera position ────────────────
            //  target  = the look-at point (mid-chest)
            //  radius  = distance from target to camera
            //  phi     = vertical angle from world-up
            //  theta   = horizontal angle (0 = front)
            const lookAtY = eyeHeight * 0.82;
            orbitTarget.current.set(0, lookAtY, 0);
            const offsetY = eyeHeight - lookAtY;     // camera above target
            orbitRadius.current = Math.sqrt(offsetY * offsetY + camDist * camDist);
            orbitPhi.current    = Math.acos(
                Math.max(-1, Math.min(1, offsetY / orbitRadius.current))
            );
            orbitTheta.current  = 0;   // facing front
            console.log('[AvatarCanvas] Orbit seeded — r:', orbitRadius.current.toFixed(2),
                'phi:', orbitPhi.current.toFixed(2));
        };

        try {
            console.log('[AvatarCanvas] Loading GLB asset...');
            const asset = Asset.fromModule(require('../../assets/models/avatar.glb'));

            // ── Resilient asset URI resolution ────────────────────────────────
            // downloadAsync() can fail on dev-client builds when expo-asset and
            // expo-modules-core versions are mismatched (NoSuchMethodError on
            // getFilePermission). We therefore try it first, and if it throws,
            // fall back to asset.uri which Metro/EAS already serves over HTTP.
            let assetUri: string | null | undefined = null;
            try {
                await asset.downloadAsync();
                assetUri = asset.localUri ?? asset.uri;
                console.log('[AvatarCanvas] downloadAsync succeeded, uri:', assetUri?.substring(0, 80));
            } catch (downloadErr) {
                console.warn('[AvatarCanvas] downloadAsync failed, using raw uri fallback:', downloadErr);
                assetUri = asset.uri;
            }

            if (!assetUri) {
                throw new Error('Asset URI is empty — asset failed to resolve');
            }
            console.log('[AvatarCanvas] Fetching GLB from:', assetUri.substring(0, 80));

            // ─────────────────────────────────────────────────────────────────
            // Use fetch() + arrayBuffer() — works on all platforms.
            // Metro dev server and EAS both serve the GLB over HTTP, so
            // no FileSystem permission is needed.
            // ─────────────────────────────────────────────────────────────────
            const response = await fetch(assetUri);
            if (!response.ok) {
                throw new Error(`Failed to fetch GLB: HTTP ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            console.log('[AvatarCanvas] GLB fetched, size:', arrayBuffer.byteLength);

            const loader = new GLTFLoader();
            console.log('[AvatarCanvas] Parsing GLB ArrayBuffer...');
            const gltf = await new Promise<any>((resolve, reject) => {
                loader.parse(arrayBuffer, '', resolve, reject);
            });
            console.log('[AvatarCanvas] GLB parsed successfully');

            gltf.scene.position.set(0, 0, 0);
            scene.add(gltf.scene);
            frameModel(gltf.scene);

            // Collect bone names and write report
            const detectedBones: string[] = [];
            gltf.scene.traverse((obj: THREE.Object3D) => {
                if (obj instanceof THREE.Bone) {
                    detectedBones.push(obj.name);
                }
            });
            const uniqueBones = Array.from(new Set(detectedBones)).sort((a, b) => a.localeCompare(b));
            console.log('[AvatarCanvas] Bones detected:', uniqueBones.length, uniqueBones.slice(0, 5));

            // ✅ DIAGNOSTIC: Log skeleton structure for debugging animation issues
            const skeletonStats = {
                totalBones: uniqueBones.length,
                rightArmBones: uniqueBones.filter((b) => b.includes('Right') && (b.includes('Arm') || b.includes('Shoulder'))),
                leftArmBones: uniqueBones.filter((b) => b.includes('Left') && (b.includes('Arm') || b.includes('Shoulder'))),
                fingerBones: uniqueBones.filter((b) => b.includes('Hand')).length,
                spineBones: uniqueBones.filter((b) => b.includes('Spine')).length,
            };
            console.log('[AvatarCanvas] ========== SKELETON DIAGNOSTIC ==========');
            console.log('[AvatarCanvas] Total Bones:', skeletonStats.totalBones);
            console.log('[AvatarCanvas] Right Arm Chain:', skeletonStats.rightArmBones);
            console.log('[AvatarCanvas] Left Arm Chain:', skeletonStats.leftArmBones);
            console.log('[AvatarCanvas] Finger Bones Count:', skeletonStats.fingerBones);
            console.log('[AvatarCanvas] =====================================');

            // Write bone diagnostic report (best-effort — skip silently if FS unavailable)
            try {
                const docDir = FileSystem.documentDirectory;
                if (docDir) {
                    const reportPath = `${docDir}sensebridge-avatar-bones.json`;
                    await FileSystem.writeAsStringAsync(
                        reportPath,
                        JSON.stringify(
                            {
                                generatedAt: new Date().toISOString(),
                                totalBones: uniqueBones.length,
                                bones: uniqueBones,
                                skeletonStats,
                            },
                            null,
                            2
                        ),
                        { encoding: FileSystem.EncodingType.UTF8 }
                    );
                    onBonesDetected?.(uniqueBones, reportPath);
                } else {
                    onBonesDetected?.(uniqueBones, '');
                }
            } catch {
                onBonesDetected?.(uniqueBones, '');
            }

            if (uniqueBones.length === 0) {
                console.warn('[AvatarCanvas] No bones found. Model may be unrigged — animations will not play.');
            }

            // Restore console.log now that textures have loaded
            console.log = _origLog;

            // ── IDLE POSE ─────────────────────────────────────────────────────
            // Mixamo exports in T-pose (both arms straight out). Bring arms
            // down to sides so hands are visible and front-facing for signs.
            // We do this by building a looping AnimationClip that holds the
            // rest position — this persists between sign animations.
            const mixer = new THREE.AnimationMixer(gltf.scene);

            // ✅ IDLE POSE: Arms relaxed at sides (recalibrated for ZYX rotation order)
            // These Euler angles position arms naturally for sign language on top
            const idleBones: Record<string, { x: number; y: number; z: number }> = {
                // Right arm down to side
                mixamorig_RightShoulder: { x: 0.0, y: 0.0, z: 0.0 },
                mixamorig_RightArm: { x: 0.0, y: 0.0, z: -0.5 },  // Arm down
                mixamorig_RightForeArm: { x: 0.0, y: 0.0, z: 0.0 },  // Forearm neutral
                mixamorig_RightHand: { x: 0.0, y: 0.0, z: 0.0 },  // Hand neutral
                // Left arm down to side
                mixamorig_LeftShoulder: { x: 0.0, y: 0.0, z: 0.0 },
                mixamorig_LeftArm: { x: 0.0, y: 0.0, z: 0.5 },  // Arm down
                mixamorig_LeftForeArm: { x: 0.0, y: 0.0, z: 0.0 },  // Forearm neutral
                mixamorig_LeftHand: { x: 0.0, y: 0.0, z: 0.0 },  // Hand neutral
                // Spine slight curve
                mixamorig_Spine: { x: 0.0, y: 0.0, z: 0.0 },
                mixamorig_Spine1: { x: 0.0, y: 0.0, z: 0.0 },
            };

            const idleTracks: THREE.KeyframeTrack[] = [];
            gltf.scene.traverse((obj: THREE.Object3D) => {
                if (!(obj instanceof THREE.Bone)) return;
                const pose = idleBones[obj.name];
                if (!pose) return;
                // ✅ FIX: Use ZYX rotation order (matches sign JSON data)
                // Same order as animation tracks - ensures consistent bone positioning
                const ROTATION_ORDER: THREE.EulerOrder = 'ZYX';
                const euler = new THREE.Euler(pose.x, pose.y, pose.z, ROTATION_ORDER);
                const q = new THREE.Quaternion().setFromEuler(euler);
                idleTracks.push(
                    new THREE.QuaternionKeyframeTrack(
                        `${obj.name}.quaternion`,
                        [0, 9999],                    // hold forever
                        [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w]
                    )
                );
            });

            if (idleTracks.length > 0) {
                const idleClip = new THREE.AnimationClip('idle', 9999, idleTracks);
                const idleAction = mixer.clipAction(idleClip);
                idleAction.setLoop(THREE.LoopRepeat, Infinity);
                // ✅ CRITICAL FIX: Reduce idle weight to 0.3 instead of 1.0
                // At weight=1.0, idle animation dominates and blocks all sign animations
                // At weight=0.3, idle acts as background while sign animations override (weight=1.0)
                // This allows visible sign language movements on top of subtle idle pose
                idleAction.weight = 0.3;
                idleAction.play();
                console.log('[AvatarCanvas] Idle pose applied (weight: 0.3), tracks:', idleTracks.length);
            }

            mixerRef.current = mixer;
            onReady(mixer);
        } catch (error) {
            let message = 'Failed to load avatar.glb';
            if (error instanceof SyntaxError) {
                message = `JSON Parse Error: ${error.message}`;
            } else if (error instanceof Error) {
                message = error.message;
            }
            console.error('[AvatarCanvas] Fatal error:', message);
            console.error('[AvatarCanvas] Full error:', error);
            onError?.(message);
        }

        const animate = () => {
            requestAnimationFrame(animate);
            const delta = clockRef.current.getDelta();
            mixerRef.current?.update(delta);

            // ── Recompute camera position from orbit state every frame ──────
            const tgt = orbitTarget.current;
            const r   = orbitRadius.current;
            const phi = orbitPhi.current;
            const th  = orbitTheta.current;
            camera.position.set(
                tgt.x + r * Math.sin(phi) * Math.sin(th),
                tgt.y + r * Math.cos(phi),
                tgt.z + r * Math.sin(phi) * Math.cos(th),
            );
            camera.lookAt(tgt);
            // ───────────────────────────────────────────────────────────────

            renderer.render(scene, camera);
            gl.endFrameEXP();
        };

        animate();
    };

    return (
        <View style={styles.container} {...panResponder.panHandlers}>
            <GLView style={styles.canvas} onContextCreate={onContextCreate} />

            {/* "3D Sign Avatar" label */}
            <View style={styles.labelPill}>
                <Text style={styles.labelText}>3D Sign Avatar</Text>
            </View>

            {/* Gesture hint */}
            <View style={styles.hintPill}>
                <Text style={styles.hintText}>⟲ Drag to rotate  •  Pinch to zoom</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 440,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#0b1021',
        marginBottom: 0,
    },
    canvas: {
        flex: 1,
    },
    labelPill: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    labelText: {
        color: '#e2e8f0',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    hintPill: {
        position: 'absolute',
        bottom: 10,
        alignSelf: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.70)',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: 'rgba(61,214,255,0.2)',
    },
    hintText: {
        color: 'rgba(61,214,255,0.8)',
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.3,
    },
});

