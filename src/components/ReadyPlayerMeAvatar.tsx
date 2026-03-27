import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { SignTimeline } from '../types';

// WebView is only available on native platforms
let WebView: any = null;
try {
    if (Platform.OS !== 'web') {
        WebView = require('react-native-webview').WebView;
    }
} catch (e) {
    console.warn('WebView not available');
}

interface ReadyPlayerMeAvatarProps {
    transcriptText?: string;
    timeline?: SignTimeline;
    emotion?: string;
    onReady?: () => void;
    onError?: (error: string) => void;
    visible?: boolean;
}

export const ReadyPlayerMeAvatar: React.FC<ReadyPlayerMeAvatarProps> = ({
    transcriptText = '',
    timeline,
    emotion = 'neutral',
    onReady,
    onError,
    visible = true,
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const webViewRef = React.useRef<any>(null);

    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);

            switch (data.type) {
                case 'ready':
                    setIsLoading(false);
                    setErrorMessage(null);
                    setIsReady(true);
                    console.log('[ReadyPlayerMeAvatar] Avatar ready');
                    onReady?.();
                    break;
                case 'error':
                    console.error('[ReadyPlayerMeAvatar] Error:', data.error);
                    setErrorMessage(data.error);
                    setIsLoading(false);
                    onError?.(data.error);
                    break;
                case 'debug':
                    console.log('[ReadyPlayerMeAvatar]', data.message);
                    break;
                case 'speaking':
                    console.log('[ReadyPlayerMeAvatar] Speaking:', data.text);
                    break;
                case 'gesture':
                    console.log('[ReadyPlayerMeAvatar] Gesture:', data.signId);
                    break;
            }
        } catch (e) {
            console.error('Message parse error:', e);
        }
    };

    // Send transcript to avatar when it changes
    useEffect(() => {
        if (!transcriptText || !isReady || !webViewRef.current) return;

        const cleanText = transcriptText.replace(/'/g, "\\'").replace(/"/g, '\\"');
        const injectedJS = `
            if (window.avatarAPI && window.avatarAPI.speak) {
                window.avatarAPI.speak("${cleanText}", "${emotion}");
            }
            true;
        `;

        console.log('[ReadyPlayerMeAvatar] Injecting speak:', cleanText);
        webViewRef.current.injectJavaScript(injectedJS);
    }, [transcriptText, emotion, isReady]);

    // Execute timeline segments
    useEffect(() => {
        if (!timeline || !isReady || !webViewRef.current) return;

        console.log('[ReadyPlayerMeAvatar] Executing timeline with', timeline.segments.length, 'segments');

        timeline.segments.forEach((segment, index) => {
            const delay = segment.startMs;

            setTimeout(() => {
                if (!webViewRef.current) return;

                const injectedJS = `
                    if (window.avatarAPI && window.avatarAPI.gesture) {
                        window.avatarAPI.gesture("${segment.signId}", ${segment.durationMs});
                    }
                    true;
                `;

                console.log('[ReadyPlayerMeAvatar] Gesture:', segment.signId);
                webViewRef.current.injectJavaScript(injectedJS);
            }, delay);
        });
    }, [timeline, isReady]);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>SenseBridge Avatar</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
            width: 100%; 
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            overflow: hidden;
        }
        canvas { 
            display: block; 
            width: 100%;
            height: 100%;
        }
        #status {
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            color: white;
            font-size: 11px;
            background: rgba(0,0,0,0.5);
            padding: 6px 10px;
            border-radius: 4px;
            max-height: 60px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .loading-container {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            text-align: center;
            z-index: 100;
        }
        .spinner {
            border: 3px solid rgba(255,255,255,0.3);
            border-top: 3px solid white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        #error-container {
            position: absolute;
            bottom: 10px;
            left: 10px;
            right: 10px;
            background: rgba(239, 68, 68, 0.9);
            color: white;
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
            max-height: 60px;
            overflow: auto;
        }
    </style>
