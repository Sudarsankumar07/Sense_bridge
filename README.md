# 🌉 SenseBridge - Accessibility Mobile Application

**SenseBridge** is an offline-first, voice-controlled accessibility mobile application built with React Native. It provides three specialized modes designed to assist people with visual, hearing, or speech disabilities through on-device AI processing.

---

## 📖 About the Project

### What is SenseBridge?

SenseBridge is a **zero-cost, privacy-first accessibility app** that runs entirely on your phone without requiring an internet connection. It uses advanced AI models for real-time assistance while keeping all processing local to your device.

### Who is it for?

- **Blind/Visually Impaired Users** - Navigate safely with obstacle detection and currency recognition
- **Deaf/Hard of Hearing Users** - Understand speech through visual sign language animations
- **People who use Sign Language** - Communicate through voice by signing to the camera

### Key Principles

- 🔒 **Privacy First** - All processing happens on your device, no data leaves your phone
- 🌐 **Offline Capable** - Works without internet connection
- 🗣️ **Voice-Driven** - Accessible through voice commands for hands-free operation
- ♿ **Accessibility Focused** - Large buttons, haptic feedback, screen reader compatible
- 💰 **Zero Cost** - Built with free, open-source technologies

---

## 🎯 Features by Mode

### 🦯 Blind Mode - Visual Assistance

**Real-time Obstacle Detection:**
- Detects people, stairs, and obstacles in your path
- Voice alerts: "Person ahead", "Step detected", "Obstacle ahead"
- Distance estimation based on object size
- Haptic vibration warnings

**Indian Currency Recognition:**
- Identifies Indian rupee notes and coins
- Speaks denomination: "Ten rupees", "Five hundred rupees"
- Multi-frame verification for accuracy
- Works in various lighting conditions

**How it works:**
1. App uses rear camera to continuously scan environment
2. YOLOv5 AI model detects objects
3. Decision engine filters and throttles alerts
4. Voice announcements guide you safely

---

### 👋 Sign Mode - Sign Language to Voice

**Hand Sign Recognition:**
- Recognizes common sign language gestures
- Converts signs to text on screen
- Speaks recognized words using text-to-speech
- Builds phrases from multiple signs

**Phrase Building:**
- Collects multiple signs into sentences
- Auto-speaks complete phrases after 3 seconds
- Clear phrase button to start over
- Real-time confidence display

**How it works:**
1. Front camera captures your hand gestures
2. MediaPipe extracts hand landmarks (21 points)
3. TFLite classifier identifies the sign
4. Text appears on screen and is spoken aloud

---

### 🧏 Deaf Mode - Speech to Sign Language

**Speech Recognition:**
- Converts spoken words to text
- Displays transcript with timestamps
- Fully offline speech recognition

**3D Avatar Animation:**
- Animated sign language avatar
- Performs signs for recognized words
- Fingerspelling for unknown words
- Synchronized subtitles

**How it works:**
1. Microphone captures speech
2. Vosk AI recognizes words offline
3. Unity avatar performs corresponding sign animations
4. Text transcript shows what was said

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────┐
│           React Native UI Layer             │
│   (Voice-controlled, Accessible Design)     │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────┴───────────────────────────┐
│          Core Services Layer                │
│  - Voice Engine (TTS + STT)                 │
│  - Decision Engine (Alert Logic)            │
│  - Storage Service (SQLite + AsyncStorage)  │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────┴───────────────────────────┐
│        Native Modules Layer (Android)       │
│  - TFLiteModule (AI Inference)              │
│  - VoskModule (Offline Speech Recognition)  │
│  - MediaPipeModule (Hand Tracking)          │
│  - UnityBridge (3D Avatar Rendering)        │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────┴───────────────────────────┐
│         AI Models (On-Device)               │
│  - YOLOv5 Nano (Obstacle Detection)         │
│  - YOLOv5 Nano (Currency Recognition)       │
│  - CNN Classifier (Sign Recognition)        │
│  - Vosk Small English Model                 │
└─────────────────────────────────────────────┘
```

---

## 🚀 How to Run

### Prerequisites

Before you begin, ensure you have:

1. **Node.js** (version 18 or higher)
   ```bash
   node --version
   ```

2. **Android Phone** with:
   - USB cable
   - Developer Mode enabled
   - USB Debugging enabled

3. **Android Studio** (optional, only for SDK tools)

---

### Step-by-Step Installation

#### 1️⃣ Clone and Install Dependencies

```bash
# Navigate to project directory
cd "c:\Users\sudarsan kumar\OneDrive\Desktop\Sense_bridge\SenseBridge"

