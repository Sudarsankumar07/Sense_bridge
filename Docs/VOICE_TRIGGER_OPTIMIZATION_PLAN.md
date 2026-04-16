# 🎙️ Voice Recognition Trigger Optimization Plan

> **Goal:** Replace the always-on, continuous voice-listening loop with on-demand triggers to drastically reduce Google Cloud Speech-to-Text (STT) API calls and costs.

---

## 📊 Current Architecture Analysis

### How Voice Recognition Works Today

| Layer | File | What it does |
|---|---|---|
| **Voice Engine** | `src/services/voiceEngine.ts` | Records audio via `expo-av`, sends to Google Cloud STT, returns transcript |
| **Voice Loop Hook** | `src/hooks/useVoiceCommands.ts` | Continuously calls `listenForCommand()` in an infinite `while` loop with a 500ms delay between each cycle |
| **Blind Mode** | `src/screens/BlindModeScreen.tsx` | Uses `useVoiceCommands` — always listening for "obstacle", "currency", "navigate", "back" |
| **Navigation Screen** | `src/screens/NavigationScreen.tsx` | Direct `listenForCommand()` calls in a loop — listens for "stop", "back", "repeat" during navigation |

### The Cost Problem

The current `useVoiceCommands` hook runs a continuous listen loop:

```ts
// useVoiceCommands.ts — line 69-85
while (mounted && activeRef.current) {
    const result = await listenForCommand(3000);  // <- 3-second API call every cycle!
    // ...
    await new Promise((r) => setTimeout(r, 500)); // tiny 500ms gap between calls
}
```

Each `listenForCommand(3000)` on native:
1. Allocates a new `Audio.Recording`
2. Records for 3 seconds of audio
3. Sends a base64 audio blob to Google Cloud Speech-to-Text
4. Incurs an API cost even if the user said nothing

**Estimated cost:** With a 3.5s cycle (3s record + 0.5s delay), the app makes ~17 API calls/minute and ~1,020 calls/hour while active. At Google Cloud STT pricing (~$0.006 per 15-sec chunk), this can add up to significant cost rapidly.

---

## Proposed Solutions

Two complementary approaches are proposed. Option A is the primary UI solution; Option B is the advanced hardware-key shortcut.

---

## Option A — Floating Mic Button (FAB)

### UX Concept

A circular Floating Action Button (FAB) with a mic icon is pinned to the bottom-right corner of every screen that uses voice commands. The user taps (or taps and holds) to start a single voice recognition session. No audio is recorded until the button is pressed.

```
+----------------------------------+
|                                  |
|       [ Screen Content ]         |
|                                  |
|                                  |
|                          +----+  |
|                          | MIC|  |
|                          +----+  |
+----------------------------------+
```

### States of the FAB Button

| State | Visual | Behaviour |
|---|---|---|
| **Idle** | Mic icon, grey/dim | Tap to activate |
| **Listening** | Mic icon, glowing/pulsing animation, primary colour | Actively recording |
| **Processing** | Spinner, muted colour | Waiting for Cloud STT result |
| **Success** | Checkmark flash, then back to idle | Command recognized |
| **Error/No speech** | Brief red flash, then back to idle | No command found |

### Files to Change

#### 1. New Component: `src/components/MicFAB.tsx`

Create a reusable floating button component:

```tsx
// Props interface
type MicFABProps = {
    onCommandReceived: (text: string) => void;
    listenTimeoutMs?: number;   // default 5000
    disabled?: boolean;
};
```

- Renders a `TouchableOpacity` with absolute positioning at `bottom: 24, right: 24`
- Shows `Ionicons name="mic"` when idle
- Shows animated pulse ring when listening
- Shows `ActivityIndicator` when processing
- Calls `listenForCommand()` once on press, then calls `onCommandReceived(text)`
- Uses `Animated.loop` for the pulse ring glow effect

#### 2. Modified: `src/hooks/useVoiceCommands.ts`

Remove the infinite `while (mounted)` loop entirely.

Add a new exported callback `triggerVoiceListen()` that fires a single `listenForCommand()` call and dispatches the matched command.

The `useVoiceCommands` hook should:
- Return a `triggerListen` callback
- NOT start any loop automatically
- Still speak the intro message on mount (one-time TTS, no STT cost)

```ts
// New hook signature (non-looping)
export const useVoiceCommands = (options) => {
    const triggerListen = useCallback(async () => {
        const result = await listenForCommand(options.timeoutMs ?? 5000);
        if (result.text) {
            const handler = matchCommand(result.text);
            handler?.();
        }
    }, [matchCommand, options.timeoutMs]);

    return { triggerListen };
};
```

#### 3. Modified: `src/screens/BlindModeScreen.tsx`

- Import and render `<MicFAB>` at the bottom-right
- Pass the `triggerListen` callback from `useVoiceCommands` to the `MicFAB`
- Remove any always-on listening behavior

#### 4. Modified: `src/screens/NavigationScreen.tsx`