</head>
<body>
    <div id="status">Loading Avatar...</div>
    <div class="loading-container" id="loading-div">
        <div class="spinner"></div>
        <p>Initializing Ready Player Me</p>
    </div>
    <div id="error-container" style="display:none;"></div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@readyplayerme/loader@0.3.0/build/index.umd.js"></script>

    <script>
        const statusEl = document.getElementById('status');
        const loadingDiv = document.getElementById('loading-div');
        const errorContainer = document.getElementById('error-container');

        let scene, renderer, avatar, mixer, clock;
        const animations = {};
        let isReady = false;

        function updateStatus(msg) {
            statusEl.textContent = msg;
            console.log('[Avatar]', msg);
            sendMessage({ type: 'debug', message: msg });
        }

        function showError(msg) {
            console.error('[Avatar Error]', msg);
            errorContainer.textContent = msg;
            errorContainer.style.display = 'block';
            sendMessage({ type: 'error', error: msg });
        }

        function sendMessage(data) {
            try {
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify(data));
                }
            } catch (e) {
                console.error('Failed to send message:', e);
            }
        }

        async function initAvatar() {
            try {
                updateStatus('Initializing Three.js...');

                // Setup scene
                scene = new THREE.Scene();
                scene.background = new THREE.Color(0x667eea);

                renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
                renderer.setSize(window.innerWidth, window.innerHeight);
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                document.body.appendChild(renderer.domElement);

                const camera = new THREE.PerspectiveCamera(
                    75,
                    window.innerWidth / window.innerHeight,
                    0.1,
                    1000
                );
                camera.position.z = 0.6;

                // Lighting
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
                scene.add(ambientLight);

                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                directionalLight.position.set(5, 10, 5);
                scene.add(directionalLight);

                updateStatus('Loading avatar model...');

                // Load Ready Player Me avatar
                const avatarUrl = 'https://api.readyplayer.me/v1/avatars/6746f0e3fd5d6a955dc63f1e.glb';

                const loader = new THREE.GLTFLoader();
                const gltf = await new Promise((resolve, reject) => {
                    loader.load(
                        avatarUrl,
                        resolve,
                        (progress) => {
                            const percent = Math.round((progress.loaded / progress.total) * 100);
                            updateStatus('Loading: ' + percent + '%');
                        },
                        reject
                    );
                });

                avatar = gltf.scene;
                avatar.scale.set(1, 1, 1);
                avatar.position.y = -0.2;
                scene.add(avatar);

                // Setup animation mixer
                mixer = new THREE.AnimationMixer(avatar);
                clock = new THREE.Clock();

                updateStatus('Avatar loaded ✓');

                // Hide loading indicator
                loadingDiv.style.display = 'none';
                isReady = true;
                errorContainer.style.display = 'none';

                sendMessage({ type: 'ready' });

                // Start animation loop
                animate();

            } catch (error) {
                const msg = error?.message || String(error);
                console.error('Avatar initialization failed:', error);
                showError('Failed to load avatar: ' + msg);
            }
        }

        // Public API for React Native
        window.avatarAPI = {
            speak: (text, emotion) => {
                if (!isReady) {
                    console.warn('Avatar not ready yet');
                    return;
                }
                updateStatus('Speaking: "' + text + '" (' + emotion + ')');
                sendMessage({ type: 'speaking', text: text, emotion: emotion });
                playSpeakingAnimation(text, emotion);
            },

            gesture: (signId, duration) => {
                if (!isReady) {
                    console.warn('Avatar not ready yet');
                    return;
                }
                updateStatus('Gesture: ' + signId + ' (' + duration + 'ms)');
                sendMessage({ type: 'gesture', signId: signId });
                playGestureAnimation(signId, duration);
            },

            getStatus: () => {
                return {
                    ready: isReady,
                    speaking: mixer ? true : false
                };
            }
        };

        function playGestureAnimation(signId, duration) {
            // Map sign IDs to gesture descriptions
            const gestures = {
                'HELLO': { name: 'wave', duration: 1000 },
                'THANK-YOU': { name: 'namaste', duration: 1500 },
                'YES': { name: 'thumbup', duration: 800 },
                'NO': { name: 'thumbdown', duration: 800 },
                'WAIT': { name: 'handup', duration: 1000 },
                'SORRY': { name: 'sorry', duration: 1200 },
                'GOOD': { name: 'thumbup', duration: 800 },
                'BAD': { name: 'thumbdown', duration: 800 },
            };

            const gesture = gestures[signId] || { name: 'wave', duration: duration || 1000 };
            console.log('Gesture:', gesture);

            // This is where you would trigger avatar animations
            // For now, we just log them
        }

        function playLipsyncAnimation(text, emotion) {
            // Analyze text for lip-sync
            console.log('Lip-sync for:', text, 'emotion:', emotion);

            // Simple phoneme analysis
            const phonemes = text.toLowerCase()
                .replace(/[^a-z]/g, '')
                .split('')
                .map(char => getViseme(char));

            console.log('Phonemes:', phonemes);
        }

        function playGestureFromKeywords(text) {
            const keywordMap = {
                'hello': 'HELLO',
                'hi': 'HELLO',
                'thanks': 'THANK-YOU',
                'thank you': 'THANK-YOU',
                'yes': 'YES',
                'yeah': 'YES',
                'no': 'NO',
                'nope': 'NO',
                'wait': 'WAIT',
                'good': 'GOOD',
                'great': 'GOOD',
                'bad': 'BAD',
                'sorry': 'SORRY'
            };

            const lowerText = text.toLowerCase();
            for (const [keyword, signId] of Object.entries(keywordMap)) {
                if (lowerText.includes(keyword)) {
                    const gesture = gestures[signId] || { name: gesture, duration: 1000 };
                    return gesture;
                }
            }
            return null;
        }

        function playSpecificAnimation(name, duration) {
            // Could map to actual Three.js skeleton animations here
            console.log('Playing animation:', name, 'for', duration, 'ms');
        }

        function getViseme(char) {
            const visemeMap = {
                'a': 'a', 'e': 'E', 'i': 'I', 'o': 'O', 'u': 'U',
                'p': 'P', 'b': 'B', 'm': 'M',
                'f': 'f', 'v': 'v',
                't': 'T', 'd': 't',
                'n': 'n', 'l': 'l',
                's': 's', 'z': 'z',
                'j': 'j',
                'k': 'k', 'g': 'k',
                'r': 'r',
                'w': 'w',
                'y': 'y'
            };
            return visemeMap[char] || 'X';
        }

        function playMorphAnimation(phonemes, duration) {
            const phonemeDuration = duration / phonemes.length;

            phonemes.forEach((phoneme, index) => {
                setTimeout(() => {
                    if (avatar && avatar.morphTargetInfluences) {
                        // Reset all
                        for (let i = 0; i < avatar.morphTargetInfluences.length; i++) {
                            avatar.morphTargetInfluences[i] = 0;
                        }
                        // Set current
                        const morphMap = getMorphIndexForViseme(phoneme);
                        if (morphMap !== -1 && avatar.morphTargetInfluences[morphMap]) {
                            avatar.morphTargetInfluences[morphMap] = 0.8;
                        }
                    }
                }, index * phonemeDuration);
            });
        }

        function getMorphIndexForViseme(viseme) {
            // Map visemes to morph target indices
            return 0; // Simplified
        }

        function playSpecialGesture(text) {
            const text_lower = text.toLowerCase();
            if (text_lower.includes('hello') || text_lower.includes('hi')) {
                playSpecificAnimation('wave', 1000);
            } else if (text_lower.includes('thank')) {
                playSpecificAnimation('namaste', 1500);
            } else if (text_lower.includes('yes')) {
                playSpecificAnimation('thumbup', 800);
            } else if (text_lower.includes('no')) {
                playSpecificAnimation('thumbdown', 800);
            }
        }

        function playSimpleHeadTilt() {
            if (!avatar) return;
            // Tilt head slightly to show engagement
            const originalRotation = avatar.rotation.y;
            const tiltAmount = Math.sin(Date.now() / 2000) * 0.1;
            avatar.rotation.y = originalRotation + tiltAmount;
        }

        function playSimpleHeadNod() {
            if (!avatar) return;
            // Quick nod
            const originalRotation = avatar.rotation.x;
            const bobAmount = Math.sin(Date.now() / 500) * 0.05;
            avatar.rotation.x = originalRotation + bobAmount;
        }

        function playIdleAnimation() {
            playSimpleHeadTilt();
        }

        function playedSpeakingAnimation(text) {
            playSimpleHeadNod();
            playSpecialGesture(text);
        }

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);

            if (mixer && clock) {
                mixer.update(clock.getDelta());
            }

            // Play idle animations
            playIdleAnimation();

            renderer.render(scene, window.__camera);
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            if (renderer) {
                renderer.setSize(window.innerWidth, window.innerHeight);
            }
        });

        // Initialize when ready
        if (document.readyState === 'complete') {
            initAvatar();
        } else {
            window.addEventListener('load', initAvatar);
        }
    </script>
