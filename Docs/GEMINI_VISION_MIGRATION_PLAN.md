# Gemini Vision Migration Plan
## Replacing Google Cloud Vision API with Gemini Vision API

---

## Background

SenseBridge's **Blind Mode** currently uses the **Google Cloud Vision API** to detect
objects and currency from camera frames. The project holds a valid API key, but the
Google Cloud project has **billing disabled**, causing every API call to return a
`403 PERMISSION_DENIED` error.

**Goal:** Swap the Google Cloud Vision API provider with **Gemini 1.5 Flash Vision**
(free tier, no billing required), so Blind Mode works without setting up a billing account.

---

## What Currently Happens (The 2-Second Loop)

Understanding the existing loop is essential before changing anything.

```
BlindModeScreen.tsx
└── useEffect() launches an infinite async loop
    ├── captures a camera frame every 2 seconds  (line 147: setTimeout 2000ms)
    ├── calls detectObjects(frame.base64)         → objectDetection.ts
    │       └── if CLOUD_PROVIDER=google          → objectDetection.googleVision.ts
    │               └── POST to vision.googleapis.com  ← FAILS (billing disabled)
    └── calls detectCurrency(frame.base64)        (when currency mode is ON)
```

The `2000ms` delay is at the **end** of each loop iteration — meaning each cycle is:
`[capture time] + [API call time] + [2000ms wait]`.

---

## The 2-Second Capture Question — How Will Gemini Respond?

> **"Image capture happens every 2 seconds. How will it respond?"**

This is the most important question. Here's a full breakdown:

### Gemini 1.5 Flash Typical Response Time
- **Average latency:** ~1,000 ms to 2,500 ms per request
- **Maximum latency (busy):** ~4,000 ms on rare occasions

### How the Current Loop Handles This

The loop is **sequential** — it does NOT fire off parallel requests. It works like this:

```
Time 0ms    → Capture frame
Time 100ms  → Send to Gemini API
Time 1500ms → Gemini responds (average ~1.4s)
Time 1500ms → Process result, speak/alert
Time 3500ms → Wait 2000ms
Time 3500ms → Next capture starts
```

So in practice, the user gets a **new detection result roughly every 3.5 to 5 seconds**
(API time + 2s wait). This is acceptable for an obstacle awareness app.

### What If Gemini Is Slow (more than 3 seconds)?

Since the loop is sequential (not parallel), a slow API call just means the next
cycle starts later. There is no risk of flooding the API or getting confused results.
The worst case is a 6 to 7 second gap between alerts, which is still safe.

### What If the API Fails?

The existing try/catch block in `BlindModeScreen.tsx` will catch errors and call
`handleCloudError()`, which shows an on-screen error card and logs the message.
This behavior will remain exactly the same.

---

## Files That Will Change

Only **3 files** need to change. The loop in `BlindModeScreen.tsx` does NOT change.
The 2-second timing stays the same. The `detectObjects()` interface stays the same.

### 1. `.env` (root)

| What changes | From | To |
|---|---|---|
| New key variable added | — | `GEMINI_API_KEY=your_key_here` |
| Provider switch | `CLOUD_PROVIDER=google` | `CLOUD_PROVIDER=gemini` |
| Old key | kept (commented out) | kept as-is for reference |

---

### 2. NEW FILE: `objectDetection.gemini.ts`
**Path:** `src/services/cloudAI/objectDetection.gemini.ts`

This is the **core new file**. It will:

1. Accept the same `imageBase64: string` input as the current Google Vision provider.
2. Call the Gemini 1.5 Flash REST endpoint:
   `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
3. Send a **structured prompt** instructing Gemini to return a JSON list of detected
   objects — NOT a free-text paragraph. For example:

   ```
   "You are an obstacle detection assistant for a blind person.
    Look at this image and respond ONLY with a valid JSON array.
    Each item must have: { class, confidence (0-1), distance_m (estimated) }
    Example: [{"class":"Chair","confidence":0.9,"distance_m":1.2}]
    If nothing is detected, return [].
    Do not include any explanation."
   ```

4. Parse the JSON from Gemini's text response.
5. Return an array of `ObjectDetection[]` — the **exact same type** as the current
   Google Vision provider returns.
6. Include a `15,000ms` timeout (same as current Google Vision provider).
7. Throw a `CloudError` on failure (same error type as current).

**Why structured JSON prompt?**
Without it, Gemini would say "I see a chair about 1 meter away." which is
hard to parse programmatically. By forcing JSON output, the rest of the app
(distance estimation, alert building) works without modification.

---

### 3. MODIFY: `objectDetection.ts` (Provider Router)
**Path:** `src/services/cloudAI/objectDetection.ts`

This file currently routes between `roboflow` and `google`.
We will add a third route: `gemini`.

| Current | After Change |
|---|---|
| if provider === 'google' then Google Vision | if provider === 'google' then Google Vision (kept) |
| else then Roboflow | if provider === 'gemini' then new Gemini provider |
| | else then Roboflow |

---

## Files That Will NOT Change

| File | Why It Stays the Same |
|---|---|
| `BlindModeScreen.tsx` | The 2-second loop, error handling, and `detectObjects()` call are untouched |
| `objectDetection.googleVision.ts` | Kept as fallback; only disabled via `.env` |
| `currencyRecognition.ts` | Currency detection is separate (uses Roboflow); unaffected |
| `decisionEngine.ts` | Alert logic is independent of the detection provider |
| All other screens | No changes needed |

---

## New API Key Setup (Before Implementation)

1. Go to **https://aistudio.google.com/app/apikey**
2. Click **"Create API Key"** — it's free, no billing required
3. Copy the key (it starts with `AIza...`)
4. Add it to your `.env` as `GEMINI_API_KEY=AIza...`

**Free Tier Limits:**
- 15 requests per minute
- 1 million tokens per day

At 1 frame per ~3 to 4 seconds, SenseBridge would use roughly 15 requests/minute
in continuous use — right at the free tier limit. If needed, we can increase the
loop wait from 2000ms to 3000ms to stay comfortably within the limit.

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Gemini returns non-JSON text | Wrap JSON.parse in try/catch; return empty array as fallback |
| Gemini is slow on first call (cold start ~3 seconds) | Loop is sequential so no pile-up; user just waits one cycle |
| Gemini misidentifies objects | Confidence threshold in config already filters low-confidence results |
| Free tier rate limit hit (15 req/min) | Can increase setTimeout to 3000ms to stay within limits |

---

## Verification Plan

After implementation, run these checks:

1. **Test script:** Create `scripts/test-gemini-vision.js` to verify the key works
   and returns a parseable JSON array.
2. **Blind Mode smoke test:** Open the app, activate Obstacle Scan, verify the status
   label updates with detected object names every 3 to 5 seconds.
3. **Error handling test:** Temporarily set `GEMINI_API_KEY` to an invalid value and
   confirm the on-screen error card appears correctly.
4. **Fallback test:** Set `CLOUD_PROVIDER=roboflow` and confirm Roboflow still works,
   confirming the old providers are not broken.

---

## Summary of Changes

```
Files Added:     1  →  objectDetection.gemini.ts  (new)
Files Modified:  2  →  objectDetection.ts, .env
Files Deleted:   0
Files Untouched: everything else including BlindModeScreen.tsx
```
