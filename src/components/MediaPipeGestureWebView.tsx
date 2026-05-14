import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// ─── Public API exposed through the ref ────────────────────────────────────

export interface MediaPipeGestureWebViewRef {
    /** Send a JPEG base64 frame (no data-uri prefix) to the WASM recognizer */
    sendFrame: (base64: string) => void;
}

// ─── Result shape sent back to the parent ──────────────────────────────────

export interface MPGestureResult {
    gesture: string;   // 'Thumb_Up' | 'None' | etc.
    score: number;     // 0.0 – 1.0
    landmarks: Array<{ x: number; y: number; z: number }>;
}

// ─── Local asset URIs provided after on-device caching ─────────────────────

export interface MPLocalAssets {
    /**
     * file:// URI of the pre-written mediapipe.html on device storage.
     * The page uses relative paths so WASM + model load locally with no CDN.
     */
    htmlUri: string;
}

interface Props {
    onReady?: () => void;
    onResult?: (result: MPGestureResult) => void;
    onError?: (message: string) => void;
    /**
     * RC-3 FIX: When provided, MediaPipe loads from device storage (file:// URI).
     * When omitted, falls back to CDN.
     */
    localAssets?: MPLocalAssets;
}

// ─── CDN fallback HTML ─────────────────────────────────────────────────────
// Used only when localAssets are not yet ready. When local assets ARE ready,
// the WebView loads mediapipe.html from disk via source={{ uri: htmlUri }}
// which gives a real file:// page origin — no script-src blocking.

const CDN_FALLBACK_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>body{margin:0;background:#000;}</style>
</head>
<body>
<canvas id="c" style="display:none;"></canvas>
<script>
(function() {
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/vision_bundle.js';
  script.crossOrigin = 'anonymous';
  script.onload = initRecognizer;
  script.onerror = function() {
    postToRN({ type: 'error', message: 'Failed to load MediaPipe bundle from CDN' });
  };
  document.head.appendChild(script);
})();

var recognizer = null;
var lastTimestampMs = 0;
var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');

function postToRN(obj) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  }
}

async function initRecognizer() {
  try {
    var vision = window.MediaPipeTasksVision;
    if (!vision) {
      postToRN({ type: 'error', message: 'MediaPipeTasksVision not found on window' });
      return;
    }
    var FilesetResolver = vision.FilesetResolver;
    var GestureRecognizer = vision.GestureRecognizer;

    var wasmFileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm'
    );

    recognizer = await GestureRecognizer.createFromOptions(wasmFileset, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
        delegate: 'CPU'
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5
    });

    postToRN({ type: 'ready' });
  } catch (err) {
    postToRN({ type: 'error', message: String(err && err.message ? err.message : err) });
  }
}

// Global function called by React Native via injectJavaScript.
// This is the ONLY reliable RN→WebView communication method on Android.
window.handleFrameFromRN = function(base64) {
  if (!recognizer || !base64) return;
  var img = new Image();
  img.onload = function() {
    try {
      var ts = Date.now();
      if (ts <= lastTimestampMs) ts = lastTimestampMs + 1;
      lastTimestampMs = ts;

      canvas.width = img.naturalWidth || 320;
      canvas.height = img.naturalHeight || 240;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      var result = recognizer.recognizeForVideo(canvas, ts);
      var gesture = (result.gestures && result.gestures[0] && result.gestures[0][0]);
      var landmarks = (result.landmarks && result.landmarks[0]) || [];

      postToRN({
        type: 'result',
        gesture: gesture ? gesture.categoryName : 'None',
        score:   gesture ? gesture.score : 0,
        landmarks: landmarks.map(function(lm) {
          return { x: lm.x, y: lm.y, z: lm.z };
        })
      });
    } catch (recognizeErr) {
      postToRN({ type: 'error', message: String(recognizeErr && recognizeErr.message ? recognizeErr.message : recognizeErr) });
    }
  };
  img.onerror = function() {
    postToRN({ type: 'error', message: 'Could not decode base64 image' });
  };
  img.src = 'data:image/jpeg;base64,' + base64;
};
</script>
</body>
</html>`;

// ─── Component ──────────────────────────────────────────────────────────────

export const MediaPipeGestureWebView = forwardRef<MediaPipeGestureWebViewRef, Props>(
    ({ onReady, onResult, onError, localAssets }, ref) => {
        const webViewRef = useRef<WebView>(null);

        // Expose sendFrame() to the parent via ref
        useImperativeHandle(ref, () => ({
            sendFrame(base64: string) {
                if (!webViewRef.current) return;
                // CRITICAL FIX: Use injectJavaScript, NOT postMessage.
                // In react-native-webview v13+, postMessage() is deprecated and
                // does NOT reliably deliver messages to the WebView on Android.
                // injectJavaScript runs code directly in the WebView JS context.
                const escaped = base64.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                webViewRef.current.injectJavaScript(`
                    (function() {
                        try {
                            if (typeof handleFrameFromRN === 'function') {
                                handleFrameFromRN('${escaped}');
                            }
                        } catch(e) {
                            if (window.ReactNativeWebView) {
                                window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'injectJS: '+e.message}));
                            }
                        }
                    })();
                    true;
                `);
            },
        }), []);

        const handleMessage = (event: WebViewMessageEvent) => {
            try {
                const data = JSON.parse(event.nativeEvent.data);
                switch (data.type) {
                    case 'ready':
                        onReady?.();
                        break;
                    case 'result':
                        onResult?.({
                            gesture: data.gesture ?? 'None',
                            score: typeof data.score === 'number' ? data.score : 0,
                            landmarks: Array.isArray(data.landmarks) ? data.landmarks : [],
                        });
                        break;
                    case 'error':
                        console.warn('[MediaPipe]', data.message);
                        onError?.(data.message ?? 'Unknown MediaPipe error');
                        break;
                    default:
                        break;
                }
            } catch {
                // Ignore non-JSON messages
            }
        };

        /**
         * RC-5 FIX: Zero-size overflow wrapper keeps the WebView in the Android
         * layout tree (prevents WASM throttling) without being visible to the user.
         *
         * source logic:
         *   - localAssets.htmlUri available → load from file:// (real file origin,
         *     relative paths work, zero CDN dependency)
         *   - not available → inline CDN HTML fallback
         */
        return (
            <View style={styles.hiddenWrapper} pointerEvents="none">
                <WebView
                    ref={webViewRef}
                    style={styles.webView}
                    source={
                        localAssets?.htmlUri
                            ? { uri: localAssets.htmlUri }
                            : { html: CDN_FALLBACK_HTML, baseUrl: 'about:blank' }
                    }
                    originWhitelist={['*']}
                    javaScriptEnabled
                    domStorageEnabled
                    mixedContentMode="always"
                    allowFileAccess
                    allowUniversalAccessFromFileURLs
                    allowFileAccessFromFileURLs
                    onMessage={handleMessage}
                    onError={(e) =>
                        onError?.(e.nativeEvent.description ?? 'WebView load error')
                    }
                />
            </View>
        );
    }
);

MediaPipeGestureWebView.displayName = 'MediaPipeGestureWebView';

const styles = StyleSheet.create({
    /**
     * RC-5 FIX: Zero-size overflow wrapper — WebView stays in layout tree
     * (prevents Android WASM throttling) but is invisible to the user.
     */
    hiddenWrapper: {
        position: 'absolute',
        width: 0,
        height: 0,
        overflow: 'hidden',
        bottom: 0,
        right: 0,
    },
    webView: {
        width: 1,
        height: 1,
    },
});
