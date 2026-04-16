import * as THREE from 'three';

type BoneEuler = {
    x: number;
    y: number;
    z: number;
};

type SignFrame = {
    time: number;
    bones: Record<string, BoneEuler>;
};

type SignClipData = {
    sign: string;
    fps: number;
    duration: number;
    frames: SignFrame[];
};

const CORE_SIGNS: Record<string, SignClipData> = {
    // Original core signs
    hello:     require('../../assets/signs/hello.json'),
    yes:       require('../../assets/signs/yes.json'),
    no:        require('../../assets/signs/no.json'),
    thankyou:  require('../../assets/signs/thankyou.json'),
    sorry:     require('../../assets/signs/sorry.json'),
    please:    require('../../assets/signs/please.json'),
    iloveyou:  require('../../assets/signs/iloveyou.json'),
    good:      require('../../assets/signs/good.json'),
    help:      require('../../assets/signs/help.json'),
    // ✅ NEW: Emotional expressions
    angry:     require('../../assets/signs/angry.json'),
    happy:     require('../../assets/signs/happy.json'),
    sad:       require('../../assets/signs/sad.json'),
    // ✅ NEW: Practical needs
    hungry:    require('../../assets/signs/hungry.json'),
    water:     require('../../assets/signs/water.json'),
    bathroom:  require('../../assets/signs/bathroom.json'),
    tired:     require('../../assets/signs/tired.json'),
};

const ALPHABET_SIGNS: Record<string, SignClipData> = {
    a: require('../../assets/signs/alphabet/a.json'),
    b: require('../../assets/signs/alphabet/b.json'),
    c: require('../../assets/signs/alphabet/c.json'),
    d: require('../../assets/signs/alphabet/d.json'),
    e: require('../../assets/signs/alphabet/e.json'),
    f: require('../../assets/signs/alphabet/f.json'),
    g: require('../../assets/signs/alphabet/g.json'),
    h: require('../../assets/signs/alphabet/h.json'),
    i: require('../../assets/signs/alphabet/i.json'),
    j: require('../../assets/signs/alphabet/j.json'),
    k: require('../../assets/signs/alphabet/k.json'),
    l: require('../../assets/signs/alphabet/l.json'),
    m: require('../../assets/signs/alphabet/m.json'),
    n: require('../../assets/signs/alphabet/n.json'),
    o: require('../../assets/signs/alphabet/o.json'),
    p: require('../../assets/signs/alphabet/p.json'),
    q: require('../../assets/signs/alphabet/q.json'),
    r: require('../../assets/signs/alphabet/r.json'),
    s: require('../../assets/signs/alphabet/s.json'),
    t: require('../../assets/signs/alphabet/t.json'),
    u: require('../../assets/signs/alphabet/u.json'),
    v: require('../../assets/signs/alphabet/v.json'),
    w: require('../../assets/signs/alphabet/w.json'),
    x: require('../../assets/signs/alphabet/x.json'),
    y: require('../../assets/signs/alphabet/y.json'),
    z: require('../../assets/signs/alphabet/z.json'),
};

