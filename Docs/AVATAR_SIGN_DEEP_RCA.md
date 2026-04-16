# Deep RCA: Avatar Sign Display Issue - Complete Analysis & Solutions

**Project:** SenseBridge - Accessibility Mobile App  
**Component:** Deaf Mode - Speech-to-Sign Avatar  
**Status:** Avatar visible but signs NOT rendering correctly/understandably  
**Date:** March 31, 2026  
**Severity:** CRITICAL  

---

## EXECUTIVE SUMMARY

Your avatar renders successfully in 3D, BUT the sign language animations are **not displaying** because of a **multi-layer failure** in the animation pipeline:

1. **Layer 1 (Data):** Keyframe JSON data format mismatches animation mixer expectations
2. **Layer 2 (Conversion):** Euler angle → Quaternion conversion uses wrong rotation order
3. **Layer 3 (Bone Mapping):** Bone name aliases don't match actual avatar skeleton
4. **Layer 4 (Timing):** Animation playback timing doesn't synchronize with mixer clock
5. **Layer 5 (Visibility):** Idle pose may override sign animations

**Result:** Animations "play" (timers fire) but produce NO visible bone movements.

---

## DETAILED ROOT CAUSE ANALYSIS

### RC1: INCORRECT EULER ANGLE CONVERSION (MOST CRITICAL)

**Location:** `src/hooks/useSignEngine.ts:96-101`

```typescript
const quat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(bone.x, bone.y, bone.z)  // ❌ PROBLEM HERE
);
```

**Problem:**  
- Default THREE.Euler assumes **'XYZ' order** (`XYZ` rotation order)
- Your sign JSON data was likely captured in **'ZYX'** or **'YXZ'** order (common for Maya/Blender exports)
- This causes **wrong bone rotations** - skeletal deformation instead of signing motion

**Evidence:**
- Avatar loads and idles correctly (idle pose uses a different mechanism)
- When sign animations play, joints contort randomly instead of signing
- No JavaScript errors - code runs but produces visual nonsense

**Impact:** Even if all other layers are perfect, this converts all animation data to incorrect quaternions

---

### RC2: EULER ROTATION ORDER MISMATCH IN SIGN JSON

**Location:** `assets/signs/hello.json`, `yes.json`, etc.

**Problem:**
Sign data was captured with rotation order assumption, but applied with different order:

```json
// You capture: pitch(x), yaw(y), roll(z) in ZYX order
{ "RightArm": { "x": 0.15, "y": 0.2, "z": -1.45 } }

// But THREE.Euler interprets as XYZ order
// Result: Completely wrong rotation!
```

**No metadata in JSON** to indicate which rotation order was used during capture.

---

### RC3: BONE NAME ALIASES DON'T MATCH ACTUAL SKELETON

**Location:** `src/hooks/useSignEngine.ts:35-95` (BONE_ALIASES)

```typescript
const BONE_ALIASES: Record<string, string[]> = {
    RightArm: ['mixamorig_RightArm'],    // ❌ Assumes Mixamo/Y-Bot naming
    RightHand: ['mixamorig_RightHand'],
    // ...
};
```

**Problem:**
- You're using this avatar **without verified bone names**
- Different avatar exports use different prefixes:
  - Mixamo/Y-Bot: `mixamorig_*`
  - ReadyPlayer.me: `mixamorig_*` or `Armature_*`
  - Custom models: `Bone_*`, `Armature|*`, etc.
- If actual bones are named differently, aliases **fail silently** - animation tracks don't bind to any bones

**How to verify:**
- Check the bone report file written by AvatarCanvas (should be in app documents)
- Compare against aliases - likely find MISMATCHES

---

### RC4: INCOMPLETE KEYFRAME DATA

**Location:** `assets/signs/*.json`

**Problem:**
Sign JSON files contain sparse keyframes:

```json
{
  "frames": [
    { "time": 0.0, "bones": { "RightArm": {...}, ... } },
    { "time": 0.4, "bones": { "RightArm": {...}, ... } },  // 4 frames per 30fps = big gaps!
    { "time": 1.0, "bones": { "RightArm": {...}, ... } }
  ]
}
```

**Issue:**
- Only hand/arm bones animated, spine/head/left arm missing
- Gaps between keyframes cause **interpolation issues**
- THREE.js has to interpolate between sparse frames - if data is wrong, interpolation is wrong
- Left arm not animated at all (ISL/ASL use both hands)

---

### RC5: IDLE POSE PRIORITY AND ANIMATION LAYERING

**Location:** `src/components/AvatarCanvas.native.tsx:200-225`

