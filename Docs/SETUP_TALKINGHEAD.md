# TalkingHead Setup Guide for SenseBridge

## Quick Setup (5 minutes)

### Step 1: Verify Installation ✅

All code is already implemented! Check these files exist:

```
✅ TalkingHead/sensebridge-avatar.html
✅ src/services/gestureMapping.ts
✅ src/components/AvatarView.tsx (updated)
✅ src/screens/DeafModeScreen.tsx (updated)
```

### Step 2: Bundle Assets

The TalkingHead folder needs to be accessible to the app.

#### For Expo (Current Setup)
Assets are already configured in `app.json`:
```json
"assetBundlePatterns": ["**/*"]
```

No action needed! ✅

#### For React Native CLI (If you migrate)
Copy TalkingHead to Android assets:
```bash
mkdir -p android/app/src/main/assets
cp -r TalkingHead android/app/src/main/assets/
```

### Step 3: Test on Device

```bash
# Android
npm run android

# iOS (if applicable)
npm run ios
```

### Step 4: Navigate to Deaf Mode

1. Open app
2. Select "Deaf Mode"
3. Wait for avatar to load (shows "⏳ Loading")
4. When ready, shows "✓ Ready"
5. Transcripts will trigger avatar speech

## Expected Behavior

### On Load
- Loading indicator appears
- Status shows "⏳ Loading"
- Avatar initializes (5-10 seconds)
- Status changes to "✓ Ready"
- Haptic feedback on ready

### On Transcript
- New transcript appears in list
- Avatar speaks with lip-sync
- Gestures trigger automatically:
  - "yes" → thumbs up
  - "hello" → wave
  - "thank you" → namaste
  - etc.

## Troubleshooting

### Avatar Not Loading

**Check 1: Internet Connection**
First load requires internet to download Three.js from CDN.

**Check 2: WebView Console**
```bash
# Enable Chrome DevTools for WebView
adb shell
settings put global webview_devtools_enabled 1
```
Then open Chrome → `chrome://inspect` → Find WebView

**Check 3: Asset Bundling**
```bash
# Rebuild with fresh assets
npm run android -- --reset-cache
```

### No Lip-Sync

**Check 1: Transcript Text**
Ensure transcript is not empty string.

**Check 2: Avatar Model**
Verify `brunette.glb` has viseme morphs (it should).

**Check 3: Console Logs**
Look for errors in WebView console.

### Gestures Not Playing

**Check 1: Keywords**
Use exact keywords: "yes", "hello", "thank you", etc.

**Check 2: Gesture Names**
Available gestures: wave, thumbup, thumbdown, handup, namaste

**Check 3: Avatar Ready**
Gestures only work after avatar is ready.

### Performance Issues

**Solution 1: Reduce Quality**
Edit `TalkingHead/sensebridge-avatar.html`:
```javascript
modelPixelRatio: 1,  // Lower quality
modelFPS: 20,        // Lower framerate
```

**Solution 2: Change Camera View**
```javascript
cameraView: 'head',  // Show only head (less geometry)
```

**Solution 3: Close Other Apps**
Free up device memory.

## Testing Checklist

### Basic Tests
- [ ] App builds without errors
- [ ] Deaf Mode screen opens
- [ ] Avatar loading indicator shows
- [ ] Avatar loads successfully
- [ ] Status changes to "✓ Ready"

### Functionality Tests
- [ ] Transcript "hello" triggers wave gesture
- [ ] Transcript "yes" triggers thumbup gesture
- [ ] Transcript "thank you" triggers namaste gesture
- [ ] Avatar shows lip-sync animation
- [ ] Multiple transcripts work in sequence

### Error Tests
- [ ] Airplane mode shows error gracefully
- [ ] Invalid transcript doesn't crash
- [ ] Back button works during loading
- [ ] App recovers from WebView errors

## Configuration Options

### Change Avatar Emotion
Edit `DeafModeScreen.tsx`:
```typescript
const [currentEmotion, setCurrentEmotion] = useState<string>('happy');
```

### Add More Gestures
Edit `src/services/gestureMapping.ts`:
```typescript
{
  keywords: ['awesome', 'great'],
  gesture: 'thumbup',
  emotion: 'happy'
}
```

### Adjust Performance
Edit `TalkingHead/sensebridge-avatar.html`:
```javascript
head = new TalkingHead(canvas, {
  modelPixelRatio: 2,    // 1-3 (lower = faster)
  modelFPS: 30,          // 15-60 (lower = faster)
  cameraView: 'upper',   // 'head', 'upper', 'full'
});
```

## File Structure

```
SenseBridge/
├── TalkingHead/
│   ├── sensebridge-avatar.html    ← Main host page
│   ├── modules/
│   │   └── talkinghead.mjs        ← Core library
│   ├── avatars/
│   │   └── brunette.glb           ← Avatar model
│   └── README_MOBILE.md           ← Mobile guide
├── src/
│   ├── components/
│   │   └── AvatarView.tsx         ← WebView wrapper
│   ├── screens/
│   │   └── DeafModeScreen.tsx     ← Main screen
│   └── services/
│       └── gestureMapping.ts      ← Gesture logic
└── Docs/
    └── TalkingHead_DeafMode_Integration_Plan.md
```

## Next Steps

1. ✅ Implementation complete
2. ⏳ Test on Android device
3. ⏳ Test on iOS device (if applicable)
4. ⏳ Gather user feedback
5. ⏳ Add more gestures/emotions
6. ⏳ Implement sign language (Phase 3)

## Support Resources

- **Quick Reference**: `TalkingHead/README_MOBILE.md`
- **Full Integration Guide**: `TalkingHead/SENSEBRIDGE_INTEGRATION.md`
- **Implementation Summary**: `TALKINGHEAD_IMPLEMENTATION_SUMMARY.md`
- **Original Plan**: `Docs/TalkingHead_DeafMode_Integration_Plan.md`

## Common Commands

```bash
# Clean build
npm run android -- --reset-cache

# Check logs
adb logcat | grep -i "avatar\|webview"

# Enable WebView debugging
adb shell settings put global webview_devtools_enabled 1

# Clear app data
adb shell pm clear com.sensebridge

# Reinstall
npm run android -- --reset-cache
```

## Success Indicators

✅ Avatar loads within 10 seconds
✅ Lip-sync matches transcript
✅ Gestures trigger automatically
✅ No crashes or freezes
✅ Smooth 30 FPS animation
✅ Status indicators work correctly

## Need Help?

1. Check console logs (WebView + React Native)
2. Review troubleshooting section above
3. Verify asset bundling is correct
4. Test with simple transcript first
5. Try on different device if issues persist

---

**Ready to test!** 🚀

Run `npm run android` and navigate to Deaf Mode to see the avatar in action.
