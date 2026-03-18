# Running with Expo Start

## Quick Start

```bash
# Start Expo development server
expo start

# Or using npm
npm start
```

Then:
1. Scan QR code with Expo Go app (Android/iOS)
2. Or press 'a' for Android emulator
3. Or press 'i' for iOS simulator

## Compatibility

The TalkingHead avatar implementation works with:

✅ **expo start** (development server)
✅ **Expo Go app** (scan QR code)
✅ **Android emulator** (press 'a')
✅ **iOS simulator** (press 'i')
✅ **Development builds**
✅ **Production builds**

## How It Works

The implementation uses:
- **Inline HTML** (no file loading issues)
- **CDN assets** (TalkingHead + avatar from internet)
- **WebView** (built into Expo Go)

No native configuration or ejecting needed!

## Requirements

### 1. Internet Connection ⚠️
**Required on first load** to download:
- TalkingHead library (~200KB)
- Avatar model (~2MB)
- Three.js library (~500KB)

After first load, assets are cached and work offline.

### 2. Device/Emulator
Avatar requires WebView which is available on:
- ✅ Android device/emulator
- ✅ iOS device/simulator
- ❌ Web browser (shows fallback UI)

### 3. Expo Go or Development Build
- ✅ Expo Go app (easiest)
- ✅ Custom development build
- ✅ EAS Build

## Testing Steps

### Step 1: Start Expo
```bash
expo start
```

### Step 2: Open in Expo Go
- Scan QR code with Expo Go app
- Or press 'a' for Android emulator

### Step 3: Navigate to Deaf Mode
1. App opens to mode selection
2. Tap "Deaf Mode"
3. Wait for avatar to load

### Step 4: Verify Avatar
- Loading indicator appears
- Status shows "⏳ Loading"
- After 10-15 seconds: "✓ Ready"
- Transcripts trigger speech

## Expected Timeline

```
0s   - Deaf Mode opens
0s   - Loading indicator appears
2s   - "Loading TalkingHead library..."
5s   - "Creating avatar instance..."
7s   - "Loading avatar model..."
10s  - "Loading: 50%"
15s  - "Avatar ready" ✓
```

## Troubleshooting

### Issue: Avatar Never Loads

**Check 1: Internet Connection**
```bash
# Test CDN access
curl https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.2/modules/talkinghead.mjs
curl https://models.readyplayer.me/6746f0e3fd5d6a955dc63f1e.glb
```

**Check 2: WebView Console**
Enable remote debugging:
1. Shake device to open dev menu
2. Select "Debug Remote JS"
3. Open Chrome DevTools
4. Check Console tab for errors

**Check 3: Network Restrictions**
Some networks block CDN access:
- Try different WiFi network
- Try mobile data
- Check firewall settings

### Issue: "Failed to load avatar" Error

**Solution 1: Wait Longer**
First load can take 15-20 seconds on slow connections.

**Solution 2: Clear Cache**
```bash
# Clear Expo cache
expo start -c

# Or
npm start -- --clear
```

**Solution 3: Check Logs**
```bash
# View Expo logs
expo start

# In another terminal
adb logcat | grep -i "avatar\|webview"
```

### Issue: Blank Screen

**Check 1: Platform**
Avatar doesn't work in web browser. Use device/emulator.

**Check 2: WebView**
Ensure react-native-webview is installed:
```bash
npm list react-native-webview
# Should show: react-native-webview@13.15.0
```

**Check 3: Expo Go Version**
Update Expo Go app to latest version from app store.

## Performance Tips

### For Slow Connections
Edit `src/components/AvatarView.tsx` to use lower quality:

```javascript
// In getInlineHTML() function, find:
modelPixelRatio: Math.min(window.devicePixelRatio, 2),
modelFPS: 30

// Change to:
modelPixelRatio: 1,  // Lower quality
modelFPS: 20         // Lower framerate
```

### For Faster Loading
Use a smaller avatar model:
```javascript
// In getInlineHTML() function, find:
url: 'https://models.readyplayer.me/6746f0e3fd5d6a955dc63f1e.glb',

// Try a simpler avatar (smaller file)
url: 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb',
```

