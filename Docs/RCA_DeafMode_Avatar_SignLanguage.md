# RCA: Deaf Mode Avatar + Sign Language

Date: 2026-03-06
Project: SenseBridge
Scope: Deaf mode avatar pipeline (`DeafModeScreen` + `AvatarView` + TalkingHead)

## Executive Summary

The current Deaf mode integration is technically functional for **lip-sync + symbolic gestures**, but it does **not** implement true sign language output yet.

The major issue is architectural: the runtime path is currently
`speech text -> speakText + keyword gesture`.
That path can look expressive, but it cannot produce language-correct sign grammar.

In addition, several runtime reliability issues in the avatar bridge cause dropped updates and inconsistent behavior under real transcript streams.

## Current Architecture (Observed)

1. `src/screens/DeafModeScreen.tsx` polls `startListening()` every 3.5s and pushes latest transcript to `AvatarView`.
2. `src/components/AvatarView.tsx` hosts an inline HTML `WebView`, imports TalkingHead from CDN, and exposes bridge methods.
3. `src/services/gestureMapping.ts` maps keywords (yes/no/help/hello) to built-in gestures.
4. `src/services/cloudAI/speechToText.ts` currently returns mock phrases (`DEMO_PHRASES`).

Practical result:
- Works as demo for avatar speaking.
- Not a sign-language translator/renderer.

## Symptoms Reported / Expected in Field

- Avatar sometimes misses early transcripts during load.
- Gesture output appears generic and not linguistically accurate.
- Behavior can vary by network/device because avatar runtime depends on CDN + remote avatar URL.
- Documentation and code state feel inconsistent (older docs mention missing dependencies that are now installed).

## Root Causes

### RC1 (Primary): No sign-language planning layer exists

Evidence:
- `DeafModeScreen` sends raw transcript directly to `AvatarView` (`src/screens/DeafModeScreen.tsx:81`).
- `AvatarView` calls `window.handleTranscript(...)` and optional `playGesture(...)` only (`src/components/AvatarView.tsx:159`).

Impact:
- No gloss conversion, no timing plan, no per-sign animation clips, no transitions.
- Output is expressive speech avatar, not true sign language.

### RC2: Transcript drop before avatar readiness

Evidence:
- Log says "queuing transcript" (`src/components/AvatarView.tsx:154`), but code returns early before `push` when `!isReady`.
- Queue insertion occurs only after readiness (`src/components/AvatarView.tsx:159`).

Impact:
- Early transcripts are silently lost during avatar boot.

### RC3: Potential duplicate avatar initialization race

Evidence:
- HTML calls `initAvatar()` on `load` and also calls it if `document.readyState === 'complete'` (`src/components/AvatarView.tsx:374`, `src/components/AvatarView.tsx:375`).

Impact:
- Can initialize twice in fast-load paths, increasing memory/instability risk.

### RC4: Queue progression depends on fixed timeout, not real speech completion

Evidence:
- RN side releases processing after 5s timeout regardless of utterance length.
- `stopped` events are not guaranteed for natural end-of-speech flow.

Impact:
- Long transcripts can overlap or reorder; short transcripts can be delayed unnecessarily.

### RC5: Input stream is mock, not production STT

Evidence:
- `startListening` uses random `DEMO_PHRASES` (`src/services/cloudAI/speechToText.ts:3`, `src/services/cloudAI/speechToText.ts:16`).

Impact:
- Cannot validate real transcript quality, latency, punctuation, or segmentation needed for sign planning.

### RC6: External dependency fragility (CDN + model hosting)

Evidence:
- TalkingHead imported from jsDelivr CDN (`src/components/AvatarView.tsx:224`).
- Avatar model loaded from external Ready Player Me URL in inline HTML.
- Upstream note: Ready Player Me service wind-down (`TalkingHead/README.md:4`).

Impact:
- Runtime breaks when network is poor or upstream assets change/unavailable.
- Future risk on hosted avatar ecosystem stability and licensing constraints.

### RC7: State variable not used for adaptive emotion strategy

Evidence:
- `currentEmotion` is stored but never updated meaningfully in Deaf mode (`src/screens/DeafModeScreen.tsx:17`).

Impact:
- Emotion pipeline is mostly static and may not reflect conversation context.

### RC8: Documentation drift

Evidence:
- Older notes mention missing `react-native-webview`, but dependency now exists in `package.json`.

Impact:
- Team confusion and repeated debugging of already-fixed setup items.

## Why "Sign Language" Is Not Showing Correctly Today

The app currently uses built-in gestures (`wave`, `thumbup`, etc.) as symbolic cues.
That is not equivalent to sign language.

True sign output requires all of the following, which are currently absent:
- Text -> gloss conversion for target language (ASL/ISL/etc.).
- Per-sign animation clip library mapped to glossary entries.
- Timeline planner with hold times, coarticulation, and transition blending.
- Grammar rules and validation by Deaf users/interpreters.

## Recommended Target Architecture

