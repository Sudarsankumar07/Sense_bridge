# SenseBridge - Testing Guide

## Testing the Current Build

The JavaScript layer is complete and ready to test. Follow these steps to build and run on your Android phone.

## 🔌 Phase 1: Test UI and JavaScript Features

### Build and Install

1. **Connect your Android phone** via USB and enable USB debugging

2. **Verify connection**:
   ```bash
   adb devices
   ```

3. **Build  and run**:
   ```bash
   cd c:\Users\sudarsan kumar\OneDrive\Desktop\Sense_bridge\SenseBridge
   npx expo run:android
   ```

### What to Test

#### ✅ Welcome Screen
- [ ] App launches and shows welcome screen
- [ ] Voice greeting plays: "Welcome to SenseBridge..."
- [ ] Three large buttons are visible and tapable
- [ ] Buttons speak their labels when tapped
- [ ] Vibration feedback on button press

#### ✅ Navigation
- [ ] Tap "Blind Mode" → navigates to Blind Mode screen
- [ ] Tap "Sign Mode" → navigates to Sign Mode screen
- [ ] Tap "Deaf Mode" → navigates to Deaf Mode screen
- [ ] Voice says mode name when navigating

#### ✅ Blind Mode Screen
- [ ] Camera permission request appears
- [ ] Grant permission → camera preview shows
- [ ] Mode indicator banner shows "BLIND MODE"
- [ ] "Check Currency" button is tappable
- [ ] "Exit" button returns to welcome screen

#### ✅ Sign Mode Screen
- [ ] Camera permission request appears
- [ ] Grant permission → front camera preview shows
- [ ] Mode indicator shows "SIGN MODE"
- [ ] "Clear Phrase" button exists
- [ ] Phrase buffer area shows "No words yet"

#### ✅ Deaf Mode Screen
- [ ] Screen shows avatar placeholder
- [ ] "Start Listening" button is visible
- [ ] Transcript area shows "No speech detected yet"
- [ ] Tap "Start Listening" → voice feedback appears

#### ✅ Database and Storage
- [ ] App doesn't crash on launch (SQLite initialized)
- [ ] Settings persist between app restarts
- [ ] No errors in console about database

### Expected Behavior

**What WILL work:**
- All UI elements
- Navigation between screens
- Camera preview (after granting permission)
- Text-to-speech (voice announcements)
- Button haptics
- Voice feedback animations
- SQLite storage

**What WON'T work yet (needs native modules):**
- Actual obstacle detection (mock data only)
- Currency recognition (mock data only)
- Sign recognition (mock data only)
- Speech-to-text recognition (placeholder only)
- 3D avatar animations (placeholder only)

## 📹 Phase 2: Camera Testing

### Blind Mode Camera
Expected: Rear camera preview shows
Test: Point at different objects - **no detection yet**

### Sign Mode Camera
Expected: Front camera preview shows
Test: Make hand gestures - **no recognition yet**

## 🎤 Phase 3: Voice Testing

### Text-to-Speech
Expected: All buttons and screens speak announcements
Test: Listen for voice feedback

### Speech-to-Text
Expected: Listening indicator shows, but **no actual recognition yet**
Test: Tap "Start Listening" in Deaf Mode

## 🐛 Troubleshooting

### App won't build
```bash
# Clear cache
cd android
./gradlew clean
cd ..
npx expo prebuild --clean
npx expo run:android
```

### Camera not working
- Check permissions in phone Settings → Apps → SenseBridge → Permissions
- Grant Camera and Microphone permissions

### No voice output
- Check phone volume is up
- Test: Tap any button, it should speak the label
- If silent, TTS might not be initialized (check console logs)

### Database errors
- Look for SQLite errors in console
- App should create database on first launch
- Try: Clear app data and reinstall

## 📊 Success Criteria

Before proceeding to native module development, verify:

- [x] App builds successfully
- [x] No crashes on launch
- [x] Navigation works between all screens
- [x] Camera previews work (both front and back)
- [x] Text-to-speech works for all announcements
- [x] Buttons provide haptic feedback
- [x] UI is accessible (large buttons, high contrast)
- [x] Database initializes without errors

## 🚀 Next Phase

Once all JavaScript features are verified working:

1. Proceed to `NATIVE_MODULES.md` for native integration
2. Implement TFLiteModule for AI detection
3. Implement VoskModule for speech recognition
4. Implement MediaPipeModule for hand tracking
5. Implement UnityBridge for 3D avatar

## 💡 Tips

- Use `console.log()` extensively - output appears in terminal
- Shake phone to reload app after code changes
- Check `adb logcat` for native errors
- Test on mid-range device for realistic performance
- Clear app data if strange behavior occurs
