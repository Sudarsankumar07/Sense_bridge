import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { detectGesture, detectEmotion } from '../services/gestureMapping';

let WebView: any = null;
try {
    WebView = require('react-native-webview').WebView;
} catch {
    // WebView not available (e.g. web platform or missing native module)
}

interface AvatarViewProps {
    transcriptText: string;
    visible?: boolean;
    emotion?: string;
    onReady?: () => void;
    onError?: (error: string) => void;
}

interface AvatarMessage {
  type: 'ready' | 'speaking' | 'gesture' | 'mood' | 'stopped' | 'error' | 'debug';
    status?: string;
    text?: string;
    emotion?: string;
    gesture?: string;
    mood?: string;
    error?: string;
}

export const AvatarView: React.FC<AvatarViewProps> = ({ 
    transcriptText, 
    visible = true,
    emotion,
    onReady,
    onError
}) => {
    const webViewRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const lastTranscriptRef = useRef('');
    const transcriptQueueRef = useRef<string[]>([]);
    const isProcessingRef = useRef(false);

    // Handle messages from WebView
    const handleMessage = useCallback((event: any) => {
        try {
            const data: AvatarMessage = JSON.parse(event.nativeEvent.data);
            
            switch (data.type) {
                case 'ready':
                    console.log('[AvatarView] Avatar ready');
                    setIsReady(true);
                    setIsLoading(false);
                    setErrorMessage(null);
                  processQueue();
                    onReady?.();
                    break;
                    
                case 'error':
                    console.error('[AvatarView] Avatar error:', data.error);
                    setErrorMessage(data.error || 'Unknown error');
                    setIsLoading(false);
                    onError?.(data.error || 'Unknown error');
                    break;
                    
                case 'speaking':
                    console.log('[AvatarView] Speaking:', data.text);
                    isProcessingRef.current = true;
                    break;
                    
                case 'stopped':
                    console.log('[AvatarView] Stopped speaking');
                    isProcessingRef.current = false;
                    processQueue();
                    break;

                case 'debug':
                  console.log('[AvatarView][WebView]', data.status || data.text || 'debug');
                  break;
                    
                default:
                    console.log('[AvatarView] Message:', data);
            }
        } catch (e) {
            console.error('[AvatarView] Failed to parse message:', e);
        }
    }, [onReady, onError]);

    // Process queued transcripts
    const processQueue = useCallback(() => {
        if (isProcessingRef.current || transcriptQueueRef.current.length === 0) {
            return;
        }

        const nextTranscript = transcriptQueueRef.current.shift();
        if (nextTranscript && webViewRef.current) {
            sendTranscript(nextTranscript);
        }
    }, []);

    // Send transcript to avatar
    const sendTranscript = useCallback((text: string) => {
        if (!isReady || !webViewRef.current) {
            return;
        }

        // Detect gesture and emotion from text
        const { gesture, emotion: detectedEmotion } = detectGesture(text);
        const sentimentEmotion = detectEmotion(text);
        const finalEmotion = emotion || detectedEmotion || sentimentEmotion;

        // Escape text for JavaScript
        const escapedText = text
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');

        // Build JavaScript code
        let jsCode = `
            (function() {
                try {
                    if (window.handleTranscript) {
                        window.handleTranscript('${escapedText}', '${finalEmotion}');
                        ${gesture ? `setTimeout(() => window.playGesture('${gesture}'), 100);` : ''}
                        return true;
                    }
                    return false;
                } catch (e) {
                    console.error('Avatar error:', e);
                    return false;
                }
            })();
        `;

        webViewRef.current.injectJavaScript(jsCode);
        isProcessingRef.current = true;

        // Auto-release after timeout
        setTimeout(() => {
            if (isProcessingRef.current) {
                isProcessingRef.current = false;
                processQueue();
            }
        }, 5000);
    }, [isReady, emotion]);

    // Handle new transcript
    useEffect(() => {
        if (!transcriptText || !visible || transcriptText === lastTranscriptRef.current) {
            return;
        }

        lastTranscriptRef.current = transcriptText;

        if (!isReady) {
            console.log('[AvatarView] Avatar not ready, queuing transcript');
          transcriptQueueRef.current.push(transcriptText);
            return;
        }

        // Add to queue
        transcriptQueueRef.current.push(transcriptText);
        processQueue();

    }, [transcriptText, visible, isReady, processQueue]);

    useEffect(() => {
      const timer = setTimeout(() => {
        if (!isReady) {
          const msg = 'Avatar startup timeout. Check internet or WebView module support.';
          setIsLoading(false);
          setErrorMessage(msg);
          onError?.(msg);
        }
      }, 20000);

      return () => clearTimeout(timer);
    }, [isReady, onError]);

    // Determine WebView source
    const getWebViewSource = () => {
        // For Expo, we need to use require() to bundle the HTML
        // This won't work directly, so we'll use inline HTML instead
        return { html: getInlineHTML() };
    };

    // Generate inline HTML with proper asset paths
    const getInlineHTML = () => {
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>SenseBridge Avatar</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; touch-action: none; }
    body {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #avatar-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block; }
    #status {
      position: absolute; top: 10px; left: 10px; color: rgba(255, 255, 255, 0.8);
      font-size: 12px; background: rgba(0, 0, 0, 0.3); padding: 5px 10px;
      border-radius: 5px; z-index: 10; pointer-events: none;
    }
    #loading {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      color: white; font-size: 16px; text-align: center; z-index: 5;
    }
    .spinner {
      border: 3px solid rgba(255, 255, 255, 0.3); border-top: 3px solid white;
      border-radius: 50%; width: 40px; height: 40px;
      animation: spin 1s linear infinite; margin: 0 auto 10px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <div>Loading Avatar...</div>
  </div>
  <div id="status">Initializing...</div>
  <canvas id="avatar-canvas"></canvas>

  <script>
    (function() {
      function rnPost(payload) {
        try {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        } catch (e) {}
      }

      rnPost({ type: 'debug', status: 'HTML booted' });

      window.addEventListener('error', function(evt) {
        rnPost({ type: 'error', error: 'Window error: ' + (evt.message || 'unknown') });
      });

      window.addEventListener('unhandledrejection', function(evt) {
        const reason = evt && evt.reason ? (evt.reason.message || String(evt.reason)) : 'unknown';
        rnPost({ type: 'error', error: 'Unhandled rejection: ' + reason });
      });

      setTimeout(function() {
        if (!window.__avatarModuleBooted) {
          rnPost({ type: 'error', error: 'Module script did not start. Android System WebView may be outdated.' });
        }
      }, 12000);
    })();
  </script>

  <script async src="https://ga.jspm.io/npm:es-module-shims@1.10.0/dist/es-module-shims.js"></script>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"
    }
  }
  </script>

  <script type="module">
    // Use TalkingHead module URL where relative dynamic imports resolve under /modules.
    const TALKINGHEAD_CDN = 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/modules/talkinghead.mjs';
    // Fallback CDN for environments where jsDelivr is blocked.
    const TALKINGHEAD_FALLBACK_CDN = 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@main/modules/talkinghead.mjs';
    // Use TalkingHead's sample avatar hosted in the same CDN family.
    const AVATAR_MODEL_URL = 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/avatars/brunette.glb';
    
    let head = null;
    let isReady = false;
    const statusEl = document.getElementById('status');
    const loadingEl = document.getElementById('loading');

    function updateStatus(message) {
      statusEl.textContent = message;
      console.log('[Avatar]', message);
    }

    function postMessage(data) {
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(data));
        }
      } catch (e) {
        console.error('Failed to post message:', e);
      }
    }

    async function initAvatar() {
      if (window.__avatarInitStarted) return;
      window.__avatarInitStarted = true;
      window.__avatarModuleBooted = true;

      try {
        updateStatus('Loading TalkingHead library...');
        
        // Dynamically import TalkingHead from CDN
        let module = null;
        try {
          module = await import(TALKINGHEAD_CDN);
        } catch (primaryErr) {
          console.warn('Primary CDN failed, trying fallback CDN...', primaryErr);
          updateStatus('Retrying library load...');
          module = await import(TALKINGHEAD_FALLBACK_CDN);
        }
        const TalkingHead = module.TalkingHead || module.default?.TalkingHead || module.default;

        if (!TalkingHead) {
          throw new Error('TalkingHead module failed to load');
        }
        
        updateStatus('Creating avatar instance...');
        const canvas = document.getElementById('avatar-canvas');
        
        head = new TalkingHead(canvas, {
          ttsLang: 'en-US',
          lipsyncLang: 'en',
          lipsyncModules: ['en'],
          avatarMood: 'neutral',
          cameraView: 'upper',
          cameraDistance: 0.5,
          cameraX: 0,
          cameraY: 0.05,
          avatarIdleEyeContact: 0.5,
          avatarIdleHeadMove: 0.3,
          avatarSpeakingEyeContact: 0.7,
          avatarSpeakingHeadMove: 0.5,
          modelPixelRatio: Math.min(window.devicePixelRatio, 2),
          modelFPS: 30
        });

        updateStatus('Loading avatar model...');

        // Use stable sample avatar from TalkingHead repository.
        await head.showAvatar({
          url: AVATAR_MODEL_URL,
          body: 'F',
          avatarMood: 'neutral',
          lipsyncLang: 'en'
        }, (url, event) => {
          if (event && event.lengthComputable && event.total) {
            const percent = Math.round((event.loaded / event.total) * 100);
            updateStatus(\`Loading: \${percent}%\`);
          }
        });

        updateStatus('Avatar ready');
        loadingEl.style.display = 'none';
        isReady = true;

        postMessage({ type: 'ready', status: 'Avatar initialized successfully' });

      } catch (error) {
        console.error('Avatar initialization error:', error);
        updateStatus('Error: ' + error.message);
        window.__avatarInitStarted = false;
        postMessage({ type: 'error', error: error.message });
      }
    }

    window.handleTranscript = function(text, emotion = 'neutral') {
      if (!isReady || !head) {
        console.warn('Avatar not ready');
        return false;
      }
      try {
        updateStatus(\`Speaking: "\${text}"\`);
        head.speakText(text, { mood: emotion, lipsyncLang: 'en' });
        postMessage({ type: 'speaking', text, emotion });
        return true;
      } catch (error) {
        console.error('Speak error:', error);
        postMessage({ type: 'error', error: error.message });
        return false;
      }
    };

    window.playGesture = function(gestureName) {
      if (!isReady || !head) {
        console.warn('Avatar not ready');
        return false;
      }
      try {
        updateStatus(\`Gesture: \${gestureName}\`);
        head.playGesture(gestureName);
        postMessage({ type: 'gesture', gesture: gestureName });
        return true;
      } catch (error) {
        console.error('Gesture error:', error);
        return false;
      }
    };

    window.setMood = function(mood) {
      if (!isReady || !head) {
        console.warn('Avatar not ready');
        return false;
      }
      try {
        head.setMood(mood);
        updateStatus(\`Mood: \${mood}\`);
        postMessage({ type: 'mood', mood });
        return true;
      } catch (error) {
        console.error('Mood error:', error);
        return false;
      }
    };

    window.stopSpeaking = function() {
      if (!isReady || !head) return false;
      try {
        head.stopSpeaking();
        updateStatus('Stopped speaking');
        postMessage({ type: 'stopped' });
        return true;
      } catch (error) {
        console.error('Stop error:', error);
        return false;
      }
    };

    window.getStatus = function() {
      return { ready: isReady, speaking: head ? head.isSpeaking() : false };
    };

    window.addEventListener('resize', () => {
      if (head) {
        const canvas = document.getElementById('avatar-canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    });

    window.addEventListener('load', () => { initAvatar(); });
    if (document.readyState === 'complete') { initAvatar(); }
  </script>
</body>
</html>
        `;
    };

    // Fallback for web or missing WebView
    if (!WebView || Platform.OS === 'web') {
        return (
            <View style={[styles.container, !visible && styles.hidden]}>
                <View style={styles.fallbackContainer}>
                    <Text style={styles.fallbackText}>
                        🎭 Avatar View
                    </Text>
                    <Text style={styles.fallbackSubtext}>
                        (Requires native build)
                    </Text>
                    {transcriptText && (
                        <View style={styles.transcriptBox}>
                            <Text style={styles.transcriptLabel}>Speaking:</Text>
                            <Text style={styles.transcriptText}>{transcriptText}</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, !visible && styles.hidden]}>
            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#667eea" />
                    <Text style={styles.loadingText}>Loading Avatar...</Text>
                </View>
            )}
            
            {errorMessage && (
                <View style={styles.errorOverlay}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            )}

            <WebView
                ref={webViewRef}
                source={getWebViewSource()}
                onMessage={handleMessage}
                onLoadEnd={() => {
                    console.log('[AvatarView] WebView loaded');
                }}
                onError={(syntheticEvent: any) => {
                    const { nativeEvent } = syntheticEvent;
                    console.error('[AvatarView] WebView error:', nativeEvent);
                    setErrorMessage('Failed to load avatar');
                    setIsLoading(false);
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowFileAccess={true}
                allowUniversalAccessFromFileURLs={true}
                mixedContentMode="always"
                originWhitelist={['*']}
                style={styles.webview}
                startInLoadingState={false}
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback={true}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 300,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#667eea',
        position: 'relative',
    },
    hidden: {
        display: 'none',
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(102, 126, 234, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    loadingText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 12,
        fontWeight: '600',
    },
    errorOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(220, 53, 69, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        padding: 20,
    },
    errorIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    errorText: {
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
    },
    fallbackContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'rgba(102, 126, 234, 0.9)',
    },
    fallbackText: {
        color: '#fff',
        fontSize: 32,
        marginBottom: 8,
    },
    fallbackSubtext: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
        marginBottom: 20,
    },
    transcriptBox: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        padding: 16,
        borderRadius: 12,
        width: '100%',
        marginTop: 20,
    },
    transcriptLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    transcriptText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