### Phase A: Stabilize current avatar runtime (1-3 days)

1. Fix pre-ready queue bug in `AvatarView`.
2. Add one-time init guard in WebView script (`if (window.__avatarInitDone) return`).
3. Replace fixed 5s queue release with ack-based completion events.
4. Add structured telemetry events: `avatar_init_start`, `avatar_ready`, `speak_start`, `speak_end`, `queue_depth`.
5. Pin TalkingHead version and host critical assets locally for production builds.

Success criteria:
- No transcript drops during startup.
- Stable ordering of utterances under continuous stream.
- Predictable behavior offline/poor network.

### Phase B: Add symbolic sign planner (MVP+) (3-7 days)

1. Introduce `src/services/signPlanner.ts`:
   - Input: transcript sentence.
   - Output: `[{tStartMs, actionType, value}]` timeline.
2. Expand gesture dictionary from keyword-only to phrase templates.
3. Drive `AvatarView` using a timeline executor instead of immediate one-off calls.

Success criteria:
- Better communicative quality and repeatable behavior.
- Still not linguistically complete sign language.

### Phase C: True sign-language layer (2-8+ weeks)

1. Choose target language (ASL/ISL) and scope (top 200-500 phrases first).
2. Build sign glossary and rig-compatible animation clips.
3. Implement `text -> gloss -> motion timeline` pipeline.
4. Add blend transitions and non-manual markers (facial/emphasis).
5. Validate with Deaf users/interpreters and iterate.

Success criteria:
- Linguistically meaningful output for the scoped phrase set.

## Implementation Blueprint (Code-Level)

New modules:
- `src/services/signLanguage/glossMapper.ts`
- `src/services/signLanguage/animationLexicon.ts`
- `src/services/signLanguage/timelinePlanner.ts`
- `src/services/signLanguage/timelineExecutor.ts`

Bridge API extensions in WebView:
- `window.playTimeline(timelineJson)`
- `window.preloadSigns(signIds)`
- `window.onTimelineComplete()` -> postMessage ack

Deaf mode orchestration:
- Replace direct `transcript -> AvatarView` with
  `transcript -> planner -> timeline -> AvatarView`.

## Immediate Bug-Fix Checklist

- [ ] Preserve transcripts while avatar is loading.
- [ ] Add single-init guard in inline HTML.
- [ ] Replace timeout queue release with completion ack.
- [ ] Add fallback path when CDN import fails.
- [ ] Add explicit "demo/mock STT" badge in Deaf mode UI.
- [ ] Version and asset strategy doc update (remove stale setup assumptions).

## Risk Register

1. Performance risk: WebView + Three.js on low-end devices.
2. Linguistic risk: incorrect sign grammar without domain validation.
3. Dependency risk: external asset/CDN outages.
4. Product risk: user expectation mismatch ("sign language" vs "gesture avatar").

## Decision

Short-term:
- Keep TalkingHead for expressive avatar and gesture-assisted communication.
- Market it as "visual avatar" not "full sign language" until Phase C.

Medium-term:
- Implement planner + timeline engine and strict runtime stabilization.

Long-term:
- Build real sign-language stack with curated animation assets and community validation.

## Incident Addendum: "Loading Avatar" + Random Text (2026-03-06)

### User-Visible Symptoms

- Deaf mode stayed on `Loading Avatar...` and never showed `Ready`.
- Random text (e.g. hi/bye/yes/no) appeared under avatar.

### Technical RCA (Deep)

1. Input pipeline mismatch:
- Deaf mode was wired to mock STT (`src/services/cloudAI/speechToText.ts`) that emits random demo phrases.
- Those demo phrases were rendered in a transcript list under avatar, causing noisy/random text UX.

2. Silent WebView module startup failure:
- Inline avatar runtime depended on module loading in WebView.
- If ES module startup/import failed or did not begin (older Android System WebView / transient CDN issue), React Native side only saw `WebView loaded`, but not `ready/error` events.
- Result: RN overlay remained in loading state indefinitely.

3. Pre-ready transcript handling weakness:
- Transcripts arriving before `isReady` were not consistently retained for playback.
- This made startup behavior appear unstable and made debugging harder.

### Fixes Applied

1. Removed random text feed and transcript list in Deaf mode:
- Replaced mock `startListening()` polling with real `listenForCommand()` loop.
- Removed the transcript list UI under avatar, so no random demo text appears.

2. Added robust avatar startup diagnostics:
- Added WebView-side `window.onerror` and `unhandledrejection` forwarding to RN.
- Added module boot watchdog that reports explicit error if module script does not start.
- Added RN-side startup timeout (20s) that surfaces a clear actionable error.

3. Improved pre-ready queue behavior:
- Incoming transcript is queued even before avatar readiness.
- Queue processing starts when `ready` arrives.

### Post-Fix Expected Behavior

- No random transcript cards under avatar.
- If avatar runtime fails, user gets explicit error instead of infinite spinner.
- If startup succeeds, queued transcript is spoken/animated after avatar becomes ready.