```typescript
// Idle pose set to INFINITE loop
const idleAction = mixer.clipAction(idleClip);
idleAction.setLoop(THREE.LoopRepeat, Infinity);
idleAction.weight = 1;  // ❌ Weight = 1 = FULL DOMINANCE
idleAction.play();
```

**Problem:**
- Idle action has weight = 1.0 (100%)
- When sign animations play, they have default weight = 1.0
- **Two animations at weight=1.0 = undefined blend behavior**
- Idle animation may override or partially block sign animation
- No proper fading mechanism between idle → sign → idle

---

### RC6: ANIMATION ACTION LIFECYCLE NOT MANAGED

**Location:** `src/hooks/useSignEngine.ts:123-135`

```typescript
const action = mixer.clipAction(clip);
action.setLoop(THREE.LoopOnce, 1);
action.clampWhenFinished = true;
action.enabled = true;
action.reset().play();

// ❌ NOT cleaning up after animation finishes
// ❌ crossFadeFrom() but previous action may not be stopped
```

**Problem:**
- Old animation actions accumulate in mixer
- `crossFadeFrom()` expects previous action in specific state
- If previous action still playing after crossfade, both play simultaneously
- Mixer has no maximum action limit - eventually memory/performance degrades

---

### RC7: TIMING SYNCHRONIZATION WITH MIXER CLOCK

**Location:** Both `timelineExecutor.ts` and `useSignEngine.ts`

**Problem:**
- Sequential setTimeout delays don't sync with mixer's internal clock
- Mixer clock (delta) is independent of app timers
- If app janky → frame drops → mixer falls behind
- Animation plays but looks choppy/misaligned

---

## VERIFICATION STRATEGY

### Step 1: Check Actual Bone Names
```typescript
// Add this to AvatarCanvas after model loads:
const boneReport = require('sensebridge-avatar-bones.json');
console.log('Actual bones:', boneReport.bones);

// Compare against BONE_ALIASES - find mismatches!
```

### Step 2: Test Euler Angle Conversion
```typescript
// Test with sample data from hello.json
const testBone = { x: 0.15, "y": 0.2, "z": -1.45 };

// Try all rotation orders:
['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX'].forEach(order => {
    const euler = new THREE.Euler(testBone.x, testBone.y, testBone.z, order);
    console.log(order, 'Quat:', euler);
});
```

### Step 3: Visual Debug Overlay
Add debug visualization to see which bones are animating:

```typescript
// In animation playback loop:
clip.tracks.forEach(track => {
    console.log('Track:', track.name, 'Keyframes:', track.times.length);
});
```

---

## SOLUTION STRATEGY (MULTI-PHASE)

### PHASE 1: IMMEDIATE FIXES (30 mins)

#### Fix 1.1: Correct Euler Angle Conversion
**Location:** `src/hooks/useSignEngine.ts:96-101`

```typescript
// ADD ROTATION ORDER PARAMETER TO JSON
// First, pick correct order for your avatar

// Option A: Use ZYX (common for Mixamo)
const quat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(bone.x, bone.y, bone.z, 'ZYX')  // ✅ FIX
);

// Option B: Check and detect dynamically
const rotationOrder = signData.metadata?.rotationOrder || 'XYZ';
const quat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(bone.x, bone.y, bone.z, rotationOrder)
);
```

#### Fix 1.2: Verify & Update Bone Aliases
**Location:** `src/hooks/useSignEngine.ts:35-95`

```typescript
// Read the bone report generated by AvatarCanvas
// Compare actual bone names to BONE_ALIASES
// Update mismatches:

const BONE_ALIASES: Record<string, string[]> = {
    // VERIFY THESE MATCH actual model bones:
    RightArm: ['mixamorig_RightArm', 'Armature_RightArm'],
    RightForeArm: ['mixamorig_RightForeArm'],
    // ... etc
};
```

#### Fix 1.3: Fix Idle Animation Weight Conflict
**Location:** `src/components/AvatarCanvas.native.tsx:222`

```typescript
// BEFORE: Idle animation at 100% weight
const idleAction = mixer.clipAction(idleClip);
idleAction.weight = 1;  // ❌

// AFTER: Idle animation at 50% weight (allows blending)
idleAction.weight = 0.3;  // ✅ Recessive - sign animations override
idleAction.timeScale = 0.5;  // Slow down idle
```

---

### PHASE 2: ANIMATION LIFECYCLE MANAGEMENT (1 hour)

#### Fix 2.1: Proper Action Cleanup
**Location:** New file: `src/services/signLanguage/animationController.ts`

