# SenseBridge

An accessibility-first mobile app for Deaf, Blind, and Mute users — featuring real-time obstacle detection, currency recognition, walking navigation, sign-language avatar animation, and voice-first mode selection.

---

## Tech Stack

### Core Framework

| Technology | Version | Role |
|---|---|---|
| **React Native** | `0.81.5` | Cross-platform mobile UI runtime |
| **Expo SDK** | `~54.0.33` | Managed workflow, native module access |
| **TypeScript** | `~5.9.2` | Static typing throughout |
| **React** | `19.1.0` | Component model and hooks |

### Navigation

| Technology | Role |
|---|---|
| **@react-navigation/native** `^6.1.9` | Navigation container and screen transitions |
| **@react-navigation/stack** `^6.3.20` | Stack navigator (Splash → ModeSelection → Modes) |
| **react-native-screens** `~4.16.0` | Native screen optimization |
| **react-native-gesture-handler** `~2.28.0` | Gesture support for navigaton/swipe interactions |
| **react-native-safe-area-context** `~5.6.0` | Safe area insets on notched devices |

### 3D Avatar & Rendering

| Technology | Role |
|---|---|
| **Three.js** `^0.166.1` | 3D scene, lighting, materials, and animation mixer |
| **three-stdlib** `^2.36.1` | GLTFLoader + DRACOLoader for loading `.glb` avatar models |
| **expo-gl** `~16.0.10` | OpenGL ES surface in React Native (powers the 3D canvas) |
| **expo-three** `^8.0.0` | Expo-compatible Three.js renderer |
| **@react-three/fiber** `^9.5.0` | React renderer for Three.js (web path) |
| **@react-three/drei** `^10.7.7` | Three.js helpers (web path) |

> **Avatar Pipeline:** `.glb` humanoid model loaded via GLTFLoader → bones detected → `THREE.AnimationMixer` drives sign-animation clips → clips resolved from the sign lexicon using `animationLexicon.ts`.

### AI / Cloud Services

| Service | Provider | Role |
|---|---|---|
| **Object Detection** | Google Cloud Vision API / Roboflow | Detects obstacles in camera frames (Blind Mode) |
| **Currency Recognition** | Google Cloud Vision API / Roboflow | Identifies Indian currency denominations (Blind Mode) |
| **Speech-to-Text (Native)** | Google Cloud Speech-to-Text API | Converts mic recordings to text (voice commands) |
| **Speech-to-Text (Web)** | Browser Web Speech API | Web fallback for voice recognition |
| **Sign Language Recognition** | Placeholder / `signLanguage.ts` | Future: MediaPipe / TFLite |

> Provider selection is driven by the `CLOUD_PROVIDER` environment variable (`roboflow` or `google`).

### Voice & Audio

| Technology | Role |
|---|---|
| **expo-speech** `~14.0.8` | Text-to-Speech (TTS) for blind mode and voice feedback |
| **expo-av** `~16.0.8` | Microphone recording for voice commands |
| **Google Cloud STT** | Converts recorded audio (`.3gp` Android / `.wav` iOS) to text |

### Navigation & Maps

| Technology | Role |
|---|---|
| **expo-location** `~19.0.8` | GPS coordinates and heading |
| **OpenRouteService API** | Geocoding (address → coordinates) + walking route planning |
| **react-native-webview** `13.15.0` | Renders Leaflet.js + OpenStreetMap for the route map view |
| **Leaflet.js** | In-WebView interactive map with polyline route display |

### Storage & Persistence

| Technology | Role |
|---|---|
| **@react-native-async-storage/async-storage** `2.2.0` | User settings and last-used mode |
| **expo-sqlite** `~16.0.10` | Local history log (mode, output, timestamp) |

### UI & Styling

| Technology | Role |
|---|---|
| **expo-linear-gradient** `~15.0.8` | Hero gradient backgrounds on all screens |
| **@expo/vector-icons** `^15.0.3` | Ionicons icon set |
| **lottie-react-native** `~7.3.1` | Lottie animation support |
| **@expo-google-fonts/inter** `^0.4.2` | Inter font family |
| **expo-font** `~14.0.11` | Custom font loading |
| **expo-haptics** `~15.0.8` | Haptic feedback (warnings, selections, successes) |
| **expo-status-bar** `~3.0.9` | Status bar theming |

