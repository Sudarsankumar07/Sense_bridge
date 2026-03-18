# RCA: Blind Guide System Not Working with Google Cloud

Date: 2026-02-22
Project: SenseBridge
Scope: Blind Mode (object + currency detection), cloud integration path

## Executive Summary

The current Blind Guide pipeline is **not integrated with Google Cloud Vision**. It is implemented against **Roboflow endpoints** and environment keys (`ROBOFLOW_*`).

If you added a Google Cloud API key, it is currently unused by the app runtime. That is the primary reason the system appears "not working with Google Cloud".

## Symptoms Observed

- Blind mode scans but can return no detections or inconsistent outputs.
- Adding Google Cloud key does not change behavior.
- Errors from cloud calls are swallowed and converted to empty/mock responses.

## Evidence (Code-level)

1. Blind mode calls Roboflow services directly:
   - `src/screens/BlindModeScreen.tsx` imports `detectObjects` and `detectCurrency` from `src/services/cloudAI/*`.

2. Object detection endpoint is Roboflow, not Google:
   - `src/constants/config.ts`
   - `OBJECT_DETECTION: 'https://detect.roboflow.com'`

3. Currency detection endpoint is Roboflow, not Google:
   - `src/constants/config.ts`
   - `CURRENCY_DETECTION: 'https://detect.roboflow.com'`

4. Environment variables are Roboflow-oriented:
   - `src/types/env.d.ts` declares `ROBOFLOW_API_KEY`, `ROBOFLOW_OBJECT_MODEL`, `ROBOFLOW_CURRENCY_MODEL`
   - no Google Vision env declaration exists

5. `.env` includes Roboflow key, not Google integration variables:
   - `.env` has `ROBOFLOW_API_KEY`, `ROBOFLOW_CURRENCY_MODEL`
   - no `GOOGLE_CLOUD_VISION_API_KEY` path is consumed by service code

6. Service behavior masks failures:
   - `src/services/cloudAI/objectDetection.ts` returns `[]` on any error
   - `src/services/cloudAI/currencyRecognition.ts` returns mock output on error
   - this makes failures look like "nothing detected" instead of explicit API errors

7. Runtime/type blockers found in related flow:
   - Missing dependency: `react-native-webview` import unresolved in `src/components/AvatarView.tsx`
   - Camera ref type mismatch in `src/screens/BlindModeScreen.tsx` when passing `cameraRef` to `CameraViewComponent`

## Root Cause(s)

### RC1 (Primary): Wrong cloud provider wiring
Implementation uses Roboflow contracts and keys, while expectation is Google Cloud. The Google key is not used anywhere in blind detection requests.

### RC2: Configuration drift / incomplete env schema
`.env.example`, `env.d.ts`, and service imports do not define or consume Google Vision variables.

### RC3: Weak observability + fallback masking
Errors are caught and converted to empty/mock outputs, preventing clear diagnosis from UI.

### RC4 (Secondary): Runtime quality blockers
Build/runtime issues (webview package missing, camera ref mismatch) reduce confidence and can break end-to-end behavior around blind/deaf flows.

## Impact

- Blind mode is effectively tied to Roboflow.
- Google Cloud integration appears broken even with valid key.
- Debugging is slow because API failures are hidden by fallbacks.

## Recommended Fix Plan (Prioritized)

### P0 (must-do)
1. Decide provider per feature explicitly:
   - Blind object detection: Roboflow **or** Google Vision (pick one)
   - Currency detection: Roboflow model or custom Google AutoML model

2. Add provider-specific service abstraction:
   - `objectDetection.roboflow.ts`
   - `objectDetection.googleVision.ts`
   - selector in `src/services/cloudAI/objectDetection.ts` via env flag

3. Expand env typing + example:
   - add `GOOGLE_CLOUD_VISION_API_KEY`
   - add `CLOUD_PROVIDER=roboflow|google`

4. Replace silent fallback with structured error states:
   - include source, HTTP code, short message
   - surface non-blocking status in Blind screen

### P1 (important)
5. Fix camera ref typing mismatch in Blind mode.
6. Add telemetry logs around request URL/provider/model (without printing secrets).
7. Validate model IDs and request payload format at startup.

### P2 (nice to have)
8. Add retry/backoff and offline detection state.
9. Add “API health check” button in settings.

## Quick Verification Checklist

- [ ] Blind mode logs selected provider at startup
- [ ] API key variable is present and non-empty for chosen provider
- [ ] Test image returns non-empty parsed detections
- [ ] UI shows explicit cloud error state on 4xx/5xx
- [ ] No mock fallback unless explicitly in DEV mode

## Security Note

A real API key appears in `.env`. Rotate/revoke it if this repo is shared or committed.