</body>
</html>
    `;

    // Fallback for web platform
    if (!WebView || Platform.OS === 'web') {
        return (
            <View style={styles.fallbackContainer}>
                <Text style={styles.fallbackText}>🎭 Avatar View</Text>
                <Text style={styles.fallbackSubtext}>(Web platform - use native build)</Text>
                <Text style={styles.transcriptText}>{transcriptText}</Text>
            </View>
        );
    }

    if (visible === false) return null;

    return (
        <View style={styles.container}>
            {errorMessage && (
                <View style={styles.errorOverlay}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            )}

            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>Loading Avatar...</Text>
                </View>
            )}

            <WebView
                ref={webViewRef}
                source={{ html: htmlContent }}
                onMessage={handleMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                style={styles.webview}
                scalesPageToFit={true}
                scrollEnabled={false}
                bounces={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 400,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#667eea',
        position: 'relative',
        marginVertical: 12,
    },
    webview: {
        flex: 1,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(102, 126, 234, 0.9)',
        zIndex: 5,
    },
    loadingText: {
        color: '#fff',
        marginTop: 12,
        fontSize: 14,
    },
    errorOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    errorIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    errorText: {
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    fallbackContainer: {
        height: 300,
        backgroundColor: '#667eea',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 12,
    },
    fallbackText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    fallbackSubtext: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 4,
    },
    transcriptText: {
        color: '#fff',
        fontSize: 14,
        marginTop: 12,
        paddingHorizontal: 20,
        textAlign: 'center',
    },
});