### Camera

| Technology | Role |
|---|---|
| **expo-camera** `~17.0.10` | Live camera preview for Blind Mode and Sign Mode |
| **expo-file-system** `^13.2.1` | Reading camera frame data and writing reports |
| **expo-asset** `^55.0.10` | Bundling and loading local `.glb` model assets |

### Environment / Config

| Technology | Role |
|---|---|
| **react-native-dotenv** `^3.4.11` | `.env` injection into the app (`@env` imports) |
| **babel-plugin-module-resolver** `^5.0.2` | Path aliasing (`../services` → `@services`) |

---

## Application Architecture

```
App.tsx
└── AppNavigator (React Navigation Stack)
    ├── SplashScreen          → Permissions + voice welcome
    ├── ModeSelectionScreen   → Voice-first mode selection (Blind / Sign / Deaf)
    ├── BlindModeScreen       → Camera + obstacle/currency detection + TTS + haptics
    ├── SignModeScreen        → Camera + sign-language recognition (placeholder)
    ├── DeafModeScreen        → Text input → sign animation via 3D avatar
    ├── NavigationScreen      → Walking navigation with GPS + turn-by-turn + map
    └── SettingsScreen        → Voice speed, vibration, language preferences
```

---

## Feature Modes

### 🦯 Blind Mode
- Continuous camera frame capture every 2 seconds
- Object detection → obstacle alerts with distance estimates
- Currency denomination recognition for Indian notes
- Voice-first controls (`obstacle`, `currency`, `navigate`, `back`)
- TTS announcements + haptic warnings

### 🤟 Deaf Mode
- Type text → sign-language avatar animation
- 3D humanoid avatar rendered via Three.js + `expo-gl`
- Sign lexicon covers: HELLO, THANK YOU, YES, NO, HELP, PLEASE, STOP (+ fingerspell fallback)
- Sign pipeline: Text → Gloss Mapper → Timeline Planner → Animation Executor → AnimationMixer

### 🗣️ Sign Mode
- Camera-based sign recognition (placeholder for MediaPipe/TFLite integration)

### 🧭 Navigation Mode
- Voice-driven destination input (e.g., "Salem to New York")
- Geocoding via OpenRouteService
- Walking route display on Leaflet.js map (inside WebView)
- Turn-by-turn instructions with GPS progress tracking
- Voice announcements at each step + arrival detection

---

## Environment Variables

Create a `.env` file (see `.env.example`):

```env
GOOGLE_CLOUD_VISION_API_KEY=your_key_here
ROBOFLOW_API_KEY=your_key_here
OPENROUTESERVICE_API_KEY=your_key_here
CLOUD_PROVIDER=roboflow   # or 'google'
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

---

## Permissions Required

| Permission | Platform | Why |
|---|---|---|
| Camera | Android + iOS | Obstacle detection, currency recognition, sign recognition |
| Microphone | Android + iOS | Voice commands and speech-to-text |
| Location (When In Use) | Android + iOS | Walking navigation in Blind Mode |
| Vibration | Android | Haptic feedback for alerts |

---

## Project Structure

```
src/
├── components/         # Reusable UI components (AvatarCanvas, CameraView, etc.)
├── constants/          # App config (API endpoints, voice settings, thresholds)
├── hooks/              # Custom hooks (useVoiceCommands, useSignEngine, useDeafSignPipeline)
├── navigation/         # AppNavigator stack definition
├── screens/            # All screen components
├── services/
│   ├── cloudAI/        # Object detection, currency, sign language, STT
│   └── signLanguage/   # Gloss mapper, timeline planner/executor, animation lexicon
├── theme/              # Color palette, typography, spacing, gradients
├── types/              # Shared TypeScript types
└── utils/              # Camera capture, decision engine, permissions
Docs/                   # Architecture plans and integration guides
assets/
└── models/             # avatar.glb (humanoid rigged model)
```
