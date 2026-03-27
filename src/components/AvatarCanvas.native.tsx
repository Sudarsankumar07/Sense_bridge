import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

interface AvatarCanvasProps {
    onReady: (mixer: THREE.AnimationMixer) => void;
    onError?: (message: string) => void;
    onBonesDetected?: (bones: string[], reportPath: string) => void;
}

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({ onReady, onError, onBonesDetected }) => {
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const clockRef = useRef(new THREE.Clock());

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
            60,
            gl.drawingBufferWidth / gl.drawingBufferHeight,
            0.01,
            1000
        );
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

            // ── CAMERA ──────────────────────────────────────────────────────
            // Fixed camera — looks at chest height, 2.5 units back.
            // Use a fixed distance instead of fitDistance to guarantee
            // the model is always within the camera frustum.
            const eyeHeight  = scaledSize.y * 0.55;  // ~chest level
            const camDist    = 2.5;
            camera.position.set(0, eyeHeight, camDist);
            camera.lookAt(0, eyeHeight * 0.75, 0);
            camera.near = 0.01;
            camera.far  = 1000;
            camera.updateProjectionMatrix();
            console.log('[AvatarCanvas] Camera set — eye:', eyeHeight.toFixed(2), 'dist:', camDist);
        };

        try {
            console.log('[AvatarCanvas] Loading GLB asset...');
            const asset = Asset.fromModule(require('../../assets/models/avatar.glb'));
            await asset.downloadAsync();

            // Use asset.uri — Metro serves assets over HTTP during development.
            // This is always a valid HTTP URL that fetch() handles natively.
            // Do NOT use asset.localUri — file:// paths break on Android Expo Go.
            const assetUri = asset.uri;
            if (!assetUri) {
                throw new Error('Asset URI is empty — asset failed to resolve');
            }
            console.log('[AvatarCanvas] Fetching GLB from:', assetUri.substring(0, 80));

            // ─────────────────────────────────────────────────────────────────
            // Use fetch() + arrayBuffer() — works on all platforms in Expo Go.
            // No FileSystem, no native module dependency, no Draco CDN needed.
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

            const reportPath = `${FileSystem.documentDirectory ?? ''}sensebridge-avatar-bones.json`;
            try {
                if (FileSystem.documentDirectory) {
                    await FileSystem.writeAsStringAsync(
                        reportPath,
                        JSON.stringify({ generatedAt: new Date().toISOString(), totalBones: uniqueBones.length, bones: uniqueBones }, null, 2),
                        { encoding: FileSystem.EncodingType.UTF8 }
                    );
                    onBonesDetected?.(uniqueBones, reportPath);
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

            const idleBones: Record<string, { x: number; y: number; z: number }> = {
                mixamorig_RightShoulder: { x:  0.0,  y:  0.0,  z:  0.15 },
                mixamorig_RightArm:     { x:  0.15, y:  0.2,  z: -1.45 },
                mixamorig_RightForeArm: { x:  0.15, y: -0.3,  z:  0.0  },
                mixamorig_RightHand:    { x:  0.1,  y:  0.0,  z:  0.0  },
                mixamorig_LeftShoulder: { x:  0.0,  y:  0.0,  z: -0.15 },
                mixamorig_LeftArm:      { x:  0.15, y: -0.2,  z:  1.45 },
                mixamorig_LeftForeArm:  { x:  0.15, y:  0.3,  z:  0.0  },
                mixamorig_LeftHand:     { x:  0.1,  y:  0.0,  z:  0.0  },
                mixamorig_Spine:        { x:  0.05, y:  0.0,  z:  0.0  },
                mixamorig_Spine1:       { x:  0.05, y:  0.0,  z:  0.0  },
            };

            const idleTracks: THREE.KeyframeTrack[] = [];
            gltf.scene.traverse((obj: THREE.Object3D) => {
                if (!(obj instanceof THREE.Bone)) return;
                const pose = idleBones[obj.name];
                if (!pose) return;
                // Convert Euler → Quaternion for the keyframe track
                const euler = new THREE.Euler(pose.x, pose.y, pose.z, 'XYZ');
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
                idleAction.weight = 1;
                idleAction.play();
                console.log('[AvatarCanvas] Idle pose applied, tracks:', idleTracks.length);
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
            renderer.render(scene, camera);
            gl.endFrameEXP();
        };

        animate();
    };

    return (
        <View style={styles.container}>
            <GLView style={styles.canvas} onContextCreate={onContextCreate} />
            <View style={styles.labelPill}>
                <Text style={styles.labelText}>3D Sign Avatar</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 340,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#0b1021',
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.25)',
        marginBottom: 16,
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
});
