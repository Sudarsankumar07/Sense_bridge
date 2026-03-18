# TalkingHead + Deaf Mode Integration Plan (Feasibility)

Date: 2026-02-22
Project: SenseBridge
Scope: Integrate TalkingHead avatar into Deaf mode for visual communication

## Feasibility Verdict

## Is it possible?

**Yes, with constraints.**

- Feasible for: avatar rendering, lip-sync, facial expressions, and limited gesture playback.
- Not turnkey for: full sign-language grammar generation out of text.

TalkingHead provides speech/lip-sync and a small gesture set (`playGesture`) by default. Producing accurate sign language requires a dedicated sign translation/motion layer and custom animations.

## Current Gap in Project

- `src/components/AvatarView.tsx` currently embeds a custom Three.js demo, not TalkingHead.
- `react-native-webview` dependency is missing (compile error currently reported).
- Deaf mode currently uses mocked transcript (`startListening`) and passes plain text to avatar.

## Integration Architecture (Recommended)

### Option A (MVP, fastest)

Host TalkingHead as a standalone web page and load it in React Native WebView:

1. Create TalkingHead web controller page (inside `TalkingHead/`), exposing JS bridge methods:
   - `window.handleTranscript(text)`
   - internally call `head.speakText(text)` and optional `head.playGesture(...)`

2. In React Native `AvatarView`, use `WebView` + `injectJavaScript` to send transcript updates.

3. Map keywords to gesture templates (simple rule-based mapping):
   - "yes" -> `thumbup`
   - "no" -> `thumbdown`
   - "wait" -> `handup`

Outcome: expressive avatar + speech/lip-sync + basic symbolic gestures.

### Option B (Intermediate)

Add a sentence-to-gesture planner service:

- Input: transcript text
- Output: timed gesture sequence + mood + emphasis markers
- Avatar runtime: `speakText` + scheduled `playGesture`

Outcome: better communicative quality, still not true sign language.

### Option C (Advanced, true sign support)

Integrate sign-language animation assets and sequencing engine:

- Build/obtain per-sign motion clips (Mixamo-compatible rig)
- Tokenize text to sign gloss
- Generate motion timeline (manual or ML-based)
- Blend gestures/transitions for readability

Outcome: closer to real sign language delivery; significant effort and linguistic validation needed.

## Risks and Constraints

1. **Expo/WebView constraints**
   - Need `react-native-webview` package and stable mobile WebGL behavior.

2. **Performance**
   - Three.js + avatar rendering in WebView may be heavy on low-end devices.

3. **Sign-language accuracy**
   - Text->sign is not equivalent to text->gesture.
   - Requires language-specific grammar and curated motion assets.

4. **Asset licensing**
   - Validate avatar and animation licensing before distribution.

## Recommended Delivery Phases

### Phase 1 (1-2 days) – Technical integration MVP
- Install `react-native-webview`
- Replace custom inline avatar demo with TalkingHead host page load
- Connect transcript bridge to `speakText`
- Add 4-6 simple gesture mappings

Success criteria:
- Avatar loads in Deaf mode
- New transcript triggers visible speech/lip-sync
- Gesture mapping executes without crashes

### Phase 2 (3-7 days) – Reliability + UX
- Add queueing/debouncing for transcript updates
- Add explicit avatar loading/error state
- Add performance caps (FPS, render quality)

Success criteria:
- Stable behavior during continuous transcript stream
- Acceptable FPS on target devices

### Phase 3 (2-6+ weeks) – Sign language layer
- Define target sign language (e.g., ISL/ASL)
- Build glossary + animation library
- Implement text-to-sign planner and timeline player
- Validate with deaf users/interpreters

Success criteria:
- Linguistically meaningful sign output for prioritized phrase set

## Decision

- **Short-term:** Yes, integrate TalkingHead now for expressive avatar + lip-sync + limited gestures.
- **Long-term:** True sign-language avatar is possible but requires dedicated sign pipeline; TalkingHead alone is not sufficient.

## Immediate Next Actions

1. Fix blockers (`react-native-webview` install, camera ref typing issue).
2. Build TalkingHead host page with RN bridge API.
3. Wire Deaf transcript stream to avatar bridge.
4. Add minimal gesture dictionary and test on Android/iOS.