- The navigation destination flow (asking for a place) still needs a single voice capture on demand
- The in-navigation loop (`while (activeRef.current)`) should be removed
- Replace with a `<MicFAB>` that, when pressed during navigation, listens for "stop", "repeat", "back"
- The initial destination capture can show the MicFAB with a "Tap mic to say destination" prompt

---

## Option B — Volume Up + Down Hardware Button Trigger

### UX Concept

When the user simultaneously presses both Volume Up and Volume Down buttons, voice recognition starts. This is especially useful for visually impaired users who cannot see the screen.

> Note for blind users: This is the preferred method since they don't need to locate a button on screen.

### Technical Approach

React Native does not have a built-in API for detecting simultaneous volume key presses. The recommended approach varies by platform:

#### Android — Use `react-native-volume-manager`

The library `react-native-volume-manager` allows listening to volume button events. Detecting simultaneous press of both buttons requires a timing trick: track the last press time of each button and fire when both are pressed within a ~200ms window.

```ts
// Pseudocode
VolumeManager.addVolumeListener((event) => {
    if (event.type === 'volumeUp') lastVolUpTime = Date.now();
    if (event.type === 'volumeDown') lastVolDownTime = Date.now();

    const timeDiff = Math.abs(lastVolUpTime - lastVolDownTime);
    if (timeDiff < 200) {
        // Both pressed simultaneously -> trigger mic
        triggerVoiceListen();
    }
});
```

#### iOS — Limited support

iOS does not expose volume button events to apps in the same way. This workaround requires a native module and is NOT available in Expo Go without a custom dev build.

**Recommendation for iOS:** Fall back to the FAB button (Option A).

### Files to Change for Option B

#### 5. New Hook: `src/hooks/useVolumeButtonTrigger.ts`

```ts
type UseVolumeButtonTriggerOptions = {
    onTrigger: () => void;
    enabled?: boolean;
};

export const useVolumeButtonTrigger = ({ onTrigger, enabled = true }: UseVolumeButtonTriggerOptions) => {
    // Platform.OS === 'android' only
    // Listen to volume events, detect simultaneous press within 200ms
    // Call onTrigger() when detected
    // Suppress the default volume change (keep volume unchanged)
};
```

#### 6. New Dependency

```bash
npx expo install react-native-volume-manager
```

> This requires a custom Expo dev build (not compatible with Expo Go).

---

## Summary of All Files to Modify / Create

| Action | File | Change |
|---|---|---|
| **Create** | `src/components/MicFAB.tsx` | New floating mic button component |
| **Modify** | `src/hooks/useVoiceCommands.ts` | Remove infinite loop; return `triggerListen` |
| **Modify** | `src/screens/BlindModeScreen.tsx` | Add `<MicFAB>`, wire `triggerListen` |
| **Modify** | `src/screens/NavigationScreen.tsx` | Replace listen loop with `<MicFAB>` |
| **Create** (Optional) | `src/hooks/useVolumeButtonTrigger.ts` | Volume key combo trigger hook |

---

## Implementation Phases

### Phase 1 — Core Button (Works in Expo Go)
1. Create `MicFAB.tsx` with idle/listening/processing states
2. Refactor `useVoiceCommands.ts` to non-looping, returns `triggerListen`
3. Update `BlindModeScreen.tsx` to use `<MicFAB>`
4. Update `NavigationScreen.tsx` to use `<MicFAB>`
5. Test: API calls should only happen on button press

### Phase 2 — Volume Button Trigger (Needs Custom Dev Build)
1. Install `react-native-volume-manager`
2. Create `useVolumeButtonTrigger.ts`
3. Add the hook to `BlindModeScreen` and `NavigationScreen`
4. Add a toggle in `SettingsScreen.tsx` to enable/disable volume key trigger
5. Build custom dev client: `eas build --profile development`

---

## UX Recommendations

- **Add TTS prompt on mount:** "Tap the mic button at bottom right to give a voice command." This helps blind users discover the button.
- **Haptic feedback:** Use `hapticSelection()` when the FAB is pressed to give tactile confirmation.
- **Volume button toggle in Settings:** Let users choose between FAB-only or FAB + volume key shortcut.
- **Visual indicator:** Show a small tooltip or badge on the FAB on first launch.
- **Auto-dismiss timeout:** If the user pressed the mic but says nothing for 5s, dismiss listening state with a gentle vibration.

---

## Expected Cost Impact

| Mode | Before (per hour) | After Phase 1 (per hour) |
|---|---|---|
| BlindMode session | ~1,020 STT API calls | 0–10 (on-demand only) |
| NavigationScreen | ~1,020 STT API calls | 0–10 (on-demand only) |
| **Monthly cost** | High ($$$) | Near-zero (<$1/month typical) |

---

> **Next Step:** Confirm which option(s) to implement, then implementation will begin starting with `MicFAB.tsx` and refactoring `useVoiceCommands.ts`.
