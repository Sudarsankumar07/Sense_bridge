# Avatar Not Showing - Root Cause Analysis (RCA)

## Executive Summary
**Critical Issue**: Platform resolution is broken. The app is running on **WEB** but is trying to load the **NATIVE** component using expo-gl, which doesn't work without a proper WebGL canvas context.

Error: `"Node cannot be found in the current page"` = expo-gl cannot find a canvas node because the web platform doesn't have GLView support configured.

---

## Evidence

### 1. Platform Detection in Bundle URL
```
AppEntry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable
```
✅ **CONFIRMED**: You are running on **WEB PLATFORM**, not native Expo Go.

### 2. Component Export Issue
**File**: `src/components/AvatarCanvas.ts`
```typescript
export { AvatarCanvas } from './AvatarCanvas.native';
```

**Problem**: This shim HARDCODES the import to `.native`, bypassing React Native's automatic platform resolution. 

**What should happen**:
- On web: React Native should pick up `AvatarCanvas.web.tsx`
- On native: React Native should pick up `AvatarCanvas.native.tsx`

**What's actually happening**:
- On web: Still loads `AvatarCanvas.native.tsx`
- This tries to use `GLView` (expo-gl) which doesn't work on web

### 3. Chain of Failure
```
1. App loading on web platform (platform=web)
   ↓
2. DeafModeScreen imports { AvatarCanvas } from '../components/AvatarCanvas'
   ↓
3. AvatarCanvas.ts exports from AvatarCanvas.native (hardcoded)
   ↓
4. AvatarCanvas.native.tsx tries to create GLView and use Three.js
   ↓
5. expo-gl cannot initialize WebGL context on web
   ↓
6. Error: "Node cannot be found in the current page"
   ↓
7. Avatar renders as blank/loading forever
```

### 4. Expected vs Actual File Resolution
|  | Expected | Actual |
|---|----------|--------|
| **Web Platform** | Load `AvatarCanvas.web.tsx` | Loads `AvatarCanvas.native.tsx` ❌ |
| **Native Platform** | Load `AvatarCanvas.native.tsx` | Loads `AvatarCanvas.native.tsx` ✅ |

---

## Why This Happened

1. **Platform-Specific Splitting Setup**: Two files created in previous work:
   - `AvatarCanvas.native.tsx` (full 3D renderer using expo-gl)
   - `AvatarCanvas.web.tsx` (web placeholder fallback)

2. **Shim File Misunderstanding**: The `AvatarCanvas.ts` shim was intended as a temporary workaround for TypeScript module resolution, but it **permanently locks** the platform to native.

3. **Missing Configuration**: React Native's platform resolution (`.native` / `.web` suffixes) only works when you export from a file WITHOUT platform suffix. The shim broke this.

---

## Root Cause Categories

### Primary (Direct Cause)
- ❌ **AvatarCanvas.ts forces native import**: Hardcoded `export { AvatarCanvas } from './AvatarCanvas.native'` prevents platform detection

### Secondary (Environment Mismatch)
- ❌ **Running on web instead of Expo Go**: Web platform doesn't support expo-gl the way it's configured
- ✅ **expo-gl installed**: Package exists, but can't initialize on web

### Tertiary (Configuration)
- ⚠️ **No error boundary**: App silently fails without alerting user to platform mismatch
- ⚠️ **No fallback**: When GLView fails, nothing catches the error

---

## Solution

### Immediate Fix (5 minutes)
**Delete the shim file that hardcodes platform:**

```bash
# DELETE this file:
src/components/AvatarCanvas.ts
```

**Update DeafModeScreen import** from:
```typescript
import { AvatarCanvas } from '../components/AvatarCanvas';
```

To:
```typescript
import { AvatarCanvas } from '../components/AvatarCanvas.native';
```

**Why this works**:
- Removes the hardcoded platform shim
- When React Native Metro bundler processes the web bundle, it will EXCLUDE `.native.tsx` files automatically
- Leaves `AvatarCanvas.web.tsx` as the only valid web component
- Native platform continues to load `.native.tsx` normally

### Verify Platform After Fix
After fix, you should see in console:
- **On web**: "Avatar Preview Unavailable on Web" message (from AvatarCanvas.web.tsx)
- **On Expo Go**: 3D avatar renderer with "Loading avatar model..." (from AvatarCanvas.native.tsx)

---

## Why Tests Passed Earlier

✅ All previous tests (TypeScript, file creation, Draco support) **passed** because:
- TypeScript just checks syntax/types, doesn't care about platform resolution
- The actual platform _mismatch_ only happens at **runtime** when Metro tries to resolve modules

---

## Prevention

For future platform-specific components, follow this pattern:

**DO**:
```typescript
// GOOD: Use platform-specific extensions directly
import Component from './Component.native';  // or .web
import Component from './Component';  // Use automatic Metro resolution
```

**DON'T**:
```typescript
// BAD: Hardcoded shim bypasses platform detection
export { Component } from './Component.native';  // Locks to native forever
```

---

## Next Steps After Fix

1. **Verify web fallback works**: Run `npx expo start --go --web` and confirm you see fallback message
2. **Test on Expo Go**: Run on actual Android/iOS device and confirm avatar renders
3. **If avatar still doesn't show on Expo Go**:
   - Check bone detection: Look for `sensebridge-avatar-bones.json` in app documents
   - Check console for GLView errors or Three.js load failures
   - Verify `assets/models/avatar.glb` is not corrupted
   - Check camera framing logic (may need zoom adjustment)

---

## Related Issues Fixed by This

- ✅ "Node cannot be found in the current page" → Resolves by using web component
- ✅ Shadow/pointer/animation warnings → Not related to avatar visibility (deprecation notices only)
- ✅ Expo AV deprecation → Not blocking (separate audio module)
- ✅ Touch warnings → React Native web quirk, not related to avatar rendering