// Exact bone names from Mixamo Y-Bot avatar.glb
// Note: Mixamo GLB exports use underscore separator (mixamorig_RightHand),
// NOT the colon-prefixed mixamorig:RightHand seen in Blender/FBX files.
const BONE_ALIASES: Record<string, string[]> = {
    // Right arm chain
    RightArm:          ['mixamorig_RightArm'],
    RightForeArm:      ['mixamorig_RightForeArm'],
    RightHand:         ['mixamorig_RightHand'],
    RightShoulder:     ['mixamorig_RightShoulder'],
    // Right thumb
    RightHandThumb1:   ['mixamorig_RightHandThumb1'],
    RightHandThumb2:   ['mixamorig_RightHandThumb2'],
    RightHandThumb3:   ['mixamorig_RightHandThumb3'],
    // Right index
    RightHandIndex1:   ['mixamorig_RightHandIndex1'],
    RightHandIndex2:   ['mixamorig_RightHandIndex2'],
    RightHandIndex3:   ['mixamorig_RightHandIndex3'],
    // Right middle
    RightHandMiddle1:  ['mixamorig_RightHandMiddle1'],
    RightHandMiddle2:  ['mixamorig_RightHandMiddle2'],
    RightHandMiddle3:  ['mixamorig_RightHandMiddle3'],
    // Right ring
    RightHandRing1:    ['mixamorig_RightHandRing1'],
    RightHandRing2:    ['mixamorig_RightHandRing2'],
    // Right pinky
    RightHandPinky1:   ['mixamorig_RightHandPinky1'],
    RightHandPinky2:   ['mixamorig_RightHandPinky2'],
    // Left arm chain
    LeftArm:           ['mixamorig_LeftArm'],
    LeftForeArm:       ['mixamorig_LeftForeArm'],
    LeftHand:          ['mixamorig_LeftHand'],
    LeftShoulder:      ['mixamorig_LeftShoulder'],
    // Spine / Head
    Hips:              ['mixamorig_Hips'],
    Spine:             ['mixamorig_Spine'],
    Spine1:            ['mixamorig_Spine1'],
    Spine2:            ['mixamorig_Spine2'],
    Neck:              ['mixamorig_Neck'],
    Head:              ['mixamorig_Head'],
};

const CLIP_GAP_MS = 160;
const CROSS_FADE_SEC = 0.15;

