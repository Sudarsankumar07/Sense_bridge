# SenseBridge - Design Plan (Based on Current Architecture)

This design consolidates the original vision and the current Expo Go hybrid architecture into a single, actionable blueprint. It maps required features to files and defines what needs to be implemented next.

## Goals
- Offline-first accessibility app for Deaf, Mute, Blind, and Normal users.
- One app with voice-first mode selection.
- Hybrid development: Expo Go for UI/flows, native build for on-device AI.

## Architecture Decision (Current)
We are following the **Hybrid Expo Go + Native Build** approach:
- Expo Go for rapid UI development with mock AI responses.
- Native builds for TFLite/Vosk/MediaPipe/Unity integrations.
- Feature flags to swap mock vs native services.

Reference: `Docs/EXPO_GO_ARCHITECTURE.md`

## Current Status (As of 2026-02-11)
From restoration files:
- App runs with basic screens and navigation.
- Several services and utils are placeholders or empty.
- AI services are currently cloud/mock based (Roboflow style endpoints).

Reference:
- `RESTORATION_STATUS.md`
- `RESTORATION_GUIDE.md`
- `RESTORATION_PROGRESS.md`

## Target User Flows (MVP)
1. App launch -> voice prompt -> user says mode.
2. Mode selection: Blind, Sign, Deaf.
3. Each mode loads needed services and presents UI.
4. Outputs: TTS + haptics + text, with optional avatar in Deaf mode.

## Module Map and What To Implement

### App + Navigation
- `App.tsx`
  - Ensure providers, navigation, theme, and app init lifecycle.
  - Trigger voice-first welcome and route to mode selection.
- `src/navigation/AppNavigator.tsx`
  - Stack for Splash, ModeSelection, Blind, Sign, Deaf, Settings.
  - Add header configuration and accessibility labels.

### Types + Theme
- `src/types/index.ts`
  - Define shared types for detection results, voice events, modes, alerts.
- `src/theme/index.ts`
  - High-contrast palette, font scale, spacing, and component styles.

### Core Screens (UI + orchestration)
- `src/screens/SplashScreen.tsx`
  - App initialization, permissions precheck, voice welcome.
- `src/screens/ModeSelectionScreen.tsx`
  - Large buttons + voice prompt fallback.
  - Calls `voiceEngine.listenForMode`.
- `src/screens/BlindModeScreen.tsx`
  - Camera preview + obstacle/currency status.
  - Uses `decisionEngine` to announce hazards.
- `src/screens/SignModeScreen.tsx`
  - Camera preview + recognized sign text.
- `src/screens/DeafModeScreen.tsx`
  - Microphone input -> text -> avatar trigger (stub in Expo Go).
- `src/screens/SettingsScreen.tsx`
  - Toggle voice speed, vibration, language, last mode.

### Components
- `src/components/VoiceButton.tsx`
  - Large accessible button, haptic + TTS feedback.
- `src/components/ModeCard.tsx`
  - Large selectable card for each mode.
- `src/components/LoadingIndicator.tsx`
  - Reusable loading view with TTS optional.
- `src/components/AlertModal.tsx`
  - Emergency/important alert UI with haptics.
- `src/components/CameraView.tsx`
  - Camera preview wrapper with overlay indicators.
- `src/components/index.ts`
  - Barrel exports.

### Services
- `src/services/voiceEngine.ts` (empty)
  - Expo Go: use `expo-speech` for TTS.
  - Native: switch to offline Android TTS + Vosk STT.
  - Functions: `speak(text)`, `listenForCommand(options)`, `stop()`.
- `src/services/haptics.ts` (empty)
  - Use `expo-haptics` with intensity presets.
- `src/services/storage.ts` (empty)
  - Use `expo-sqlite` for settings/history.
  - AsyncStorage for `last_mode`, `permissions`.
- `src/services/cloudAI/*`
  - `objectDetection.ts`: mock or cloud inference (current).
  - `currencyRecognition.ts`: current mock + Roboflow API.
  - `signLanguage.ts`: add mock, placeholder for MediaPipe + TFLite.
  - `speechToText.ts`: add mock, placeholder for Vosk.
  - `index.ts`: export unified service API.

### Utilities
- `src/utils/permissions.ts` (empty)
  - Camera, mic, storage permissions.
  - If denied, route to Settings screen with TTS.
- `src/utils/camera.ts` (empty)
  - Camera capture helpers and base64 conversion.
  - Frame throttling for inference.
- `src/utils/decisionEngine.ts` (empty)
  - Shared alert throttle and output normalization.
  - Cooldowns and confidence thresholds.

## Feature Flags / Environment
Add environment detection (Expo Go vs native):
- `Constants.appOwnership === 'expo'` => Expo Go
- Use mock AI and mock STT in Expo Go.
- Real native modules in native builds.

## Implementation Roadmap (Suggested)
1. Fill in utilities and service wrappers (voice, haptics, storage, permissions).
2. Build ModeSelection flow and voice command routing.
3. Implement basic Blind / Sign / Deaf screens with mock results.
4. Add decision engine for alert throttling.
5. Wire up camera wrapper and detection polling loop.
6. Replace mock AI with native modules (later phase).

## Deliverables for Design Approval
When you approve this plan, we will:
- Implement missing services and utils.
- Upgrade screens/components to match the design.
- Add mock AI pipeline for Expo Go.
- Prepare a native-ready integration layer for later.

## Files To Create or Update First
- `src/services/voiceEngine.ts`
- `src/services/haptics.ts`
- `src/services/storage.ts`
- `src/utils/permissions.ts`
- `src/utils/decisionEngine.ts`
- `src/utils/camera.ts`
- `src/screens/ModeSelectionScreen.tsx`
