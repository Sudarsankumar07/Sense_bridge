# Avatar Sign Fix - Implementation Guide

## Quick Reference: 5-Step Fix Plan

### ✅ STEP 1: Identify Your Avatar's Bone Rotation Order (5 mins)

Your avatar loads successfully, which means bones exist. Now we need to find out what rotation order they use.

**Run this diagnostic:**

```bash
npx expo start --clear
# Go to DeafModeScreen
# Wait for avatar to load
# Look for console output like:
# [AvatarCanvas] Bones detected: 45 bones
# [AvatarCanvas] Bones (first 5): mixamorig_Hips, mixamorig_Spine, ...
```

The bone names confirm you're using **Mixamo Y-Bot avatar** (prefix: `mixamorig_*`).

**Next:** Try each rotation order test to see which produces natural arm positions.

---

### ✅ STEP 2: Test Rotation Orders (10 mins)

Create a temporary test file to verify which rotation order works:

**File:** `src/utils/rotationOrderTest.ts`

```typescript
import * as THREE from 'three';

// Sample data from hello.json - right arm should lift to face level
const SAMPLE_HELLO_FRAME = {
    RightShoulder: { x: 0.0, y: 0.0, z: 0.15 },
    RightArm: { x: 0.15, y: 0.2, z: -1.45 },      // Should be ~45° up-back
    RightForeArm: { x: 0.15, y: -0.3, z: 0.0 },
    RightHand: { x: 0.1, y: 0.0, z: 0.0 },
};

export const testAllRotationOrders = () => {
    const orders: Array<'XYZ' | 'XZY' | 'YXZ' | 'YZX' | 'ZXY' | 'ZYX'> = 
        ['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX'];

    console.log('🧪 Testing Rotation Orders:');
    
    orders.forEach(order => {
        const arm = SAMPLE_HELLO_FRAME.RightArm;
        const euler = new THREE.Euler(arm.x, arm.y, arm.z, order);
        const quat = new THREE.Quaternion().setFromEuler(euler);
        
        // Expected: arm should point ~45° up and back
        // Check Y component of quaternion (up direction)
        const upness = quat.w + quat.y;  // Rough heuristic
        
        console.log(`${order}: quat=(${quat.x.toFixed(2)}, ${quat.y.toFixed(2)}, ${quat.z.toFixed(2)}, ${quat.w.toFixed(2)}) upness=${upness.toFixed(2)}`);
    });
};

// Run from DeafModeScreen for testing
import { testAllRotationOrders } from '../utils/rotationOrderTest';
useEffect(() => {
    testAllRotationOrders();
}, []);
```

**What to look for:** The "upness" value should be around 0.5-0.8 for correct order. When arm points up, quaternion Y should be positive.

---

### ✅ STEP 3: Fix the Critical Euler Angle Bug

**Location:** File `src/hooks/useSignEngine.ts` Line 96

**BEFORE (❌ BROKEN):**
```typescript
const quat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(bone.x, bone.y, bone.z)  // ❌ Uses default XYZ order
);
```

**AFTER (✅ FIXED):**
```typescript
// Determine rotation order from JSON metadata
// Most Mixamo exports use ZYX or XYZ
// You can hardcode or detect dynamically

const rotationOrder = 'ZYX'; // ← CHANGE THIS if test shows different order

const quat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(bone.x, bone.y, bone.z, rotationOrder as THREE.EulerOrder)
);
```

**Edit Instructions:**

```tsx
// Find this code around line 96 in useSignEngine.ts:
values.push(quat.x, quat.y, quat.z, quat.w);

// And BEFORE it (line 86-95), change:
// FROM:
const quat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(bone.x, bone.y, bone.z)
);

// TO:
const ROTATION_ORDER: THREE.EulerOrder = 'ZYX';  // ← Try XYZ, ZYX, YXZ if this doesn't work
const euler = new THREE.Euler(bone.x, bone.y, bone.z, ROTATION_ORDER);
const quat = new THREE.Quaternion().setFromEuler(euler);
```

---

### ✅ STEP 4: Fix Animation Weight Conflict

**Location:** File `src/components/AvatarCanvas.native.tsx` Line 222

**BEFORE (❌ BROKEN):**
```typescript
const idleAction = mixer.clipAction(idleClip);
idleAction.setLoop(THREE.LoopRepeat, Infinity);
idleAction.weight = 1;  // ❌ 100% = blocks sign animations
idleAction.play();
```

**AFTER (✅ FIXED):**
```typescript
const idleAction = mixer.clipAction(idleClip);
idleAction.setLoop(THREE.LoopRepeat, Infinity);
idleAction.weight = 0.3;  // ✅ 30% = recessive, sign animations override
idleAction.play();
```

---

### ✅ STEP 5: Test With Debugging

**Add this temporary logging:** In `src/hooks/useSignEngine.ts` around line 165

```typescript
const playText = async (text: string) => {
    clearPlayback();

    const words = textToGloss(text);
    if (words.length === 0) return;

    console.log('[SignEngine] 🎭 Playing:', text, '→ Glosses:', words);

    let delayMs = 0;
    words.forEach((word) => {
        const directClip = buildSignClip(word);
        const clips = directClip ? [directClip] : buildFingerspellClips(word);

        console.log(`  - "${word}": ${clips.length} clip(s)`);

        clips.forEach((clip) => {
            const timer = setTimeout(() => {
                console.log(`    ▶️ Playing clip "${clip.name}" (${clip.duration.toFixed(2)}s, ${clip.tracks.length} bones)`);
                
                const action = mixer.clipAction(clip);
                action.setLoop(THREE.LoopOnce, 1);
                action.play();
                
                currentActions.push(action);
            }, delayMs);

            activeTimers.push(timer);
            delayMs += clip.duration * 1000 + CLIP_GAP_MS;
        });
    });

    // ... rest of function
};
```

