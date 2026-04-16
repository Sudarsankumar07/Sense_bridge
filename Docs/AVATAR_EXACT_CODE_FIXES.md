# Ready-to-Apply Code Fixes

## FIX #1: Rotation Order in useSignEngine.ts

**File:** `src/hooks/useSignEngine.ts`  
**Line:** ~86-101 in the `toClip()` function

### Current Code (Broken)
```typescript
boneNames.forEach((boneName) => {
    const times: number[] = [];
    const values: number[] = [];

    signData.frames.forEach((frame) => {
        const bone = frame.bones[boneName];
        if (!bone) {
            return;
        }

        times.push(frame.time);
        const quat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(bone.x, bone.y, bone.z)  // ❌ BROKEN
        );
        values.push(quat.x, quat.y, quat.z, quat.w);
    });
```

### Fixed Code
```typescript
boneNames.forEach((boneName) => {
    const times: number[] = [];
    const values: number[] = [];

    signData.frames.forEach((frame) => {
        const bone = frame.bones[boneName];
        if (!bone) {
            return;
        }

        times.push(frame.time);
        
        // ✅ FIX: Use correct Euler rotation order for Mixamo avatar
        // Mixamo typically exports with ZYX or XYZ order
        // If signs still look wrong after this, try: 'XYZ', 'YXZ', 'ZYX'
        const ROTATION_ORDER: THREE.EulerOrder = 'ZYX';
        
        const euler = new THREE.Euler(bone.x, bone.y, bone.z, ROTATION_ORDER);
        const quat = new THREE.Quaternion().setFromEuler(euler);
        values.push(quat.x, quat.y, quat.z, quat.w);
    });
```

---

## FIX #2: Idle Animation Weight in AvatarCanvas.native.tsx

**File:** `src/components/AvatarCanvas.native.tsx`  
**Line:** ~216-225 in the animation setup

### Current Code (Broken)
```typescript
if (idleTracks.length > 0) {
    const idleClip = new THREE.AnimationClip('idle', 9999, idleTracks);
    const idleAction = mixer.clipAction(idleClip);
    idleAction.setLoop(THREE.LoopRepeat, Infinity);
    idleAction.weight = 1;  // ❌ BLOCKS SIGN ANIMATIONS
    idleAction.play();
    console.log('[AvatarCanvas] Idle pose applied, tracks:', idleTracks.length);
}
```

### Fixed Code
```typescript
if (idleTracks.length > 0) {
    const idleClip = new THREE.AnimationClip('idle', 9999, idleTracks);
    const idleAction = mixer.clipAction(idleClip);
    idleAction.setLoop(THREE.LoopRepeat, Infinity);
    idleAction.weight = 0.3;  // ✅ REDUCED - allows sign animations to override
    idleAction.play();
    console.log('[AvatarCanvas] Idle pose applied (weight: 0.3), tracks:', idleTracks.length);
}
```

---

## FIX #3: Debug Logging in useSignEngine.ts

**File:** `src/hooks/useSignEngine.ts`  
**Location:** In the `playText` function, around line 165

### Add This Debug Code
```typescript
const playText = async (text: string) => {
    clearPlayback();

    const words = textToGloss(text);
    if (words.length === 0) {
        return;
    }

    // ✅ ADD: Debug logging
    console.log('[SignEngine] 🎭 TEXT TO SIGN:', text);
    console.log('[SignEngine] 📝 GLOSSES:', words);
    let totalDuration = 0;

    let delayMs = 0;
    let previousAction: THREE.AnimationAction | null = null;

    words.forEach((word, wordIndex) => {
        const directClip = buildSignClip(word);
        const clips = directClip ? [directClip] : buildFingerspellClips(word);

        // ✅ ADD: Debug each word
        console.log(`[SignEngine] 📌 Word ${wordIndex + 1}/${words.length}: "${word}"`, {
            clipCount: clips.length,
            usingDirect: !!directClip,
            clipNames: clips.map(c => c.name),
        });

        clips.forEach((clip, clipIndex) => {
            const timer = setTimeout(() => {
                // ✅ ADD: Log when animation actually plays
                console.log(
                    `[SignEngine] ▶️ PLAYING (${wordIndex + 1}.${clipIndex + 1}): "${clip.name}"`,
                    {
                        duration_ms: (clip.duration * 1000).toFixed(0),
                        tracks: clip.tracks.length,
                        bones: clip.tracks.slice(0, 3).map(t => t.name.split('.')[0]),
                        delay_ms: delayMs,
                    }
                );

                const action = mixer.clipAction(clip);
                action.setLoop(THREE.LoopOnce, 1);
                action.clampWhenFinished = true;
                action.enabled = true;
                action.reset().play();

                if (previousAction) {
                    action.crossFadeFrom(previousAction, CROSS_FADE_SEC, true);
                }

                previousAction = action;
                currentActions.push(action);
            }, delayMs);

            activeTimers.push(timer);

            delayMs += clip.duration * 1000 + CLIP_GAP_MS;
            totalDuration += clip.duration * 1000 + CLIP_GAP_MS;
        });
    });

    // ✅ ADD: Log total duration
    console.log(`[SignEngine] ⏱️ TOTAL ANIMATION DURATION: ${totalDuration.toFixed(0)}ms`);

    await new Promise<void>((resolve) => {
        const doneTimer = setTimeout(() => {
            console.log('[SignEngine] ✅ ANIMATION SEQUENCE COMPLETE');
            resolve();
        }, delayMs + 100);
        activeTimers.push(doneTimer);
    });
};
```