# Install all dependencies
npm install
```

#### 2️⃣ Enable Developer Mode on Your Phone

**For Android:**
1. Go to **Settings** → **About Phone**
2. Tap **Build Number** 7 times (you'll see "You are now a developer!")
3. Go back to **Settings** → **Developer Options**
4. Enable **USB Debugging**

#### 3️⃣ Connect Your Phone

1. Connect your Android phone to computer via USB cable
2. On phone, allow USB debugging when prompted
3. Select **File Transfer** mode

#### 4️⃣ Verify Connection

```bash
# Check if device is connected
adb devices
```

You should see output like:
```
List of devices attached
ABC123XYZ    device
```

#### 5️⃣ First Build (Takes 5-10 minutes)

```bash
# Build native Android app and install on phone
npx expo run:android
```

This command will:
- ✅ Build the native Android project
- ✅ Install the app on your phone
- ✅ Start Metro bundler
- ✅ Launch the app automatically

**Wait for the app to open on your phone!**

#### 6️⃣ Daily Development (After First Build)

For subsequent development sessions, you only need:

```bash
# Start Metro bundler
npx expo start
```

Then:
- **Automatic**: App auto-launches if phone is connected
- **Manual**: Scan QR code with Expo Go app
- **Fast Refresh**: Code changes reload automatically

---

### 📱 Using the App

1. **App Opens** → Hear "Welcome to SenseBridge..."

2. **Choose Mode:**
   - Say **"Blind Mode"** or tap the button
   - Say **"Sign Mode"** or tap the button
   - Say **"Deaf Mode"** or tap the button

3. **Grant Permissions:**
   - Camera permission (for Blind & Sign modes)
   - Microphone permission (for Deaf mode)

4. **Use Features:**
   - **Blind Mode**: Point camera at objects, tap "Check Currency" for notes
   - **Sign Mode**: Show hand signs to front camera
   - **Deaf Mode**: Tap "Start Listening", then speak

5. **Exit**: Tap "Exit" button or say "Exit"

---

## 📁 Project Structure

```
SenseBridge/
├── 📱 App.js                    # Main app entry, navigation setup
│
├── 🖼️ screens/                  # All app screens
│   ├── WelcomeScreen.js         # Voice-controlled mode selection
│   ├── BlindModeScreen.js       # Obstacle & currency detection
│   ├── SignModeScreen.js        # Sign language recognition
│   └── DeafModeScreen.js        # Speech to sign avatar
│
├── 🧩 components/               # Reusable UI components
│   ├── LargeButton.js           # Accessible button with voice feedback
│   ├── VoiceFeedback.js         # Listening animation component
│   └── ModeIndicator.js         # Mode banner component
│
├── ⚙️ services/                 # Core business logic
│   ├── storageService.js        # SQLite + AsyncStorage wrapper
│   ├── voiceEngine.js           # TTS + STT integration
│   └── decisionEngine.js        # Alert throttling & normalization
│
├── 🔧 modules/                  # Native Android modules (to implement)
│   ├── TFLiteModule/            # TensorFlow Lite integration
│   ├── VoskModule/              # Vosk speech recognition
│   ├── MediaPipeModule/         # Hand landmark detection
│   └── UnityBridge/             # Unity 3D avatar control
│
├── 📦 assets/                   # Models and resources
│   └── models/                  # AI models (.tflite files)
│
├── 📄 app.json                  # Expo configuration
├── 📄 package.json              # Dependencies
├── 📖 README.md                 # This file
├── 📖 TESTING.md                # Testing guide
└── 📖 NATIVE_MODULES.md         # Native module implementation guide
```

---

## 🎯 Current Implementation Status

### ✅ Fully Implemented (Ready to Test)

- ✔️ **React Native App Structure** - Complete navigation system
- ✔️ **All UI Screens** - Welcome, Blind, Sign, Deaf modes
- ✔️ **Voice Engine** - Text-to-speech working
- ✔️ **Storage Service** - SQLite database for settings
- ✔️ **Decision Engine** - Alert throttling and management
- ✔️ **Camera Integration** - Front & back camera previews
- ✔️ **Accessible UI** - Large buttons, haptics, voice feedback
- ✔️ **Voice Commands** - Mode selection and navigation

**You can test all UI features NOW!**

### 🚧 Pending (Requires Native Module Development)

- ⏳ **Obstacle Detection** - Needs TFLite module (mock data currently)
- ⏳ **Currency Recognition** - Needs TFLite module (mock data currently)
- ⏳ **Sign Recognition** - Needs MediaPipe + TFLite modules
- ⏳ **Speech-to-Text** - Needs Vosk module (placeholder currently)
- ⏳ **3D Avatar** - Needs Unity integration (emoji placeholder currently)

**See `NATIVE_MODULES.md` for implementation guide.**

---

## 🛠️ Technologies Used

### Frontend
- **React Native** - Cross-platform mobile framework
- **Expo SDK 54** - Development platform
- **React Navigation** - Screen routing

### Services & APIs
- **Expo Speech** - Text-to-speech (Android TTS)
- **Expo Camera** - Camera access
- **Expo SQLite** - Local database
- **Expo Haptics** - Vibration feedback

### AI & ML (To be integrated)
- **TensorFlow Lite** - On-device AI inference
- **YOLOv5 Nano** - Object detection model
- **MediaPipe Hands** - Hand landmark detection
- **Vosk** - Offline speech recognition
- **Unity 2022 LTS** - 3D avatar rendering

### Data & Training
- **COCO Dataset** - Obstacle detection training
- **Kaggle Indian Currency** - Currency recognition
- **WLASL/ISL Datasets** - Sign language training

---

## 🎤 Voice Commands Reference

| Command | Action | Available In |
|---------|--------|--------------|
| "Blind Mode" | Navigate to Blind Mode | Welcome Screen |
| "Sign Mode" | Navigate to Sign Mode | Welcome Screen |
| "Deaf Mode" | Navigate to Deaf Mode | Welcome Screen |
| "Check Currency" | Scan currency note | Blind Mode |
| "Exit" or "Back" | Return to Welcome Screen | Any Mode |
| "Help" | Show help information | Any Screen |

---

## 🧪 Testing & Debugging

### View Console Logs
```bash
npx expo start
```
All `console.log()` outputs appear in the terminal.

### Clear Cache and Rebuild
```bash
cd android
./gradlew clean
cd ..
npx expo prebuild --clean
npx expo run:android
```

### Check Detailed Android Logs
```bash
adb logcat | findstr "ReactNativeJS"
```

### Common Issues

**Issue:** App won't build
- **Solution**: Clear cache and rebuild (see above)

**Issue:** Camera not working
- **Solution**: Check Settings → Apps → SenseBridge → Permissions

**Issue:** No voice output
- **Solution**: Increase phone volume, check TTS is enabled

**Issue:** Device not detected
- **Solution**: Reinstall device drivers, try different USB cable

---

## 📊 Performance Expectations

- **App Size**: ~80-100MB (with models)
- **Memory Usage**: <200MB RAM
- **Battery Impact**: Moderate (camera processing)
- **Frame Rate**: 2-3 FPS (obstacle detection)
- **Response Time**: <500ms (voice feedback)

---

## 🗺️ Roadmap

### Phase 1: Foundation ✅ (Completed)
- Project setup
- UI components
- Navigation system
- Core services

### Phase 2: Native Integration 🔨 (In Progress)
- TFLite module
- Vosk module
- MediaPipe module
- Unity bridge

### Phase 3: AI Models 📋 (Planned)
- Train currency model
- Train sign classifier
- Optimize models
- Test accuracy

### Phase 4: Polish & Release 🎯 (Future)
- Performance optimization
- Battery efficiency
- Comprehensive testing
- App store deployment

---

## 👥 Contributing

Contributions are welcome! This is an accessibility-focused project aimed at helping people with disabilities.

**Areas for Contribution:**
- AI model training and optimization
- Native module development
- UI/UX improvements
- Testing and bug reports
- Documentation
- Translation to other languages

---

## 📄 License

This project is licensed under the **MIT License** - see LICENSE file for details.

---

## 🙏 Acknowledgments

- **Google MediaPipe** - Hand tracking technology
- **Alpha Cephei (Vosk)** - Offline speech recognition
- **Google TensorFlow** - On-device AI framework
- **Ultralytics YOLOv5** - Object detection model
- **Expo Team** - React Native development platform
- **Open-source community** - For accessible technologies

---

## 📞 Support

For issues, questions, or suggestions:
1. Check `TESTING.md` for common problems
2. Review `NATIVE_MODULES.md` for implementation details
3. Open an issue on the project repository

---

**Built with ❤️ for accessibility and inclusion** 🌍