**Test:** Type "hello yes thank you" and watch console - you should see:
```
[SignEngine] 🎭 Playing: hello yes thank you → Glosses: ['hello', 'yes', 'thankyou']
  - "hello": 1 clip(s)
    ▶️ Playing clip "hello" (1.40s, 15 bones)
  - "yes": 1 clip(s)
    ▶️ Playing clip "yes" (1.00s, 14 bones)
  - "thankyou": 1 clip(s)
    ▶️ Playing clip "thankyou" (0.90s, 16 bones)
```

If you see 0 bones (tracks.length = 0), then Step 3 fix didn't work - check your rotation order.

---

## Advanced: Verify Bone Names Match

Sometimes the avatar has different bone names than expected.

**Check this:**

```typescript
// Add to AvatarCanvas.native.tsx after line 170 (after gltf loaded)

const debugInfo = {
    totalBones: 0,
    sampleBones: [] as string[],
    hasRightArm: false,
    hasRightHand: false,
};

gltf.scene.traverse((obj: THREE.Object3D) => {
    if (obj instanceof THREE.Bone) {
        debugInfo.totalBones++;
        if (debugInfo.sampleBones.length < 5) {
            debugInfo.sampleBones.push(obj.name);
        }
        if (obj.name.includes('RightArm')) debugInfo.hasRightArm = true;
        if (obj.name.includes('RightHand')) debugInfo.hasRightHand = true;
    }
});

console.log('[AvatarCanvas] Skeleton debug:', debugInfo);
```

**If output shows:**
- ✅ `hasRightArm: true, hasRightHand: true` → Bone names are correct
- ❌ `hasRightArm: false` → Bone names are different, update BONE_ALIASES

---

## Full Working Example

After applying all fixes, your animation should look like:

```typescript
// useSignEngine.ts - Complete Fixed Version (excerpt)

const toClip = (name: string, signData: SignClipData): THREE.AnimationClip | null => {
    const tracks: THREE.KeyframeTrack[] = [];
    const boneNames = new Set<string>();

    signData.frames.forEach((frame) => {
        Object.keys(frame.bones).forEach((boneName) => boneNames.add(boneName));
    });

    // ✅ FIX: Use correct rotation order
    const ROTATION_ORDER: THREE.EulerOrder = 'ZYX';

    boneNames.forEach((boneName) => {
        const times: number[] = [];
        const values: number[] = [];

        signData.frames.forEach((frame) => {
            const bone = frame.bones[boneName];
            if (!bone) return;

            times.push(frame.time);
            
            // ✅ CRITICAL FIX: Proper rotation order
            const euler = new THREE.Euler(bone.x, bone.y, bone.z, ROTATION_ORDER);
            const quat = new THREE.Quaternion().setFromEuler(euler);
            values.push(quat.x, quat.y, quat.z, quat.w);
        });

        if (times.length > 0) {
            const aliases = BONE_ALIASES[boneName] ?? [boneName];
            aliases.forEach((alias) => {
                tracks.push(
                    new THREE.QuaternionKeyframeTrack(
                        `${alias}.quaternion`,
                        times,
                        values
                    )
                );
            });
        }
    });

    return tracks.length > 0 ? new THREE.AnimationClip(name, signData.duration, tracks) : null;
};
```

---

## File Edit Summary

| File | Line | Change | Impact |
|------|------|--------|--------|
| `useSignEngine.ts` | 86-101 | Add rotation order 'ZYX' | Signs animate |
| `AvatarCanvas.native.tsx` | 222 | Change weight 1 → 0.3 | Sign visible |
| `useSignEngine.ts` | 165+ | Add console.log | Can debug |

---

## Expected Results After Fix

❌ **BEFORE:**
- Avatar loads ✅
- When play "hello": nothing visible ❌
- Console: `▶️ Playing clip "hello" (1.40s, 15 bones)`
- But avatar doesn't move

✅ **AFTER:**
- Avatar loads ✅
- When play "hello": arm lifts to face, waves out ✅
- Smooth motion for ~1.4 seconds ✅
- Returns to idle ✅
- Next sign plays automatically ✅

---

## If Still Not Working

Check in this order:

1. **Rotation order wrong?**
   - Try each order: 'XYZ', 'YXZ', 'ZYX'
   - One will look natural, others look weird

2. **Bone names don't match?**
   - Run debug code above
   - Update BONE_ALIASES

3. **No keyframes in clip?**
   - Is hello.json in assets/signs/?
   - Is JSON valid? (Use jsonlint.com)

4. **Mixer not updating?**
   - Check clock.getDelta() working
   - Verify animate() loop running

5. **Idle animation still blocking?**
   - Reduce weight further (0.1)
   - Or disable idle temporarily for testing

---

## Next: Production Quality

Once basic animations work, enhance with:

1. **More signs:** Capture MediaPipe data from ISL signers
2. **Left hand:** Add bilateral support to JSON
3. **Smooth transitions:** Increase keyframe density
4. **Non-manuals:** Facial expressions, eyebrow movements

See main RCA document for details.
