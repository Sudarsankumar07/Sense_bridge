# RCA: MediaPipe Sign Language Recognition — Not Working

**Project:** SenseBridge  
**Date:** 2026-05-08  
**Affected Feature:** Sign Mode Screen — ISL Gesture Detection  
**Severity:** 🔴 Critical (feature completely non-functional)

---

## Executive Summary

The MediaPipe gesture recognizer **never returns a result** because of a fundamental **race condition and async communication mismatch** in the WebView bridge architecture. The screen sends a frame to the WASM engine inside a WebView, then **immediately reads `mp.lastResult`** — before the asynchronous recognition response has had any chance to arrive. Every capture cycle reads stale or `null` data, making the feature appear completely broken.

---

## System Architecture (Before RCA)

```
SignModeScreen (loop, every 4.5s)
    │
    ├─ captureFrame()              → JPEG base64 from camera
    │
    ├─ mp.sendFrame(base64)        → postMessage → WebView
    │       │
    │       └─ [WASM inside WebView] → image decode → recognizeForVideo() → postMessage back → onResult() → setLastResult()
    │                                                  (async, ~50-200ms later)
    │
    └─ mp.lastResult               ← READ IMMEDIATELY ← ❌ Result not here yet!
```

---

## Root Causes (Ranked by Impact)

### 🔴 RC-1 — CRITICAL: Read-After-Send Race Condition (Primary Cause)

**Location:** `SignModeScreen.tsx` lines 106–110  
**File:** `src/screens/SignModeScreen.tsx`

```typescript
// line 106
mp.sendFrame(frame.base64);       // ① Sends frame to WebView asynchronously
// line 107
const mpResult = mp.lastResult;   // ② Reads result IMMEDIATELY — still null!
```

`sendFrame()` posts a message to the WebView via `webViewRef.current.postMessage()`. The WebView receives it, decodes the JPEG image, draws it to canvas, calls WASM `recognizeForVideo()`, serializes the result, and posts it back. This entire round-trip takes **50–300 ms** on a typical device.

The screen reads `mp.lastResult` **on the next line** — synchronously — which is always the **previous frame's result** (or `null` on the first call). Every detection cycle is off-by-one at best, and always `null` on the very first frame.

**Effect:** `mpMapped` is always `null` → no sign is ever displayed → user sees "Waiting for sign…" forever.

---

### 🟠 RC-2 — HIGH: `lastResult` is React State — Stale Closure in Async Loop

**Location:** `useMediaPipeGesture.ts` lines 35–36, 54–56  
**File:** `src/hooks/useMediaPipeGesture.ts`

```typescript
const [lastResult, setLastResult] = useState<MPGestureResult | null>(null);
```

`lastResult` is stored as **React state**. The detection loop in `SignModeScreen` captures `mp.lastResult` in a closure from `useEffect`. React state updates are batched and asynchronous — the value the loop reads inside the effect closure is the **snapshot from the time the effect was created**, not the latest value.

Even if RC-1 were fixed with a short wait, the loop would still read a stale `lastResult` from the closure. A `useRef` is needed to hold the latest result for synchronous reads inside async loops.

---

### 🟠 RC-3 — HIGH: CDN Dependencies (25MB WASM) — Likely Init Failure on Device

**Location:** `MediaPipeGestureWebView.tsx` lines 46–77  
**File:** `src/components/MediaPipeGestureWebView.tsx`

The WebView loads two external resources over the network on every cold start:

| Resource | Size | URL |
|---|---|---|
| `vision_bundle.js` | ~3–5 MB | `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/vision_bundle.js` |
| WASM fileset | ~20–25 MB | `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm` |
| Model `.task` file | ~15 MB | `storage.googleapis.com/mediapipe-models/...` |

**Problems:**
- A **network-restricted or slow Android device** (common in India) will cause `script.onerror` → fires `'Failed to load MediaPipe bundle from CDN'` → `onError()` is called → **but `isReady` never becomes `true`**.
- The `sendFrame()` function in the hook **silently returns early** if `!isReady`. So the user never sees an error — the scanner just never produces results.
- The model `.task` file is served from **Google Storage** — if the device has Google connectivity issues, this silently fails inside the WASM init.

---

### 🟡 RC-4 — MEDIUM: No Timeout / Fallback for `isReady`

**Location:** `SignModeScreen.tsx` line 88; `useMediaPipeGesture.ts`