## Development Workflow

### Typical Flow
```bash
# 1. Start Expo
expo start

# 2. Open in Expo Go (scan QR)

# 3. Make code changes
# (Expo auto-reloads)

# 4. Test avatar in Deaf Mode

# 5. Check logs for errors
```

### Hot Reload
Expo automatically reloads when you save files:
- ✅ Component changes reload instantly
- ✅ Style changes reload instantly
- ⚠️ Avatar reloads from scratch (10-15s)

### Debug Mode
```bash
# Enable debug mode
expo start --dev-client

# Or in Expo Go:
# Shake device → "Debug Remote JS"
```

## Expo Go vs Development Build

### Expo Go (Recommended for Testing)
✅ No build required
✅ Instant updates
✅ Easy to share (QR code)
✅ Works with TalkingHead
❌ Limited native modules

### Development Build
✅ Full native module support
✅ Custom native code
✅ Better performance
❌ Requires build step

**For TalkingHead**: Expo Go is sufficient!

## Common Commands

```bash
# Start Expo
expo start

# Start with cache clear
expo start -c

# Start in production mode
expo start --no-dev --minify

# Start on specific platform
expo start --android
expo start --ios

# View logs
expo start --dev-client

# Build for testing
eas build --profile development --platform android
```

## Network Requirements

### CDN Endpoints Used
```
https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.2/
https://cdn.jsdelivr.net/npm/three@0.180.0/
https://models.readyplayer.me/
```

### Firewall Rules
If behind corporate firewall, whitelist:
- cdn.jsdelivr.net
- models.readyplayer.me
- unpkg.com (Three.js fallback)

### Offline Mode
After first successful load:
- ✅ Avatar works offline (cached)
- ✅ Gestures work offline
- ✅ Lip-sync works offline
- ❌ New avatars need internet

## Testing Checklist

### Before Testing
- [ ] Internet connection active
- [ ] Expo Go app installed
- [ ] Device/emulator ready
- [ ] `expo start` running

### During Testing
- [ ] Scan QR code
- [ ] App opens successfully
- [ ] Navigate to Deaf Mode
- [ ] Loading indicator appears
- [ ] Wait 15 seconds
- [ ] Avatar loads and shows "✓ Ready"

### Verify Features
- [ ] Transcript appears in list
- [ ] Avatar mouth moves (lip-sync)
- [ ] "hello" triggers wave gesture
- [ ] "yes" triggers thumbup gesture
- [ ] Status indicators work

## FAQ

### Q: Why does it take so long to load?
**A:** First load downloads ~3MB from CDN. Subsequent loads are instant (cached).

### Q: Can I use it offline?
**A:** After first load, yes! Assets are cached by browser.

### Q: Does it work in Expo Go?
**A:** Yes! That's what it's designed for.

### Q: Can I use custom avatars?
**A:** Yes, but they must be hosted online (CDN URL). Local files don't work in Expo.

### Q: Why not bundle assets locally?
**A:** Expo managed workflow doesn't support bundling HTML with imports. CDN approach works universally.

### Q: Will it work in production?
**A:** Yes! Same code works in development and production builds.

## Next Steps

1. ✅ Run `expo start`
2. ✅ Open in Expo Go
3. ✅ Test Deaf Mode
4. ✅ Verify avatar loads
5. ⏳ Gather feedback
6. ⏳ Optimize if needed

## Support

### If Avatar Doesn't Load
1. Check internet connection
2. Wait full 15-20 seconds
3. Check WebView console
4. Try different network
5. Clear Expo cache
6. Update Expo Go app

### If Still Issues
1. Check `EXPO_FIX_NOTES.md`
2. Check `README_TALKINGHEAD.md`
3. Enable debug mode
4. Check logs for errors

---

**Status**: ✅ Compatible with Expo Start
**Tested**: Expo SDK 54 + Expo Go
**Platform**: Android/iOS (not web)