**Expected Console Output:**
```
[SignEngine] 🎭 TEXT TO SIGN: hello
[SignEngine] 📝 GLOSSES: hello
[SignEngine] 📌 Word 1/1: "hello" {clipCount: 1, usingDirect: true, clipNames: Array(1)}
[SignEngine] ▶️ PLAYING (1.1): "hello" {duration_ms: "1400", tracks: 15, bones: Array(3)}
[SignEngine] ⏱️ TOTAL ANIMATION DURATION: 1520ms
[SignEngine] ✅ ANIMATION SEQUENCE COMPLETE
```

If you see `tracks: 0` instead of `tracks: 15`, then the rotation order is still wrong.

---

## FIX #4: Diagnostic Bone Checker (Optional)

**File:** Add to `src/components/AvatarCanvas.native.tsx` after line 170

```typescript
// ✅ ADD: After gltf.scene.add() and before mixer creation

console.log('[AvatarCanvas] ========== SKELETON DIAGNOSTIC ==========');

const skeletonStats = {
    totalBones: 0,
    detectedBones: [] as string[],
    rightArmChain: [] as string[],
    leftArmChain: [] as string[],
    fingerBones: [] as string[],
};

gltf.scene.traverse((obj: THREE.Object3D) => {
    if (!(obj instanceof THREE.Bone)) return;
    
    skeletonStats.totalBones++;
    skeletonStats.detectedBones.push(obj.name);
    
    if (obj.name.includes('Right') && (obj.name.includes('Arm') || obj.name.includes('Shoulder'))) {
        skeletonStats.rightArmChain.push(obj.name);
    }
    if (obj.name.includes('Left') && (obj.name.includes('Arm') || obj.name.includes('Shoulder'))) {
        skeletonStats.leftArmChain.push(obj.name);
    }
    if (obj.name.includes('Hand') && obj.name.includes('Index')) {
        skeletonStats.fingerBones.push(obj.name);
    }
});

console.log(`[AvatarCanvas] Total Bones: ${skeletonStats.totalBones}`);
console.log('[AvatarCanvas] Right Arm Chain:', skeletonStats.rightArmChain);
console.log('[AvatarCanvas] Left Arm Chain:', skeletonStats.leftArmChain);
console.log('[AvatarCanvas] Finger Bones (sample):', skeletonStats.fingerBones.slice(0, 5));
console.log('[AvatarCanvas] =====================================');
```

**This helps verify:**
- ✅ Avatar has rigged bones (not just static mesh)
- ✅ Both arms are animated
- ✅ Finger bones exist for detailed hand shapes

---

## Quick Apply Script

If you want to copy-paste all changes at once:

### Change 1: useSignEngine.ts - Lines 86-101
Replace:
```typescript
const quat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(bone.x, bone.y, bone.z)
);
```

With:
```typescript
const ROTATION_ORDER: THREE.EulerOrder = 'ZYX';
const euler = new THREE.Euler(bone.x, bone.y, bone.z, ROTATION_ORDER);
const quat = new THREE.Quaternion().setFromEuler(euler);
```

### Change 2: AvatarCanvas.native.tsx - Line 222
Replace:
```typescript
idleAction.weight = 1;
```

With:
```typescript
idleAction.weight = 0.3;
```

### Change 3: Test
Type "hello yes thank you" in DeafMode and watch console for debug output.

---

## Rotation Order Reference

If initial fix doesn't work, try other orders in this priority:

| Order | When to try | Characteristic |
|-------|------------|-----------------|
| `ZYX` | First (most common for Mixamo) | Natural looking movement |
| `XYZ` | Second (three.js default) | May look contorted |
| `YXZ` | Third (Unity common) | Check |
| `YZX` | Fourth | Check |
| `XZY` | Fifth | Check |
| `ZXY` | Last | Rarely correct |

**How to test if wrong:** When playing "hello", if the arm goes backward/inward instead of up/outward, try next order.

---

## Verify Fix Worked

Run this in console after applying fixes:

```javascript
// In app console while playing animation:
// If you see this, fixes worked! 🎉
console.log('Bone tracks loaded:', /* should be > 10 */);
console.log('Animation playing');
// You should physically see avatar's arm move
```

---

## Rollback Plan

If anything breaks, just revert these 2 changes:

```typescript
// Change 1 - Revert to default rotation order
const quat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(bone.x, bone.y, bone.z)  // Back to default XYZ
);

// Change 2 - Revert idle weight
idleAction.weight = 1;  // Back to full
```

App will work again (no signs, but no crashes).

---

## Success Criteria ✅

After applying all fixes, you should see:

- [ ] Avatar loads successfully
- [ ] When you type "hello", avatar's right arm lifts upward
- [ ] Arm sweeps outward in a waving motion (~1.4 seconds)
- [ ] Arm returns to rest position
- [ ] When you type "yes no thank you", three sequential signs play
- [ ] No console errors
- [ ] Console shows debug messages (from Fix #3)
- [ ] Smooth transitions between signs

**If all ✅, you're done!** Proceed to Phase 2 (Animation Quality).
