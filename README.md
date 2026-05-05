# SenseBridge

SenseBridge is an Expo + React Native accessibility app that combines camera AI, voice control, navigation, and a 3D signing avatar.

## Tech Stack

| Area | Stack |
|---|---|
| Core | React Native `0.81.5`, Expo SDK `54`, React `19`, TypeScript |
| Navigation | `@react-navigation/native`, `@react-navigation/stack` |
| Voice + Audio | `expo-speech`, `expo-av`, Web Speech API (web fallback) |
| Camera + Vision | `expo-camera`, `expo-file-system`, cloud AI providers |
| 3D Avatar | `three`, `three-stdlib`, `expo-gl`, `expo-three` |
| Maps | `expo-location`, `react-native-webview`, Leaflet + OpenStreetMap |
| Storage | `@react-native-async-storage/async-storage`, `expo-sqlite` |
| UI | `expo-linear-gradient`, `@expo/vector-icons`, `expo-haptics`, `@react-native-community/slider` |
| Build/Config | EAS (`eas.json`), Metro, Babel module resolver, `react-native-dotenv` |

## Overall Architecture

```text
App.tsx
└── AppNavigator (Stack)
    ├── SplashScreen
    ├── ModeSelectionScreen
    ├── BlindModeScreen
    ├── SignModeScreen
    ├── DeafModeScreen
    ├── NavigationScreen
    └── SettingsScreen

Mode screens use:
- hooks/        (voice, volume-trigger, sign engine)
- services/     (cloud AI, voice, location, navigation, storage, haptics)
- components/   (CameraView, MicFAB, AvatarCanvas, NavigationMap)
- utils/        (camera capture, decision logic, permissions)
```

## End-to-End App Flow

1. `App.tsx` mounts `AppNavigator` inside gesture + safe-area providers.
2. `SplashScreen` requests camera/mic/location permissions and transitions to mode selection.
3. `ModeSelectionScreen` speaks a welcome prompt, listens for mode commands, and supports manual card taps.
4. User enters one of the main modes:
   - **Blind Mode** (obstacle/currency awareness)
   - **Sign Mode** (camera sign recognition to text/voice)
   - **Deaf Mode** (text to animated sign avatar)
5. From Blind Mode, user can open **Navigation** for walking guidance.
6. Shared services handle TTS, speech recognition, API calls, haptics, location tracking, and local persistence.

## Modes and How They Work

| Mode | Input | Processing | Output |
|---|---|---|---|
| Blind Mode | Camera frames + mic/volume trigger commands | Object + currency detection via selected provider (`gemini`/`google`/`roboflow`) | Spoken alerts, haptics, status cards |
| Sign Mode | Camera frames | Gemini-based ISL sign recognition (`sign`, `text`, `confidence`, `type`) | Recognized sign text + spoken translation |
| Deaf Mode | Typed text | Local sign animation pipeline (no cloud call): text → words → sign/alphabet clips → mixer playback | 3D avatar signing animation |
| Navigation | Voice destination + GPS updates | ORS geocoding + walking route + step tracking | Turn-by-turn voice instructions + map + arrival alerts |

## APIs and External Services Used

| API / Service | Where used | Purpose |
|---|---|---|
| `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` | Object detection, currency recognition, ISL sign recognition, native voice transcription | Main Gemini multimodal API |
| `vision.googleapis.com/v1/images:annotate` | Optional object + currency providers | Google Cloud Vision provider |
| `detect.roboflow.com/<model>` | Optional object + currency providers | Roboflow provider |
| `api.openrouteservice.org/geocode/search` | Navigation | Destination geocoding |
| `api.openrouteservice.org/v2/directions/foot-walking` | Navigation | Walking route with steps + geometry |
| `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | Navigation map WebView (Leaflet) | Map tiles |
| Browser Web Speech API | Web voice input | Speech recognition fallback on web |

## Avatar Pipeline (Deaf Mode)

1. `DeafModeScreen` gets text input and calls `createSignEngine(...).playText(...)`.
2. `AvatarCanvas.native.tsx` loads `assets/models/avatar.glb` (Mixamo rig), sets scene/lights/camera, creates `THREE.AnimationMixer`, and keeps an idle pose.
3. `useSignEngine.ts` converts text into words, maps to core sign JSON clips, and falls back to alphabet fingerspelling clips when needed.
4. Frame bone rotations are converted to quaternion tracks (`ZYX` rotation order), then scheduled with crossfades.
5. Mixer plays clips sequentially; user can drag to orbit and pinch to zoom the avatar.

## Environment Variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_key_here
GOOGLE_CLOUD_VISION_API_KEY=your_key_here
ROBOFLOW_API_KEY=your_key_here
OPENROUTESERVICE_API_KEY=your_key_here

# Provider selection for Blind Mode
CLOUD_PROVIDER=google

# Optional Roboflow model overrides
ROBOFLOW_OBJECT_MODEL=obstacle-detection-yp5nu/4
ROBOFLOW_CURRENCY_MODEL=indian-currency
```

## Getting Started

```bash
npm install
npm start
npm run android
npm run ios
```

## Permissions

| Permission | Platform | Purpose |
|---|---|---|
| Camera | Android + iOS | Blind + Sign mode frame capture |
| Microphone | Android + iOS | Voice commands / transcription |
| Location (foreground) | Android + iOS | Navigation |
| Vibration | Android | Haptic alerts |

## Project Structure

```text
src/
├── components/      # AvatarCanvas, CameraView, MicFAB, NavigationMap, ...
├── constants/       # App constants and API endpoints
├── hooks/           # useVoiceCommands, useVolumeButtonTrigger, useSignEngine, ...
├── navigation/      # App navigator
├── screens/         # Splash, mode screens, navigation, settings
├── services/
│   ├── cloudAI/     # Gemini/Google/Roboflow integrations
│   ├── voiceEngine.ts
│   ├── navigationService.ts
│   ├── locationService.ts
│   └── storage.ts
├── theme/
├── types/
└── utils/
assets/
├── models/avatar.glb
└── signs/           # Core signs + alphabet sign JSON
```

## Implementation Notes

- `SettingsScreen` exists in the navigation stack, but there is currently no direct in-app entry point to open it.
- `src/services/cloudAI/speechToText.ts` is a demo/mock module and is not the active runtime voice path (runtime uses `voiceEngine.ts`).
