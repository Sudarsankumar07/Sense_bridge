# SenseBridge E2E Implementation (No-Cost, End-to-End)

## Purpose
This document provides a complete end-to-end implementation path for SenseBridge using only free, open-source, offline-capable components. It covers the full product journey from device boot to feature execution without breaking the plan into phases.

------------------------------------------------------------------------

## Guiding Principles
- Offline-first: all models and processing stay on device.
- Zero cost: use open-source datasets, tools, and free SDKs.
- Accessibility-first: every flow has voice feedback and large controls.
- Single binary: one mobile app that switches modes by voice.

------------------------------------------------------------------------

## E2E System Flow
1. App launches and initializes offline TTS and offline STT.
2. Voice prompt asks for mode selection.
3. Voice command selects one of: Blind Mode, Sign Mode, Deaf Mode.
4. The app loads only the required models for the chosen mode to reduce memory.
5. Camera and microphone streams are started.
6. AI inference runs on-device and emits events.
7. Decision engine converts events to user outputs.
8. Outputs are delivered through TTS, on-screen text, and avatar animation.

------------------------------------------------------------------------

## App Architecture (Single App, Mode-Based)
- React Native + TypeScript for UI and orchestration.
- Native modules for:
  - Camera streaming
  - TFLite inference
  - Vosk offline speech recognition
  - Android TTS
  - Unity avatar renderer
- Local data: SQLite for persistent settings and history, Async Storage for quick flags.

------------------------------------------------------------------------

## Core Modules and How They Work Together

### 1) Voice-First App Opening
- On launch, initialize offline TTS (Android) and Vosk STT.
- Speak welcome prompt: "Say Blind Mode, Sign Mode, or Deaf Mode." 
- Listen for a short command phrase.
- Map recognized text to a mode.
- If unrecognized, repeat prompt once, then default to a visual menu.

Key offline stack:
- TTS: Android TextToSpeech (offline voices).
- STT: Vosk small English model.

------------------------------------------------------------------------

### 2) Blind Mode (Obstacle + Currency)

#### Obstacle Detection (Realtime)
- Camera frames -> YOLOv5 Nano TFLite.
- Use bounding boxes and relative size to approximate distance.
- Emit alerts when object is within safe threshold.
- Speak warnings with TTS and vibrate.

Sample alert rules:
- If object class is "person" and confidence > 0.5 and size > threshold -> "Person ahead"
- If object class is "stairs" or "step" -> "Step detected"
- If generic object and close -> "Obstacle ahead"

#### Currency Detection
- User points camera at currency.
- Run custom currency YOLO TFLite.
- Majority vote across 3-5 frames to reduce noise.
- Speak predicted denomination.

------------------------------------------------------------------------

### 3) Sign Mode (Sign -> Text -> Voice)
- Camera frames -> MediaPipe Hands to extract landmarks.
- Landmarks -> TFLite sign classifier.
- Class -> text token.
- Display text on screen and speak using offline TTS.
- Optional phrase aggregation: combine tokens into short phrases with a timer window.

Dataset approach (no cost):
- Combine open datasets (WLASL, ISL) with self-recorded samples.
- Train a CNN or small LSTM on landmarks.
- Convert model to TFLite.

------------------------------------------------------------------------

### 4) Deaf Mode (Speech -> Text -> Avatar)
- Microphone -> Vosk STT -> text.
- Normalize text: lowercase, remove punctuation.
- Map words to known sign animations.
- Send animation triggers to Unity avatar.
- If a word is unknown, fall back to spelling or show text.

Unity avatar:
- Prebuild sign animation clips.
- Expose a simple bridge API to trigger animations by name.

------------------------------------------------------------------------

## Decision Engine (Shared)
- Central service that receives model events and decides outputs.
- Prevents repeated alerts using cooldown timers.
- Normalizes output so all modes can use the same TTS and haptics.

Example responsibilities:
- Throttle repeated obstacle alerts.
- Merge multiple sign tokens into one phrase.
- Apply confidence thresholds before output.

------------------------------------------------------------------------

## Local Storage and Settings
- SQLite tables:
  - user_settings (voice speed, language, vibration on/off)
  - history (mode, timestamp, last outputs)
- Async Storage:
  - last_mode
  - permission flags

------------------------------------------------------------------------

## Offline Models and Sources (Free)
- MediaPipe Hands: open-source by Google.
- TensorFlow Lite: open-source runtime.
- Vosk: open-source offline speech recognition.
- YOLOv5 Nano: open-source, export to TFLite.
- COCO subset for obstacle detection.
- Kaggle currency dataset for Indian notes and coins.

------------------------------------------------------------------------

## Build and Integration Notes (No Cost)
- Use React Native CLI (or Expo Bare) to allow native modules.
- Use Android-only features for MVP to keep costs and build effort low.
- Keep models in app assets; load on demand.
- Avoid cloud services, analytics, or paid APIs.

------------------------------------------------------------------------

## End-to-End User Journey
1. User opens app.
2. App greets and requests mode via voice.
3. User says a mode.
4. Mode initializes needed models and camera.
5. User interacts with mode features.
6. App delivers feedback: voice, text, and animation.
7. User exits with voice command "Exit" or back button.

------------------------------------------------------------------------

## Offline-Only Compliance Checklist
- No network permissions required.
- All AI models are bundled.
- All processing is done on device.
- No telemetry or cloud logging.

------------------------------------------------------------------------

## Minimal Implementation Outline (Single Deliverable)
- One React Native app.
- One shared AI engine wrapper.
- One voice engine wrapper.
- One mode router that loads models on demand.
- One UI with large buttons and voice feedback.

------------------------------------------------------------------------

## Risks and Mitigations
- Model performance on low-end devices: use quantized TFLite models.
- Memory usage: load only one mode model at a time.
- Accuracy: use multi-frame smoothing and confidence thresholds.

------------------------------------------------------------------------

## Final Output
A single, offline, zero-cost accessibility app that provides:
- Sign recognition to text and voice
- Blind assist with obstacle and currency detection
- Deaf-mode avatar that visualizes sign animations
- Voice-driven app navigation
