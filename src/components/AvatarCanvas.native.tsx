import React, { useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, PanResponder, LogBox } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer, TextureLoader as ExpoTextureLoader } from 'expo-three';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

// ── Permanently suppress noisy EXGL pixelStorei warnings ──────────────────────
// expo-gl does not support all WebGL pixelStorei parameters. Three.js calls
// these during texture uploads every render frame, flooding the log.
// We suppress at module level so the filter is active for the entire lifetime
// of the component (including the animation loop), not just during model load.
const _origConsoleLog = console.log;
console.log = (...args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('EXGL:') || msg.includes('pixelStorei')) return;
    _origConsoleLog(...args);
};

// Suppress the same message from the in-app LogBox overlay
LogBox.ignoreLogs([
    'EXGL: gl.pixelStorei',
    'pixelStorei',
]);

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
        // ── WORKAROUND: expo-gl + three.js trim() crash ──
        // three.js calls .trim() on gl.getShaderInfoLog() and gl.getProgramInfoLog().
        // On some devices, expo-gl returns null/undefined instead of an empty string,
        // causing a fatal "Cannot read property 'trim' of undefined" render loop crash.
        const _getShaderInfoLog = gl.getShaderInfoLog.bind(gl);
        gl.getShaderInfoLog = (shader: any) => _getShaderInfoLog(shader) || '';

        const _getProgramInfoLog = gl.getProgramInfoLog.bind(gl);
        gl.getProgramInfoLog = (program: any) => _getProgramInfoLog(program) || '';

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

            const response = await fetch(assetUri);
            if (!response.ok) {
                throw new Error(`Failed to fetch GLB: HTTP ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            console.log('[AvatarCanvas] GLB fetched, size:', arrayBuffer.byteLength);

            // ── GLB Parser & Image Extractor ───────────────────────────────
            // React Native's Blob constructor does NOT support ArrayBuffer/ArrayBufferView input.
            // GLTFLoader.parse() internally tries to create Blobs for embedded images, which crashes.
            // Fix: Parse the GLB binary structure, extract all images, save them as local files using
            // expo-file-system, modify the GLTF JSON to reference the local file URIs directly (deleting
            // bufferView references to bypass Blob loading), rebuild a valid GLB ArrayBuffer, and parse it.

            // Pure-JS helpers to ensure platform compatibility without relying on missing globals
            const localDecodeText = (arr: Uint8Array): string => {
                let out = "";
                let i = 0;
                const len = arr.length;
                while (i < len) {
                    const c = arr[i++];
                    if (c < 128) {
                        out += String.fromCharCode(c);
                    } else if (c > 191 && c < 224) {
                        out += String.fromCharCode(((c & 31) << 6) | (arr[i++] & 63));
                    } else {
                        out += String.fromCharCode(((c & 15) << 12) | ((arr[i++] & 63) << 6) | (arr[i++] & 63));
                    }
                }
                return out;
            };

            const localEncodeText = (str: string): Uint8Array => {
                const bytes: number[] = [];
                for (let i = 0; i < str.length; i++) {
                    const code = str.charCodeAt(i);
                    if (code < 0x80) {
                        bytes.push(code);
                    } else if (code < 0x800) {
                        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
                    } else if (code < 0xd800 || code >= 0xe000) {
                        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
                    } else {
                        i++;
                        const utf32 = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                        bytes.push(
                            0xf0 | (utf32 >> 18),
                            0x80 | ((utf32 >> 12) & 0x3f),
                            0x80 | ((utf32 >> 6) & 0x3f),
                            0x80 | (utf32 & 0x3f)
                        );
                    }
                }
                return new Uint8Array(bytes);
            };

            const localUint8ToBase64 = (arr: Uint8Array): string => {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                let base64 = '';
                const len = arr.length;
                for (let i = 0; i < len; i += 3) {
                    const b1 = arr[i];
                    const b2 = i + 1 < len ? arr[i + 1] : NaN;
                    const b3 = i + 2 < len ? arr[i + 2] : NaN;
                    const enc1 = b1 >> 2;
                    const enc2 = ((b1 & 3) << 4) | (isNaN(b2) ? 0 : b2 >> 4);
                    const enc3 = isNaN(b2) ? 64 : ((b2 & 15) << 2) | (isNaN(b3) ? 0 : b3 >> 6);
                    const enc4 = isNaN(b3) ? 64 : b3 & 63;
                    base64 += chars[enc1] + chars[enc2] +
                              (enc3 === 64 ? '=' : chars[enc3]) +
                              (enc4 === 64 ? '=' : chars[enc4]);
                }
                return base64;
            };

            const glbView = new DataView(arrayBuffer);
            const magic   = glbView.getUint32(0, true);
            if (magic !== 0x46546C67) {
                throw new Error('Invalid glTF-Binary file format.');
            }
            const glbVersion = glbView.getUint32(4, true);
            const jsonLen    = glbView.getUint32(12, true);

            // Extract original JSON string
            const jsonBytes = new Uint8Array(arrayBuffer, 20, jsonLen);
            const jsonStr   = localDecodeText(jsonBytes);
            const gltfJson  = JSON.parse(jsonStr);

            // Extract BIN chunk details
            const binHeaderOffset = 20 + jsonLen;
            const binChunkLength   = glbView.getUint32(binHeaderOffset, true);
            const binDataOffset    = binHeaderOffset + 8;
            const binBytes         = new Uint8Array(arrayBuffer, binDataOffset, binChunkLength);

            const blobUriMap = new Map<string, string>();
            const tmpDir     = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
            const images: any[] = gltfJson.images ?? [];

            // 1. Write each embedded texture to a local cache file as base64
            await Promise.all(
                images.map(async (img: any, idx: number) => {
                    if (img.bufferView === undefined) return;
                    const bv       = gltfJson.bufferViews[img.bufferView];
                    const imgBytes = binBytes.slice(bv.byteOffset, bv.byteOffset + bv.byteLength);
                    const ext      = img.mimeType === 'image/jpeg' || img.mimeType === 'image/jpg' ? 'jpg' : 'png';
                    const tmpPath  = `${tmpDir}sensebridge_tex_${idx}.${ext}`;

                    const b64 = localUint8ToBase64(imgBytes);
                    await FileSystem.writeAsStringAsync(tmpPath, b64, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                    blobUriMap.set(`__img_${idx}`, tmpPath);
                    console.log(`[AvatarCanvas] Extracted texture ${idx} (${img.name ?? ext}) → ${tmpPath.split('/').pop()}`);
                })
            );
            console.log('[AvatarCanvas] Embedded textures pre-extracted:', blobUriMap.size);

            // 2. Modify GLTF JSON to refer to local file:// URIs directly
            images.forEach((img: any, idx: number) => {
                if (img.bufferView !== undefined) {
                    const fileUri = blobUriMap.get(`__img_${idx}`);
                    if (fileUri) {
                        img.uri = fileUri;
                        delete img.bufferView; // deletes reference to bufferView so parser skips Blob creation
                    }
                }
            });

            // 3. Stringify the modified JSON and pad it to 4-byte boundary
            const newJsonStr   = JSON.stringify(gltfJson);
            const newJsonBytes = localEncodeText(newJsonStr);
            const paddedJsonLen = Math.ceil(newJsonBytes.length / 4) * 4;
            const paddedJson   = new Uint8Array(paddedJsonLen);
            paddedJson.set(newJsonBytes);
            for (let i = newJsonBytes.length; i < paddedJsonLen; i++) {
                paddedJson[i] = 0x20; // Pad with spaces
            }

            // Pad BIN chunk to 4-byte boundary
            const paddedBinLen = Math.ceil(binChunkLength / 4) * 4;
            const paddedBin   = new Uint8Array(paddedBinLen);
            paddedBin.set(binBytes);

            // 4. Construct the rebuilt GLB ArrayBuffer
            const newTotalLength = 12 + 8 + paddedJsonLen + 8 + paddedBinLen;
            const rebuiltBuffer  = new ArrayBuffer(newTotalLength);
            const rebuiltView    = new DataView(rebuiltBuffer);

            // Write Header
            rebuiltView.setUint32(0, 0x46546C67, true);   // magic
            rebuiltView.setUint32(4, glbVersion, true);   // version
            rebuiltView.setUint32(8, newTotalLength, true); // total length

            // Write JSON Chunk Header
            rebuiltView.setUint32(12, paddedJsonLen, true);
            rebuiltView.setUint32(16, 0x4E4F534A, true);  // "JSON"

            // Write JSON Chunk Data
            const rebuiltJsonBytes = new Uint8Array(rebuiltBuffer, 20, paddedJsonLen);
            rebuiltJsonBytes.set(paddedJson);

            // Write BIN Chunk Header
            const binHeaderIndex = 20 + paddedJsonLen;
            rebuiltView.setUint32(binHeaderIndex, paddedBinLen, true);
            rebuiltView.setUint32(binHeaderIndex + 4, 0x004E4942, true); // "BIN"

            // Write BIN Chunk Data
            const rebuiltBinBytes = new Uint8Array(rebuiltBuffer, binHeaderIndex + 8, paddedBinLen);
            rebuiltBinBytes.set(paddedBin);

            console.log(`[AvatarCanvas] GLB rebuilt with local URIs. New size: ${newTotalLength} bytes.`);

            const loader = new GLTFLoader();
            console.log('[AvatarCanvas] Parsing GLB ArrayBuffer...');

            // Hook THREE.TextureLoader.prototype.load to bypass expo-three's broken polyfill for file:// URIs
            const originalTextureLoaderLoad = THREE.TextureLoader.prototype.load;
            (THREE.TextureLoader.prototype as any).load = function(this: any, url: string, onLoad: any, onProgress: any, onError: any): any {
                if (url && (url.startsWith('file://') || url.includes('sensebridge_tex'))) {
                    console.log(`[AvatarCanvas] Custom texture load intercept for local URI: ${url.split('/').pop()}`);
                    const expoLoader = new ExpoTextureLoader(this.manager);
                    expoLoader.setCrossOrigin(this.crossOrigin);
                    expoLoader.setPath(this.path);
                    return expoLoader.load(url, onLoad, onProgress, onError);
                }
                return originalTextureLoaderLoad.call(this, url, onLoad, onProgress, onError);
            };

            let gltf: any;
            try {
                gltf = await new Promise<any>((resolve, reject) => {
                    loader.parse(rebuiltBuffer, '', resolve, reject);
                });
            } finally {
                // Restore the original loader immediately after parsing finishes (whether it succeeds or fails)
                THREE.TextureLoader.prototype.load = originalTextureLoaderLoad;
            }
            console.log('[AvatarCanvas] GLB parsed successfully');

            // ── CRITICAL FIX: Sanitize bone names ────────────────────────────
            // Three.js treats ':' as a reserved path separator in PropertyBinding
            // (_RESERVED_CHARS_RE = '\\[\\]\\.:\\/').
            // Mixamo exports using the "mixamorig2:" prefix (colon variant) cause
            // PropertyBinding.parseTrackName() to throw, silently aborting scene
            // setup and preventing onReady() from ever being called.
            // Fix: replace all ':' with '_' in every Object3D name after parse.
            gltf.scene.traverse((obj: THREE.Object3D) => {
                if (obj.name && obj.name.includes(':')) {
                    obj.name = obj.name.replace(/:/g, '_');
                }
            });
            // Also sanitize any AnimationClips embedded in the GLB
            if (gltf.animations && gltf.animations.length > 0) {
                gltf.animations.forEach((clip: THREE.AnimationClip) => {
                    clip.tracks.forEach((track: THREE.KeyframeTrack) => {
                        if (track.name && track.name.includes(':')) {
                            track.name = track.name.replace(/:/g, '_');
                        }
                    });
                });
            }
            console.log('[AvatarCanvas] Bone name sanitization complete (colon → underscore).');

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

            // ── IDLE POSE ─────────────────────────────────────────────────────
            // Mixamo exports in T-pose (both arms straight out). Bring arms
            // down to sides so hands are visible and front-facing for signs.
            // We do this by building a looping AnimationClip that holds the
            // rest position — this persists between sign animations.
            const mixer = new THREE.AnimationMixer(gltf.scene);

            // Dynamically resolve bone names from the loaded model
            const findActualBoneName = (semanticName: string) => {
                const cleanKey = semanticName.toLowerCase();
                const cleanKeyAlt = cleanKey.replace('hand', '');
                const matched = uniqueBones.find((b) => {
                    const cb = b.toLowerCase();
                    return cb === cleanKey || 
                           cb.endsWith('_' + cleanKey) || 
                           cb.endsWith('_' + cleanKeyAlt) || 
                           cb.endsWith(':' + cleanKey) || 
                           cb.endsWith(':' + cleanKeyAlt) ||
                           cb.endsWith(cleanKey) ||
                           cb.endsWith(cleanKeyAlt);
                });
                return matched || semanticName;
            };

            // ✅ IDLE POSE: Arms relaxed at sides (recalibrated for ZYX rotation order)
            // These Euler angles position arms naturally for sign language on top
            // ── IDLE POSE ─────────────────────────────────────────────────────────
            // In Mixamo GLB, the arm bones are oriented in T-pose (pointing sideways).
            // Axes from the arm's local space:
            //   X  = forward/backward tilt of the upper arm
            //   Z  = up/down rotation of the upper arm  (neg Z = arm raised up)
            //   Y  = inward/outward twist
            // For idle:  arms hang at sides = z: -0.3 (slightly down from T-pose)
            //            small forward lean = x: 0.3 (arms slightly in front of body)
            const idleBonesSemantic: Record<string, { x: number; y: number; z: number }> = {
                // Right arm — hangs naturally at side, slightly in front
                RightShoulder: { x: 0.0,  y: 0.0, z: 0.0  },
                RightArm:      { x: 0.3,  y: 0.0, z: -0.3 }, // arm down, leaning forward
                RightForeArm:  { x: 0.0,  y: 0.0, z: 0.0  },
                RightHand:     { x: 0.0,  y: 0.0, z: 0.0  },
                // Left arm — mirror
                LeftShoulder:  { x: 0.0,  y: 0.0, z: 0.0  },
                LeftArm:       { x: 0.3,  y: 0.0, z: 0.3  }, // arm down, leaning forward
                LeftForeArm:   { x: 0.0,  y: 0.0, z: 0.0  },
                LeftHand:      { x: 0.0,  y: 0.0, z: 0.0  },
                // Spine
                Spine:         { x: 0.0,  y: 0.0, z: 0.0  },
                Spine1:        { x: 0.0,  y: 0.0, z: 0.0  },
            };

            const idleTracks: THREE.KeyframeTrack[] = [];
            Object.entries(idleBonesSemantic).forEach(([semanticName, pose]) => {
                const actualName = findActualBoneName(semanticName);
                if (!uniqueBones.includes(actualName)) return;

                // ✅ FIX: Use ZYX rotation order (matches sign JSON data)
                // Same order as animation tracks - ensures consistent bone positioning
                const ROTATION_ORDER: THREE.EulerOrder = 'ZYX';
                const euler = new THREE.Euler(pose.x, pose.y, pose.z, ROTATION_ORDER);
                const q = new THREE.Quaternion().setFromEuler(euler);
                idleTracks.push(
                    new THREE.QuaternionKeyframeTrack(
                        `${actualName}.quaternion`,
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

