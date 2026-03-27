# Deaf Mode Avatar Architecture (Current + Redesign)

Date: 2026-03-18
Project: SenseBridge

## 1. Purpose
This document explains the current Deaf Mode avatar architecture end-to-end, why it is unstable in practice, a better design for sign language output, and what to remove if you want to remove the avatar.

## 2. Current End-to-End Flow

### 2.1 Entry and Orchestration
- Deaf Mode screen starts a continuous listen loop.
- It plays a startup prompt, then calls voice recognition repeatedly.
- For each recognized utterance:
  - If it matches back/exit command, it navigates back.
  - Else it updates current transcript state.

Primary file:
- src/screens/DeafModeScreen.tsx

### 2.2 Speech Input Layer
- Speech is captured by voiceEngine.
- Web path uses browser SpeechRecognition.
- Native path records with expo-av, converts audio to base64, then sends to Google Speech-to-Text API.
- Uses confidence threshold and mutex lock to prevent overlapping recordings.

Primary file:
- src/services/voiceEngine.ts

### 2.3 Avatar Rendering Layer
- Deaf Mode passes transcript text to AvatarView.
- AvatarView is a React Native WebView with inline HTML.
- Inline HTML loads TalkingHead module and 3D model from CDN URLs.
- After initialization, avatar exposes JS bridge functions:
  - handleTranscript(text, emotion)
  - playGesture(gestureName)
  - setMood(mood)
  - stopSpeaking()

Primary file:
- src/components/AvatarView.tsx

### 2.4 Gesture and Emotion Mapping
- Before sending transcript to WebView, AvatarView runs keyword rules.
- detectGesture returns symbolic gesture (wave, thumbup, handup, namaste).
- detectEmotion returns basic sentiment label.

Primary file:
- src/services/gestureMapping.ts

### 2.5 Queue and Bridge
- AvatarView has a transcript queue.
- If avatar is not ready, transcripts are queued.
- If ready, transcript is injected as JS into WebView.
- Queue progression uses speaking/stopped messages plus timeout fallback.

Primary file:
- src/components/AvatarView.tsx

## 3. Why Current Avatar Fails Often

1. External runtime dependency
- TalkingHead module and avatar model are fetched from CDN at runtime.
- Any network instability, DNS block, CDN outage, or slow connection breaks startup.

2. WebView variability on Android
- Some devices run older Android System WebView with partial module behavior.
- Import map / module loading can fail before avatar setup completes.

3. Timeout-driven queue progression
- Queue has a fixed fallback timeout which can desync with real speech duration.
- This causes dropped, delayed, or overlapped utterances.

4. Not true sign language pipeline
- Current path is speech text plus symbolic gesture.
- There is no linguistic translation or sign timeline planning.

## 4. Current Architecture Summary
Current functional path:
- speech -> transcript -> keyword gesture/emotion -> avatar speakText + optional gesture

This is an expressive talking avatar, not full sign-language synthesis.

## 5. Better Design for Sign Language Avatar

## 5.1 Layered Pipeline
Implement 4 explicit layers:

1. STT Layer
- Captures speech segments with timestamps and confidence.

2. Linguistic Layer
- Converts transcript to target sign gloss tokens (ISL or ASL scope).
- Handles grammar transforms and phrase normalization.

3. Motion Planning Layer
- Maps gloss tokens to animation clips.
- Builds timeline with transitions, hold durations, non-manual markers.

4. Rendering Layer
- Executes timeline on avatar renderer.
- Reports deterministic completion events to queue manager.

## 5.2 New Modules
Create:
- src/services/signLanguage/glossMapper.ts
- src/services/signLanguage/animationLexicon.ts
- src/services/signLanguage/timelinePlanner.ts
- src/services/signLanguage/timelineExecutor.ts
- src/hooks/useDeafSignPipeline.ts

## 5.3 New Renderer Contract
Replace transcript bridge with timeline bridge:
- playTimeline(timelineJson)
- preloadSigns(signIds)
- onTimelineComplete(event)

This avoids direct text-to-speech coupling in avatar flow.

## 5.4 Reliability Strategy
- Bundle core avatar assets locally for production.
- Keep CDN as optional fallback only.
- Add runtime states: idle, loading, ready, playing, degraded.
- Add degraded mode UI: live captions + sign cards when renderer unavailable.

## 6. If You Want to Remove Avatar Only (Keep Deaf Mode)

Remove or modify:

1. In src/screens/DeafModeScreen.tsx
- Remove AvatarView import and props usage.
- Remove avatar ready/error states and callbacks.
- Replace avatar area with transcript/caption panel.

2. In src/components/index.ts
- Remove AvatarView export.

3. Delete src/components/AvatarView.tsx

4. If no longer used elsewhere, delete src/services/gestureMapping.ts

5. In src/constants/config.ts
- Update Deaf mode description text to reflect caption mode, not avatar mode.
- Remove "avatar mode" command alias if not needed.

Important:
- Do not uninstall react-native-webview if NavigationMap still uses it.
- Navigation map currently depends on react-native-webview.

## 7. If You Want to Remove Deaf Mode Entirely

Remove:
- src/screens/DeafModeScreen.tsx
- DeafMode route from src/navigation/AppNavigator.tsx
- DeafMode export from src/screens/index.ts
- Deaf entries in src/types/index.ts and src/constants/config.ts
- Deaf mode handling in src/screens/ModeSelectionScreen.tsx

## 8. Recommended Practical Path

Phase 1 (fast stabilization)
- Keep Deaf mode, remove avatar renderer, ship robust live caption mode.

Phase 2 (architecture scaffold)
- Add sign-language pipeline modules and interfaces with mock timeline output.

Phase 3 (true sign output)
- Add curated sign lexicon and animation clips for scoped phrase set.
- Validate with Deaf users/interpreters.

## 9. Acceptance Criteria

For stabilized Deaf mode without avatar:
- Speech recognition works reliably.
- Captions update in near real-time.
- No startup blocking due to renderer or CDN.

For sign-language avatar redesign:
- Deterministic timeline execution.
- No dropped segments under continuous speech.
- Measurable fallback behavior under network/device constraints.