`isReady` starts as `false` and only becomes `true` when `onReady()` fires from the WebView. If the CDN fails or the WASM init throws, `isReady` stays `false` forever. The detection loop still runs (it calls `setIsScanning(true)` and shows the pulse animation) but `sendFrame()` is a silent no-op. 

**Effect:** The UI shows the camera scanning animation normally — giving the user no indication that MediaPipe has completely failed to initialize.

---

### 🟡 RC-5 — MEDIUM: WebView Rendered Off-Screen with Opacity 0 — Android WebView Throttling

**Location:** `MediaPipeGestureWebView.tsx` lines 212–221

```typescript
hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    top: -9999,
    left: -9999,
},
```

Android (and some WebView implementations) **throttle or suspend JavaScript execution** in WebViews that are:
- Positioned off-screen (`top: -9999`)
- Have `opacity: 0`
- Are `1×1` pixels in size

This can cause the WASM worker to slow down dramatically or stop responding, depending on the Android version and WebView implementation.

---

### 🟡 RC-6 — MEDIUM: `CAPTURE_INTERVAL_MS = 4500` — Too Slow for Gesture Recognition

**Location:** `SignModeScreen.tsx` line 30

```typescript
const CAPTURE_INTERVAL_MS = 4500;
```

Even if the pipeline were working, capturing one frame every **4.5 seconds** makes gesture recognition nearly unusable. Gestures need to be held perfectly still for 4.5s to be captured during the right polling window. The MediaPipe engine supports real-time `VIDEO` mode (up to ~30fps via `runningMode: 'VIDEO'`) — polling every 4.5s wastes this entirely.

The tip text on line 269 says "Detection runs every 2.5 seconds" — which doesn't match the actual `4500ms` interval, indicating the value was changed without updating the UI copy.

---

### 🟢 RC-7 — LOW: `gestureToISL.ts` — Only 7 Gestures, No Fingerspelling

**Location:** `src/services/mediapipe/gestureToISL.ts`

The `GESTURE_MAP` only covers MediaPipe's 7 built-in gesture categories (Thumb_Up, Closed_Fist, etc.). **ISL fingerspelling (A–Z)** is not covered — the architecture relies on MediaPipe's stock recognizer which was never trained on ISL. Custom ISL gestures would require a fine-tuned `.task` model, not the default `gesture_recognizer.task`.

---

## Evidence Summary

| # | Root Cause | File | Lines | Impact |
|---|---|---|---|---|
| RC-1 | Read-after-send race condition | `SignModeScreen.tsx` | 106–110 | 🔴 Feature broken |
| RC-2 | Stale React state closure in async loop | `useMediaPipeGesture.ts` | 35–36 | 🟠 Wrong results even if timing fixed |
| RC-3 | CDN WASM download fails silently | `MediaPipeGestureWebView.tsx` | 46–91 | 🟠 Init failure with no UX feedback |
| RC-4 | No `isReady` timeout or error state | `useMediaPipeGesture.ts` / `SignModeScreen.tsx` | — | 🟡 Silent failure |
| RC-5 | Off-screen WebView causes Android throttling | `MediaPipeGestureWebView.tsx` | 212–221 | 🟡 WASM execution slowed/stopped |
| RC-6 | 4500ms interval too slow | `SignModeScreen.tsx` | 30 | 🟡 Unusable even if working |
| RC-7 | Only 7 stock gestures — no ISL signs | `gestureToISL.ts` | 22–58 | 🟢 Feature gap |

---

## Fix Summary (Not Yet Implemented — Pending Approval)

| Priority | Fix | Approach |
|---|---|---|
| 🔴 P0 | Fix race condition | Change `lastResult` from React state to a `useRef` so the loop can read the latest value without closure staleness. Await the result with a short promise or use a `useEffect` reaction pattern |
| 🟠 P1 | Prevent silent failure on CDN error | Surface `isReady === false` after 15s timeout as an error in the UI. Add fallback message like "MediaPipe failed to load — check internet" |
| 🟠 P1 | Fix stale closure | Store `lastResult` in a `ref` (`lastResultRef.current`) alongside state for synchronous reads |
| 🟡 P2 | Fix Android WebView throttling | Give the hidden WebView a `visibility: 'hidden'` instead of `opacity: 0`, and keep it on-screen (use `position: absolute`, `width: 0, height: 0`) |
| 🟡 P2 | Reduce polling interval | Change `CAPTURE_INTERVAL_MS` from 4500ms to 1500ms |
| 🟡 P3 | Update tip text | Change "2.5 seconds" to match actual interval |

---

> **Next Step:** Confirm this RCA is accurate and give the go-ahead to implement the fixes above.
