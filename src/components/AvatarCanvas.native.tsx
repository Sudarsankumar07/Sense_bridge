import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as THREE from 'three';
import { DRACOLoader, GLTFLoader } from 'three-stdlib';

interface AvatarCanvasProps {
    onReady: (mixer: THREE.AnimationMixer) => void;
    onError?: (message: string) => void;
    onBonesDetected?: (bones: string[], reportPath: string) => void;
}

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({ onReady, onError, onBonesDetected }) => {
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const clockRef = useRef(new THREE.Clock());

    const onContextCreate = async (gl: any) => {
        const renderer = new Renderer({ gl });
        renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
        renderer.setClearColor(0x0b1021);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            60,
            gl.drawingBufferWidth / gl.drawingBufferHeight,
            0.1,
            100
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
                return;
            }

            const size = new THREE.Vector3();
            box.getSize(size);
            const center = new THREE.Vector3();
            box.getCenter(center);

            // Center model horizontally and place feet on floor plane.
            root.position.x -= center.x;
            root.position.z -= center.z;
            root.position.y -= box.min.y;

            const normalizedBox = new THREE.Box3().setFromObject(root);
            const normalizedSize = new THREE.Vector3();
            normalizedBox.getSize(normalizedSize);

            const maxDim = Math.max(normalizedSize.x, normalizedSize.y, normalizedSize.z);
            const fov = THREE.MathUtils.degToRad(camera.fov);
            const fitDistance = maxDim > 0 ? (maxDim * 0.8) / Math.tan(fov / 2) : 2.2;

            camera.position.set(0, Math.max(0.9, normalizedSize.y * 0.55), fitDistance * 1.05);
            camera.lookAt(0, Math.max(0.8, normalizedSize.y * 0.45), 0);
        };

        try {
            console.log('[AvatarCanvas] Loading GLB asset...');
            const asset = Asset.fromModule(require('../../assets/models/avatar.glb'));
            console.log('[AvatarCanvas] Asset loaded:', typeof asset, asset?.uri ? 'URI present' : 'NO URI');
            
            await asset.downloadAsync();
            console.log('[AvatarCanvas] Asset downloaded, localUri:', asset.localUri?.substring(0, 80));

            // Verify asset URI is a string (not object)
            const assetUri = asset.localUri || asset.uri;
            if (typeof assetUri !== 'string') {
                throw new Error(`Asset URI is not a string: ${typeof assetUri}. Value: ${String(assetUri).substring(0, 100)}`);
            }

            // Polyfill: Handle Blob creation from ArrayBuffer for Expo environment
            // This prevents "Creating blobs from ArrayBuffer is not supported" errors
            const OriginalBlob = globalThis.Blob;
            if (OriginalBlob) {
                (globalThis as any).Blob = class Blob extends OriginalBlob {
                    constructor(parts?: any, options?: any) {
                        try {
                            super(parts, options);
                        } catch (e: any) {
                            // If Blob creation from ArrayBuffer fails, create from string
                            if (e?.message?.includes('Creating blobs from')) {
                                const arrayBuffer = parts?.[0];
                                if (arrayBuffer instanceof ArrayBuffer) {
                                    const view = new Uint8Array(arrayBuffer);
                                    super([view], options);
                                } else {
                                    super(parts, options);
                                }
                            } else {
                                throw e;
                            }
                        }
                    }
                };
            }

            const loader = new GLTFLoader();
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
            loader.setDRACOLoader(dracoLoader);

            // Suppress texture loading errors in console (model still loads without textures)
            const originalWarn = console.warn;
            const originalError = console.error;
            const textureErrorFilter = (msg: any) => {
                const msgStr = String(msg);
                // Suppress only Three.js GLTFLoader texture warnings
                if (msgStr.includes('GLTFLoader') && msgStr.includes('texture')) {
                    return true;
                }
                return false;
            };

            console.warn = (...args: any[]) => {
                if (!textureErrorFilter(args[0])) originalWarn(...args);
            };
            console.error = (...args: any[]) => {
                if (!textureErrorFilter(args[0])) originalError(...args);
            };

            console.log('[AvatarCanvas] Loading GLTF from:', assetUri.substring(0, 80));
            const gltf = await loader.loadAsync(assetUri);
            
            // Restore console methods
            console.warn = originalWarn;
            console.error = originalError;

            gltf.scene.position.set(0, 0, 0);
            scene.add(gltf.scene);
            frameModel(gltf.scene);

            const detectedBones: string[] = [];
            gltf.scene.traverse((obj: THREE.Object3D) => {
                if (obj instanceof THREE.Bone) {
                    detectedBones.push(obj.name);
                    console.log('[AvatarCanvas] Bone:', obj.name);
                }
            });

            const uniqueBones = Array.from(new Set(detectedBones)).sort((a, b) => a.localeCompare(b));
            const reportPath = `${FileSystem.documentDirectory ?? ''}sensebridge-avatar-bones.json`;
            
            try {
                const reportPayload = {
                    generatedAt: new Date().toISOString(),
                    totalBones: uniqueBones.length,
                    bones: uniqueBones,
                };

                if (FileSystem.documentDirectory) {
                    const reportJson = JSON.stringify(reportPayload, null, 2);
                    console.log('[AvatarCanvas] Writing bone report:', reportJson.substring(0, 100));
                    
                    await FileSystem.writeAsStringAsync(
                        reportPath,
                        reportJson,
                        { encoding: FileSystem.EncodingType.UTF8 }
                    );
                    console.log('[AvatarCanvas] Bone report saved to:', reportPath);
                    onBonesDetected?.(uniqueBones, reportPath);
                }
            } catch (reportError) {
                const reportMsg = reportError instanceof Error ? reportError.message : 'Unknown error';
                console.error('[AvatarCanvas] Error saving bone report:', reportMsg);
                onBonesDetected?.(uniqueBones, '');
            }

            if (uniqueBones.length === 0) {
                console.warn('[AvatarCanvas] Model loaded but has no bones. Sign animations require a rigged humanoid GLB.');
            }

            const mixer = new THREE.AnimationMixer(gltf.scene);
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