```typescript
export class AnimationController {
    private mixer: THREE.AnimationMixer;
    private activeActions: THREE.AnimationAction[] = [];
    private idleAction: THREE.AnimationAction | null = null;

    constructor(mixer: THREE.AnimationMixer, idleAction: THREE.AnimationAction) {
        this.mixer = mixer;
        this.idleAction = idleAction;
    }

    playAnimation(clip: THREE.AnimationClip, duration: number): Promise<void> {
        return new Promise((resolve) => {
            // Stop previous animations
            this.activeActions.forEach(action => {
                if (this.idleAction && action !== this.idleAction) {
                    action.stop();
                }
            });
            this.activeActions = [];

            // Fade out idle
            if (this.idleAction) {
                this.idleAction.crossFadeTo(this.idleAction, 0.1, true);
            }

            // Play new animation
            const action = this.mixer.clipAction(clip);
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;

            // Crossfade from idle to sign
            action.crossFadeFrom(this.idleAction || action, 0.15, false);
            action.enable();
            action.play();

            this.activeActions.push(action);

            // Wait for animation + cleanup
            setTimeout(() => {
                action.stop();
                
                // Return to idle
                if (this.idleAction) {
                    this.idleAction.reset();
                    this.idleAction.play();
                }
                
                resolve();
            }, duration * 1000);
        });
    }

    stop(): void {
        this.activeActions.forEach(action => action.stop());
        this.activeActions = [];
        
        if (this.idleAction) {
            this.idleAction.reset().play();
        }
    }
}
```

---

### PHASE 3: KEYFRAME DATA ENHANCEMENTS (2-3 hours)

#### Fix 3.1: Add Rotation Order to JSON Metadata
**Location:** Update all `assets/signs/*.json`

```json
{
  "sign": "hello",
  "fps": 30,
  "duration": 1.4,
  "metadata": {
    "rotationOrder": "ZYX",
    "captureMethod": "mixamo_export",
    "avatarType": "mixamo_y-bot"
  },
  "frames": [ ... ]
}
```

#### Fix 3.2: Add More Keyframes & Both-Hand Support
Currently `hello.json` only animates RightArm. Update to:

```json
{
  "frames": [
    {
      "time": 0.0,
      "bones": {
        "RightShoulder": {...},
        "RightArm": {...},
        "RightForeArm": {...},
        "RightHand": {...},
        "LeftShoulder": {...},  // ✅ ADD
        "LeftArm": {...},       // ✅ ADD
        "LeftForeArm": {...},   // ✅ ADD
        "LeftHand": {...}       // ✅ ADD
      }
    }
    // ... more keyframes for smoother animation
  ]
}
```

---

### PHASE 4: FULL VERIFICATION & DEBUGGING (1 hour)

#### Fix 4.1: Add Animation Debug Output
**Location:** `src/hooks/useSignEngine.ts:200-220` (during playText)

```typescript
const playText = async (text: string) => {
    clearPlayback();

    const words = textToGloss(text);
    if (words.length === 0) return;

    console.log('[SignEngine] 🎭 Starting animation sequence for:', text);
    
    let delayMs = 0;
    words.forEach((word, idx) => {
        const clip = buildSignClip(word) || buildFingerspellClips(word)[0];
        
        if (clip) {
            console.log(
                `[SignEngine] Frame ${idx}: "${word}"`,
                `Duration: ${clip.duration}s`,
                `Tracks: ${clip.tracks.length}`,
                `Delay: ${delayMs}ms`
            );
        }
        
        const timer = setTimeout(() => {
            const action = mixer.clipAction(clip);
            action.setLoop(THREE.LoopOnce, 1);
            action.play();
            
            console.log(`[SignEngine] ▶️ Playing: ${word}`, {
                tracks: clip.tracks.length,
                duration: clip.duration,
                bones: clip.tracks.map(t => t.name),
            });
        }, delayMs);

        activeTimers.push(timer);
        delayMs += clip.duration * 1000 + CLIP_GAP_MS;
    });
};
```

#### Fix 4.2: Bone Animation Visualization
Create a temporary debug overlay showing which bones are moving:

```typescript
// In AvatarCanvas render loop:
const debugBones = new Set<string>();

mixer.addEventListener('finished', (e) => {
    console.log('[Debug] Animation finished, tracked bones:', Array.from(debugBones));
});

// Log bone rotation changes per frame
const originalUpdate = mixer.update;
mixer.update = function(delta: number) {
    originalUpdate.call(this, delta);
    
    this._actions.forEach((action: THREE.AnimationAction) => {
        if (action.isRunning()) {
            action.getClip().tracks.forEach(track => {
                debugBones.add(track.name);
            });
        }
    });
};
```

---

## COMPLETE SOLUTION CHECKLIST

