/**
 * useMediaPipeAssets
 *
 * Downloads all MediaPipe files to device storage on first launch, reads
 * vision_bundle.js as UTF-8 text, then writes a self-contained mediapipe.html
 * with the bundle INLINED as a <script> block — no <script src> file:// loading,
 * which is blocked by Android WebView security regardless of allowFileAccess.
 *
 * WASM and model files are still loaded via relative paths since the page has
 * a real file:// origin (loaded via source={{ uri }}).
 */
import { useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

const MP_VERSION = '0.10.15';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

// Bump suffix when you need to invalidate the cache
const CACHE_DIR = `${FileSystem.documentDirectory}mediapipe_${MP_VERSION}h/`;
const WASM_DIR  = `${CACHE_DIR}wasm/`;
const HTML_PATH = `${CACHE_DIR}mediapipe.html`;

const BUNDLE_PATH = `${CACHE_DIR}vision_bundle.cjs`;

const DOWNLOAD_PLAN = [
    // NOTE: This package has NO UMD build. Only .mjs (ESM) and .cjs (CommonJS).
    // We use the CJS build and shim exports → window.MediaPipeTasksVision.
    { url: 'https://unpkg.com/@mediapipe/tasks-vision@0.10.15/vision_bundle.cjs', path: BUNDLE_PATH },
    { url: `${CDN}/wasm/vision_wasm_internal.js`,          path: `${WASM_DIR}vision_wasm_internal.js` },
    { url: `${CDN}/wasm/vision_wasm_internal.wasm`,        path: `${WASM_DIR}vision_wasm_internal.wasm` },
    { url: `${CDN}/wasm/vision_wasm_nosimd_internal.js`,   path: `${WASM_DIR}vision_wasm_nosimd_internal.js` },
    { url: `${CDN}/wasm/vision_wasm_nosimd_internal.wasm`, path: `${WASM_DIR}vision_wasm_nosimd_internal.wasm` },
    { url: MODEL_URL,                                       path: `${CACHE_DIR}gesture_recognizer.task` },
];

/**
 * Build the self-contained HTML with the CJS bundle inlined.
 *
 * The CJS bundle does:
 *   exports.FilesetResolver = ...
 *   exports.GestureRecognizer = ...
 *
 * We provide a fake 'exports' and 'module' object, let the bundle fill it,
 * then copy everything onto window.MediaPipeTasksVision.
 */
function buildHtml(bundleCode: string): string {
    // Escape </script> inside the bundle to prevent HTML parser breakage
    const safeBundleCode = bundleCode.replace(/<\/script>/gi, '<\\/script>');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><style>body{margin:0;background:#000;}</style></head>
<body>
<canvas id="c" style="display:none;"></canvas>
<script>
// ── fetch() polyfill for file:// URLs ──────────────────────────────────
// Android WebView's native fetch() does NOT support file:// URLs even when
// allowFileAccessFromFileURLs is true. But XMLHttpRequest DOES work.
// MediaPipe's FilesetResolver.forVisionTasks('./wasm') calls fetch() for
// the WASM binary + JS loader, so we intercept and use XHR instead.
(function() {
  var originalFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
    // Only intercept relative paths and file:// URLs
    if (url.indexOf('http') === 0) {
      return originalFetch.call(window, input, init);
    }
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      // Detect binary files by extension
      if (/\\.(wasm|task|tflite|bin)$/i.test(url)) {
        xhr.responseType = 'arraybuffer';
      } else {
        xhr.responseType = 'text';
      }
      xhr.onload = function() {
        if (xhr.status === 0 || xhr.status === 200) {
          var headers = new Headers();
          if (xhr.responseType === 'arraybuffer') {
            headers.set('content-type', 'application/octet-stream');
            resolve(new Response(xhr.response, { status: 200, headers: headers }));
          } else {
            headers.set('content-type', url.endsWith('.js') ? 'application/javascript' : 'text/plain');
            resolve(new Response(xhr.responseText, { status: 200, headers: headers }));
          }
        } else {
          reject(new Error('XHR failed: ' + xhr.status + ' for ' + url));
        }
      };
      xhr.onerror = function() { reject(new Error('XHR network error for ' + url)); };
      xhr.send();
    });
  };
})();
</script>
<script>
// CJS shim: the bundle writes to exports.X — we capture them all
// and expose as window.MediaPipeTasksVision after execution.
var exports = {};
var module = { exports: exports };
${safeBundleCode}
// Now exports contains FilesetResolver, GestureRecognizer, etc.
window.MediaPipeTasksVision = module.exports || exports;
</script>
<script>
function postToRN(obj) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
}
async function initRecognizer() {
  try {
    var vision = window.MediaPipeTasksVision;
    if (!vision) {
      postToRN({type:'error', message:'MediaPipeTasksVision not found — bundle did not set global'});
      return;
    }
    var wasmFileset = await vision.FilesetResolver.forVisionTasks('./wasm');
    var recognizer  = await vision.GestureRecognizer.createFromOptions(wasmFileset, {
      baseOptions: { modelAssetPath: './gesture_recognizer.task', delegate: 'CPU' },
      runningMode: 'VIDEO', numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5
    });
    postToRN({type:'ready'});
    var lastTs = 0;
    var canvas = document.getElementById('c');
    var ctx    = canvas.getContext('2d');

    // Expose a global function that React Native calls via injectJavaScript.
    // This is the ONLY reliable RN→WebView communication path on Android.
    // (window.addEventListener('message') does NOT work on Android because
    // react-native-webview v13 dispatches on 'document', not 'window'.)
    window.handleFrameFromRN = function(base64) {
      if (!recognizer || !base64) return;
      var img = new Image();
      img.onload = function() {
        try {
          var ts = Date.now();
          if (ts <= lastTs) ts = lastTs + 1;
          lastTs = ts;
          canvas.width  = img.naturalWidth  || 320;
          canvas.height = img.naturalHeight || 240;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          var result = recognizer.recognizeForVideo(canvas, ts);
          var g  = result.gestures  && result.gestures[0]  && result.gestures[0][0];
          var lm = (result.landmarks && result.landmarks[0]) || [];
          postToRN({
            type: 'result',
            gesture:   g  ? g.categoryName : 'None',
            score:     g  ? g.score : 0,
            landmarks: lm.map(function(l) { return {x:l.x, y:l.y, z:l.z}; })
          });
        } catch(re) {
          postToRN({type:'error', message:String(re && re.message ? re.message : re)});
        }
      };
      img.onerror = function() {
        postToRN({type:'error', message:'Could not decode base64 image'});
      };
      img.src = 'data:image/jpeg;base64,' + base64;
    };
  } catch(err) {
    postToRN({type:'error', message:String(err && err.message ? err.message : err)});
  }
}
initRecognizer();
</script>
</body>
</html>`;
}

export interface MediaPipeAssets {
    status: 'idle' | 'downloading' | 'ready' | 'error';
    progress: number;
    currentFile: string;
    htmlUri: string | null;
    error: string | null;
}

async function exists(path: string): Promise<boolean> {
    try {
        const info = await FileSystem.getInfoAsync(path);
        return info.exists && (info as any).size > 0;
    } catch {
        return false;
    }
}

export function useMediaPipeAssets(): MediaPipeAssets {
    const [status, setStatus]           = useState<MediaPipeAssets['status']>('idle');
    const [progress, setProgress]       = useState(0);
    const [currentFile, setCurrentFile] = useState('');
    const [htmlUri, setHtmlUri]         = useState<string | null>(null);
    const [error, setError]             = useState<string | null>(null);
    const started = useRef(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        (async () => {
            try {
                setStatus('downloading');

                await FileSystem.makeDirectoryAsync(WASM_DIR, { intermediates: true });

                const total = DOWNLOAD_PLAN.length;
                for (let i = 0; i < total; i++) {
                    const { url, path } = DOWNLOAD_PLAN[i];
                    setCurrentFile(path.split('/').pop() ?? '');

                    if (!(await exists(path))) {
                        const dl = FileSystem.createDownloadResumable(url, path, {},
                            (prog) => {
                                const s = 1 / total;
                                const f = prog.totalBytesExpectedToWrite > 0
                                    ? prog.totalBytesWritten / prog.totalBytesExpectedToWrite : 0;
                                setProgress((i / total) + s * f);
                            }
                        );
                        await dl.downloadAsync();
                    }
                    setProgress((i + 1) / total);
                }

                // Read the downloaded bundle as text and inline it into the HTML.
                // This is the key fix: avoids <script src="file://"> which Android blocks.
                setCurrentFile('Building mediapipe.html…');
                const bundleCode = await FileSystem.readAsStringAsync(BUNDLE_PATH, {
                    encoding: FileSystem.EncodingType.UTF8,
                });
                await FileSystem.writeAsStringAsync(HTML_PATH, buildHtml(bundleCode), {
                    encoding: FileSystem.EncodingType.UTF8,
                });

                setHtmlUri(HTML_PATH);
                setStatus('ready');
            } catch (err: any) {
                const msg = err?.message ?? 'Failed to prepare MediaPipe assets';
                console.error('[MediaPipeAssets] Failed:', msg);
                setError(msg);
                setStatus('error');
            }
        })();
    }, []);

    return { status, progress, currentFile, htmlUri, error };
}