const toClip = (name: string, signData: SignClipData): THREE.AnimationClip | null => {
    const tracks: THREE.KeyframeTrack[] = [];
    const boneNames = new Set<string>();

    signData.frames.forEach((frame) => {
        Object.keys(frame.bones).forEach((boneName) => boneNames.add(boneName));
    });

    boneNames.forEach((boneName) => {
        const times: number[] = [];
        const values: number[] = [];

        signData.frames.forEach((frame) => {
            const bone = frame.bones[boneName];
            if (!bone) {
                return;
            }

            times.push(frame.time);
            // ✅ CRITICAL FIX: Use correct Euler rotation order (ZYX) for Mixamo avatar
            // Mixamo exports typically use ZYX order, not default XYZ
            // This ensures bone rotations are computed correctly for visible signing animation
            const ROTATION_ORDER: THREE.EulerOrder = 'ZYX';
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

    // ✅ DIAGNOSTIC: Log if animation has no tracks (indicates rotation order or bone naming issue)
    if (tracks.length === 0) {
        console.warn(`[SignEngine] ⚠️ Animation "${name}" has 0 tracks! Bones: ${Array.from(boneNames).join(', ')}`);
    }

    if (tracks.length === 0) {
        return null;
    }

    return new THREE.AnimationClip(name, signData.duration, tracks);
};

const normalizeWord = (word: string): string => {
    const cleaned = word.trim().toLowerCase();
    if (!cleaned) {
        return '';
    }

    if (cleaned === 'thank' || cleaned === 'thanks' || cleaned === 'thank-you') {
        return 'thankyou';
    }

    return cleaned;
};

// 🔍 DIAGNOSTIC: Function to report what bones are in animations vs what's in aliases
const diagnosticReport = () => {
    const allBonesInSigns = new Set<string>();
    Object.values(CORE_SIGNS).forEach((sign) => {
        sign.frames.forEach((frame) => {
            Object.keys(frame.bones).forEach((bone) => allBonesInSigns.add(bone));
        });
    });
    
    const aliasedBones = new Set(Object.keys(BONE_ALIASES));
    const missing = Array.from(allBonesInSigns).filter((b) => !aliasedBones.has(b));
    
    console.log('[SignEngine] 🔍 DIAGNOSTIC REPORT:');
    console.log('[SignEngine] Bone aliases defined:', aliasedBones.size);
    console.log('[SignEngine] Unique bones in sign JSON:', allBonesInSigns.size);
    console.log('[SignEngine] Bones in signs but NOT in aliases:', missing.length > 0 ? missing : 'NONE (✅ OK)');
    if (missing.length > 0) {
        console.warn('[SignEngine] ❌ ISSUE: Add these to BONE_ALIASES:', missing);
    }
};

export const createSignEngine = (mixer: THREE.AnimationMixer) => {
    let activeTimers: ReturnType<typeof setTimeout>[] = [];
    let currentActions: THREE.AnimationAction[] = [];
    
    // Run diagnostic on engine creation
    diagnosticReport();

    const clearPlayback = () => {
        activeTimers.forEach((timer) => clearTimeout(timer));
        activeTimers = [];

        currentActions.forEach((action) => action.stop());
        currentActions = [];
        mixer.stopAllAction();
    };

    const textToGloss = (text: string): string[] => {
        return text
            .toLowerCase()
            .replace(/[^a-z\s]/g, ' ')
            .split(' ')
            .map(normalizeWord)
            .filter(Boolean);
    };

    const buildSignClip = (signName: string): THREE.AnimationClip | null => {
        const data = CORE_SIGNS[signName];
        if (!data) {
            return null;
        }

        return toClip(signName, data);
    };

    const buildFingerspellClips = (word: string): THREE.AnimationClip[] => {
        const clips: THREE.AnimationClip[] = [];

        word.split('').forEach((letter) => {
            const letterData = ALPHABET_SIGNS[letter];
            if (!letterData) {
                return;
            }

            const clip = toClip(`alphabet_${letter}`, letterData);
            if (clip) {
                clips.push(clip);
            }
        });

        return clips;
    };

    const playText = async (text: string) => {
        clearPlayback();

        const words = textToGloss(text);
        if (words.length === 0) {
            console.log('[SignEngine] ❌ No words to sign');
            return;
        }

        // ✅ DEBUG: Log animation sequence start
        console.log('[SignEngine] 🎭 TEXT TO SIGN:', text);
        console.log('[SignEngine] 📝 GLOSSES:', words);

        let delayMs = 0;
        let previousAction: THREE.AnimationAction | null = null;
        let totalDuration = 0;

        words.forEach((word, wordIndex) => {
            const directClip = buildSignClip(word);
            const clips = directClip ? [directClip] : buildFingerspellClips(word);

            // ✅ DEBUG: Log each word being processed
            console.log(
                `[SignEngine] 📌 Word ${wordIndex + 1}/${words.length}: "${word}"`,
                {
                    clipCount: clips.length,
                    usingDirect: !!directClip,
                    clipNames: clips.map((c) => c.name),
                }
            );

            clips.forEach((clip, clipIndex) => {
                const timer = setTimeout(() => {
                    // ✅ DEBUG: Log when animation actually plays
                    const trackDetails = clip.tracks.slice(0, 5).map((t) => {
                        const boneName = t.name.split('.')[0];
                        return boneName.replace('mixamorig_', '');
                    });
                    console.log(
                        `[SignEngine] ▶️ PLAYING (${wordIndex + 1}.${clipIndex + 1}): "${clip.name}"`,
                        {
                            duration_ms: (clip.duration * 1000).toFixed(0),
                            tracks: clip.tracks.length,
                            bones: trackDetails,
                            delay_ms: delayMs,
                        }
                    );

                    if (clip.tracks.length === 0) {
                        console.warn('[SignEngine] 🔴 CRITICAL: Animation has 0 tracks!');
                        console.warn('[SignEngine]    This means:');
                        console.warn('[SignEngine]    1. Bone names DON\'T match BONE_ALIASES');
                        console.warn('[SignEngine]    2. Check hello.json bone names vs BONE_ALIASES mapping');
                        console.warn('[SignEngine]    3. Verify rotation order is ZYX (not XYZ)');
                    }

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

                const clipDuration = clip.duration * 1000 + CLIP_GAP_MS;
                delayMs += clipDuration;
                totalDuration += clipDuration;
            });
        });

        // ✅ DEBUG: Log total animation duration
        console.log(`[SignEngine] ⏱️ TOTAL ANIMATION DURATION: ${totalDuration.toFixed(0)}ms`);

        await new Promise<void>((resolve) => {
            const doneTimer = setTimeout(() => {
                console.log('[SignEngine] ✅ ANIMATION SEQUENCE COMPLETE');
                resolve();
            }, delayMs + 100);
            activeTimers.push(doneTimer);
        });
    };

    const stop = () => {
        clearPlayback();
    };

    return { playText, stop };
};
