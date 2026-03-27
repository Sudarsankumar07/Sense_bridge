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
    hello: require('../../assets/signs/hello.json'),
    yes: require('../../assets/signs/yes.json'),
    no: require('../../assets/signs/no.json'),
    thankyou: require('../../assets/signs/thankyou.json'),
    sorry: require('../../assets/signs/sorry.json'),
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

const BONE_ALIASES: Record<string, string[]> = {
    RightHand: ['RightHand', 'mixamorigRightHand', 'right_hand'],
    RightIndex1: ['RightIndex1', 'mixamorigRightHandIndex1', 'right_index_1'],
    Head: ['Head', 'mixamorigHead', 'head'],
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
            const quat = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(bone.x, bone.y, bone.z)
            );
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

export const createSignEngine = (mixer: THREE.AnimationMixer) => {
    let activeTimers: ReturnType<typeof setTimeout>[] = [];
    let currentActions: THREE.AnimationAction[] = [];

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
            return;
        }

        let delayMs = 0;
        let previousAction: THREE.AnimationAction | null = null;

        words.forEach((word) => {
            const directClip = buildSignClip(word);
            const clips = directClip ? [directClip] : buildFingerspellClips(word);

            clips.forEach((clip) => {
                const timer = setTimeout(() => {
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
            });
        });

        await new Promise<void>((resolve) => {
            const doneTimer = setTimeout(() => resolve(), delayMs + 100);
            activeTimers.push(doneTimer);
        });
    };

    const stop = () => {
        clearPlayback();
    };

    return { playText, stop };
};
