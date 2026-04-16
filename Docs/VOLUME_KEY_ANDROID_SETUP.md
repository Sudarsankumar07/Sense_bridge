# Volume Key Combo — Android Native Setup Guide

> **This is required to activate the Volume Up + Down combo trigger.**  
> Without this, the app falls back to the MicFAB button only.

---

## What This Does

`react-native-keyevent` is already installed (`npm install` done).  
But it needs **3 native code changes** in your Android project to actually
intercept hardware key events and emit them to JavaScript.

---

## Step 1 — Eject to Bare Workflow (One-Time)

Since SenseBridge is a managed Expo project, run:

```bash
npx expo prebuild --platform android
```

This creates the `android/` folder with the native Android project.

> ⚠️ Do NOT run `expo prebuild` if you already have an `android/` folder — it will overwrite it.

---

## Step 2 — Edit `MainActivity.kt` (or `.java`)

File path:
```
android/app/src/main/java/com/susan07/sensebridgesusan07/MainActivity.kt
```

### If using Kotlin (`.kt`):

```kotlin
package com.susan07.sensebridgesusan07

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.view.KeyEvent                          // ← ADD THIS
import com.kevinejohn.keyevent.KeyEventModule          // ← ADD THIS

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "main"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    // ── ADD THIS BLOCK ────────────────────────────────────────────────
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        KeyEventModule.getInstance().onKeyDownEvent(keyCode, event)
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        KeyEventModule.getInstance().onKeyUpEvent(keyCode, event)
        return super.onKeyUp(keyCode, event)
    }
    // ─────────────────────────────────────────────────────────────────
}
```

### If using Java (`.java`):

```java
package com.susan07.sensebridgesusan07;

import com.facebook.react.ReactActivity;
import android.view.KeyEvent;                           // ← ADD THIS
import com.kevinejohn.keyevent.KeyEventModule;          // ← ADD THIS

public class MainActivity extends ReactActivity {

    @Override
    protected String getMainComponentName() {
        return "main";
    }

    // ── ADD THIS BLOCK ────────────────────────────────────────────────
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        KeyEventModule.getInstance().onKeyDownEvent(keyCode, event);
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        KeyEventModule.getInstance().onKeyUpEvent(keyCode, event);
        return super.onKeyUp(keyCode, event);
    }
    // ─────────────────────────────────────────────────────────────────
}
```

---

## Step 3 — Register the Package in `MainApplication.kt`

File path:
```
android/app/src/main/java/com/susan07/sensebridgesusan07/MainApplication.kt
```

```kotlin
import com.kevinejohn.keyevent.KeyEventPackage   // ← ADD THIS IMPORT

// Inside getPackages() or the packages list:
override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
        add(KeyEventPackage())                   // ← ADD THIS LINE
    }
```

---

## Step 4 — Build a Custom Dev Client

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Build a development client for Android
eas build --profile development --platform android
```

Then install the resulting APK on your Android device and use it instead of Expo Go.

---

## Step 5 — Test the Volume Combo

1. Open **Blind Mode** or **Navigation** screen
2. Press **Volume Up** and **Volume Down** at the same time (within ~300ms)
3. The MicFAB should light up with a glow ring and start listening
4. Say your command: "obstacle", "currency", "navigate", "stop", "back", "repeat"

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Volume combo doesn't fire | Check MainActivity.kt has the `onKeyDown`/`onKeyUp` overrides |
| App crashes on key press | Make sure `KeyEventPackage()` is registered in `MainApplication.kt` |
| Volume overlay still shows | This is normal — Android shows the volume overlay. The combo will still trigger |
| Works on debug but not release | Ensure `proguard-rules.pro` keeps `KeyEventModule` |

---

## How the Detection Works

```
User presses Vol↑ at T=0ms     → JavaScript receives keyCode 24
User presses Vol↓ at T=200ms   → JavaScript receives keyCode 25
Gap = |0 - 200| = 200ms < 300ms SIMULTANEOUS_WINDOW_MS
→ onTrigger() fires → MicFAB starts listening
```

The 300ms window is configurable in `useVolumeButtonTrigger.ts`.