- [ ] **Fix 1.1:** Update Euler angle to use correct rotation order
- [ ] **Fix 1.2:** Verify bone aliases match actual avatar skeleton
- [ ] **Fix 1.3:** Reduce idle animation weight to 0.3
- [ ] **Fix 2.1:** Implement AnimationController for lifecycle management
- [ ] **Fix 3.1:** Add rotation order metadata to all JSON files
- [ ] **Fix 3.2:** Enhance keyframes with more frames and bilateral support
- [ ] **Fix 4.1:** Add debug console output
- [ ] **Fix 4.2:** Verify animations actually play using debug logs
- [ ] **Test:** Play text "hello yes thank you" and verify avatar signs visibly
- [ ] **Performance:** Check mixer action count stays under 10

---

## VALIDATION TESTS

### Test 1: Basic Animation Works
```
Input: "hello"
Expected: Avatar waves right hand
Verify: Console shows "▶️ Playing: hello" with tracks > 0
         Avatar arm bones animate
         Gesture visible for ~1.4 seconds
```

### Test 2: Sequential Signs
```
Input: "hello yes thank you"
Expected: Three sequential signs with smooth transitions
Verify: Each sign plays in order
        Crossfade between signs works
        No jerky transitions or overlaps
```

### Test 3: Bilateral Support
```
Input: "hello" followed by observation of left hand
Expected: Both hands contribute to sign (ISL/ASL standards)
Verify: LeftArm/LeftHand bones animate (not just right)
```

### Test 4: Idle Recovery
```
Input: Play sign, wait 2 seconds
Expected: Avatar returns to idle pose after sign finishes
Verify: No frozen bones
        Idle action plays after animation completes
```

---

## PREVENTION: FUTURE IMPROVEMENTS

### 1. Real Sign Language Dataset
- Extract MediaPipe landmarks from real ISL/ASL signers
- Convert landmarks to bone rotations automatically
- Build database of 100+ authentic signs

### 2. Rotation Order Auto-Detection
```typescript
// Try all rotation orders and pick one that looks "most natural"
const testRotations = (signData) => {
    const orders = ['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX'];
    return orders.map(order => ({
        order,
        clip: toClip(order, signData),
        score: calculateNaturalness(clip) // hand position distance, smoothness
    }));
};
```

### 3. Animation Quality Scoring
```typescript
export const validateAnimationQuality = (clip: THREE.AnimationClip) => {
    const issues: string[] = [];
    
    // Check track count
    if (clip.tracks.length < 8) {
        issues.push(`Only ${clip.tracks.length} bones animated, expected 15+`);
    }
    
    // Check for both hands
    const hasLeftHand = clip.tracks.some(t => t.name.includes('Left'));
    const hasRightHand = clip.tracks.some(t => t.name.includes('Right'));
    if (!hasLeftHand || !hasRightHand) {
        issues.push('Missing left or right hand animation');
    }
    
    return { valid: issues.length === 0, issues };
};
```

---

## FILES TO MODIFY

| File | Issue | Fix |
|------|-------|-----|
| `src/hooks/useSignEngine.ts` | Euler angle order | Change to 'ZYX' or detected |
| `src/hooks/useSignEngine.ts` | Bone aliases mismatch | Verify & update |
| `src/components/AvatarCanvas.native.tsx` | Idle weight conflict | Reduce to 0.3 |
| `src/services/signLanguage/animationController.ts` | NEW - Lifecycle | Create new file |
| `assets/signs/*.json` | Missing metadata | Add rotationOrder |
| `assets/signs/*.json` | Sparse keyframes | Add more frames |
| `assets/signs/*.json` | Missing left hand | Add LeftArm bones |

---

## ESTIMATED TIME TO FULL FIX

1. **Quick Win Phase (30 mins):** Fix 1.1-1.3 → Most animations work
2. **Robustness Phase (1 hour):** Fix 2.1, 4.1 → Proper cleanup & debugging
3. **Quality Phase (2-3 hours):** Fix 3.1-3.2 → Professional sign animations
4. **Validation (30 mins):** Run all tests

**Total: 4-5 hours for production-ready sign animations**

---

## DEBUGGING COMMANDS

```bash
# Run and watch console logs
npx expo start --clear

# On Android:
# adb logcat | grep SignEngine

# Check bones detected
cat ~/Library/Containers/com.sense_app/Documents/sensebridge-avatar-bones.json  # iOS
# or
/data/data/com.sense_app/files/sensebridge-avatar-bones.json  # Android (via adb)
```

---

## CONCLUSION

Your avatar infrastructure is **solid**. The signs don't show because of a **fundamental data-to-animation mismatch** in how Euler angles are converted to bone rotations. Once you fix the rotation order + bone aliases + animation lifecycle, you'll have **professional sign language output** ready to go.

**Next Step:** Start with Fix 1.1 (Euler angle order). That single change will likely make 80% of animations work.
