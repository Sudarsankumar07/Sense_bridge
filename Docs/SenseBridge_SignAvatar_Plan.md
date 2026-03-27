# SenseBridge — Sign Language Avatar (Option B) Full Plan

> 3D avatar-based sign language system for the deaf mode of SenseBridge  
> Built with React Native + Expo + Three.js

---

## Overview

**Goal:** When a deaf user types text, a 3D avatar on screen performs the corresponding sign language gestures in real time.

**Core approach:** Use a rigged 3D humanoid model (from ReadyPlayer.me), drive its bone rotations using pre-built JSON keyframe files per sign, and play them sequentially using Three.js `AnimationMixer` inside an Expo app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| App framework | React Native + Expo |
| 3D rendering | expo-gl + expo-three + Three.js |
| Avatar model | ReadyPlayer.me (glTF/glb export) |
| Animation | THREE.AnimationMixer + KeyframeTrack |
| Sign data | Custom JSON keyframe dictionary |
| Pose extraction | Python + MediaPipe Holistic |
| Fallback | A–Z fingerspelling JSON poses |

---

## Phase 1 — Project Setup

### Install dependencies

```bash
npx expo install expo-gl expo-three three
npm install @react-three/fiber @react-three/drei
npm install expo-asset expo-file-system
```

### Get your avatar model

1. Go to [readyplayer.me](https://readyplayer.me)
2. Create a humanoid avatar
3. Export as `.glb` with **morph targets** and **finger bones** enabled
4. Place the file at `assets/models/avatar.glb`

### Verify bone names

After loading the model, log all bone names:

```typescript
gltf.scene.traverse((obj) => {
  if (obj instanceof THREE.Bone) {
    console.log(obj.name); // e.g. RightHand, RightIndex1, RightThumb2
  }
});
```

Keep a list — you will need the exact bone name strings for your keyframe JSON files.

---

## Phase 2 — Folder Structure

```
sensebridge/
├── assets/
│   ├── models/
│   │   └── avatar.glb
│   └── signs/
│       ├── signs.json           ← master dictionary index
│       ├── hello.json
│       ├── yes.json
│       ├── no.json
│       ├── thankyou.json
│       ├── sorry.json
│       └── alphabet/
│           ├── a.json
│           ├── b.json
│           └── ... z.json
├── components/
│   ├── AvatarCanvas.tsx         ← expo-gl + Three.js renderer
│   └── SignTextInput.tsx        ← text input for deaf user
├── hooks/
│   ├── useSignEngine.ts         ← text → animation logic
│   └── useAvatarLoader.ts       ← loads and caches glTF model
├── screens/
│   └── DeafModeScreen.tsx
└── utils/
    └── glossMapper.ts           ← English to sign gloss rules
```

---

## Phase 3 — Keyframe JSON Format

Each sign is stored as a JSON file. Only bones that actually move need entries — unchanged bones are interpolated automatically.

```json
{
  "sign": "hello",
  "fps": 30,
  "duration": 1.2,
  "frames": [
    {
      "time": 0.0,
      "bones": {
        "RightHand":    { "x": 0,   "y": 0.3, "z": 0.1 },
        "RightThumb1":  { "x": 0.2, "y": 0,   "z": 0   },
        "RightIndex1":  { "x": 0.5, "y": 0,   "z": 0   },
        "RightMiddle1": { "x": 0.5, "y": 0,   "z": 0   },
        "RightRing1":   { "x": 0.5, "y": 0,   "z": 0   },
        "RightPinky1":  { "x": 0.5, "y": 0,   "z": 0   }
      }
    },
    {
      "time": 0.6,
      "bones": {
        "RightHand":   { "x": 0.3, "y": 0.5, "z": 0.2 },
        "RightIndex1": { "x": 0.1, "y": 0,   "z": 0   }
      }
    },
    {
      "time": 1.2,
      "bones": {
        "RightHand":   { "x": 0, "y": 0.3, "z": 0.1 }
      }
    }
  ]
}
```

### Master dictionary index (`signs.json`)

```json
{
  "hello":    "signs/hello.json",
  "yes":      "signs/yes.json",
  "no":       "signs/no.json",
  "thankyou": "signs/thankyou.json",
  "sorry":    "signs/sorry.json"
}
```

---

## Phase 4 — Core Code

### `useSignEngine.ts`

```typescript
import * as THREE from 'three';
import signsIndex from '../assets/signs/signs.json';

export function useSignEngine(
  mixer: THREE.AnimationMixer
) {

  const textToGloss = (text: string): string[] => {
    return text
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(' ')
      .filter(Boolean);
  };

  const buildClip = async (signName: string): Promise<THREE.AnimationClip | null> => {
    const path = signsIndex[signName];
    if (!path) return null;

    const signData = require(`../assets/${path}`);
    const tracks: THREE.KeyframeTrack[] = [];

    const boneNames = new Set<string>();
    signData.frames.forEach((f: any) =>
      Object.keys(f.bones).forEach((b) => boneNames.add(b))
    );

    boneNames.forEach((boneName) => {
      const times: number[] = [];
      const values: number[] = [];

      signData.frames.forEach((frame: any) => {
        if (frame.bones[boneName]) {
          times.push(frame.time);
          const { x, y, z } = frame.bones[boneName];
          const q = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(x, y, z)
          );
          values.push(q.x, q.y, q.z, q.w);
        }
      });

      if (times.length > 0) {
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${boneName}.quaternion`,
            times,
            values
          )
        );
      }
    });

    return new THREE.AnimationClip(signName, signData.duration, tracks);
  };

  const buildFingerspellClip = async (
    word: string
  ): Promise<THREE.AnimationClip[]> => {
    const clips: THREE.AnimationClip[] = [];
    for (const letter of word.split('')) {
      const clip = await buildClip(`alphabet_${letter}`);
      if (clip) clips.push(clip);
    }
    return clips;
  };

  const playText = async (text: string) => {
    const glossList = textToGloss(text);
    let delay = 0;

    for (const word of glossList) {
      let clips: THREE.AnimationClip[] = [];

      const direct = await buildClip(word);
      if (direct) {
        clips = [direct];
      } else {
        clips = await buildFingerspellClip(word);
      }

      for (const clip of clips) {
        setTimeout(() => {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          action.reset().play();
        }, delay * 1000);
        delay += clip.duration + 0.2; // 0.2s pause between signs
      }
    }
  };

  return { playText };
}
```

---

### `AvatarCanvas.tsx`

```typescript
import React, { useRef, useEffect } from 'react';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Asset } from 'expo-asset';

interface Props {
  onReady: (mixer: THREE.AnimationMixer) => void;
}

export default function AvatarCanvas({ onReady }: Props) {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef(new THREE.Clock());

  const onContextCreate = async (gl: any) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.4, 1.8);
    camera.lookAt(0, 1.2, 0);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 2, 2);
    scene.add(ambient, dirLight);

    // Load avatar
    const asset = Asset.fromModule(require('../assets/models/avatar.glb'));
    await asset.downloadAsync();

    const loader = new GLTFLoader();
    loader.load(asset.localUri!, (gltf) => {
      scene.add(gltf.scene);
      const mixer = new THREE.AnimationMixer(gltf.scene);
      mixerRef.current = mixer;
      onReady(mixer);
    });

    // Render loop
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      mixerRef.current?.update(delta);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  };

  return (
    <GLView
      style={{ flex: 1 }}
      onContextCreate={onContextCreate}
    />
  );
}
```

---

### `DeafModeScreen.tsx`

```typescript
import React, { useRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as THREE from 'three';
import AvatarCanvas from '../components/AvatarCanvas';
import { useSignEngine } from '../hooks/useSignEngine';

export default function DeafModeScreen() {
  const [inputText, setInputText] = useState('');
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const handleAvatarReady = (mixer: THREE.AnimationMixer) => {
    mixerRef.current = mixer;
  };

  const handleSign = () => {
    if (!mixerRef.current || !inputText.trim()) return;
    const { playText } = useSignEngine(mixerRef.current);
    playText(inputText);
  };

  return (
    <View style={styles.container}>
      <AvatarCanvas onReady={handleAvatarReady} />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type to sign..."
          placeholderTextColor="#aaa"
        />
        <TouchableOpacity style={styles.button} onPress={handleSign}>
          <Text style={styles.buttonText}>Sign</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  inputRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    backgroundColor: '#1a1a1a',
  },
  input: {
    flex: 1,
    color: '#fff',
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#5DCAA5',
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  buttonText: { color: '#04342C', fontWeight: '600', fontSize: 16 },
});
```

---

## Phase 5 — Getting Real Sign Keyframe Data

### Option A — WLASL Dataset (ASL, 2000+ words)

1. Download from [github.com/dxli94/WLASL](https://github.com/dxli94/WLASL)
2. Extract hand/body landmark JSON per video
3. Convert landmarks to bone rotation JSON using the script below

### Option B — Record your own with MediaPipe (for ISL)

```python
# extract_sign.py — record one sign from webcam or video
import mediapipe as mp
import cv2
import json
import math

mp_holistic = mp.solutions.holistic

def landmark_to_euler(lm):
    return {"x": lm.x * math.pi, "y": lm.y * math.pi, "z": lm.z * math.pi}

def extract_sign(video_path: str, sign_name: str, output_path: str):
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = []
    frame_idx = 0

    with mp_holistic.Holistic(min_detection_confidence=0.5) as holistic:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            results = holistic.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            time = frame_idx / fps
            bones = {}

            if results.right_hand_landmarks:
                lms = results.right_hand_landmarks.landmark
                # Map MediaPipe hand landmarks to bone names
                bone_map = {
                    "RightHand":    lms[0],
                    "RightThumb1":  lms[1],
                    "RightThumb2":  lms[2],
                    "RightIndex1":  lms[5],
                    "RightIndex2":  lms[6],
                    "RightMiddle1": lms[9],
                    "RightMiddle2": lms[10],
                    "RightRing1":   lms[13],
                    "RightRing2":   lms[14],
                    "RightPinky1":  lms[17],
                    "RightPinky2":  lms[18],
                }
                for bone_name, lm in bone_map.items():
                    bones[bone_name] = landmark_to_euler(lm)

            if bones:
                frames.append({"time": round(time, 3), "bones": bones})

            frame_idx += 1

    cap.release()

    duration = frame_idx / fps
    output = {"sign": sign_name, "fps": fps, "duration": round(duration, 2), "frames": frames}

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"Saved {len(frames)} frames → {output_path}")

# Usage:
extract_sign("recordings/hello.mp4", "hello", "assets/signs/hello.json")
```

### Option C — Hand-craft the A–Z alphabet (quickest start)

Build 26 static single-frame JSON files for each letter. These become your fingerspell fallback so the avatar can spell out any word even if it's not in your dictionary.

---

## Phase 6 — Signing Pipeline (How it all connects)

```
User types text
       ↓
Text preprocessor
  (lowercase, strip punctuation, split words)
       ↓
Gloss mapper
  (English word → ISL sign token)
       ↓
Keyframe dictionary lookup
  (signs.json → find JSON file for token)
       ↓
Not found? → Fingerspell letter by letter (A–Z fallback)
       ↓
Build THREE.AnimationClip from keyframe JSON
       ↓
Queue clips with timing gaps
       ↓
THREE.AnimationMixer plays each clip on the avatar
       ↓
Avatar signs on screen
```

---

## Phase 7 — Smooth Blending Between Signs

To avoid the avatar snapping between signs, lerp from the end pose of sign N to the start pose of sign N+1.

```typescript
const blendToNextSign = (
  mixer: THREE.AnimationMixer,
  currentAction: THREE.AnimationAction,
  nextAction: THREE.AnimationAction,
  blendDuration = 0.15
) => {
  nextAction.reset();
  nextAction.play();
  nextAction.crossFadeFrom(currentAction, blendDuration, true);
};
```

---

## Phase 8 — Build Order (Step by Step)

| Step | Task | Est. time |
|---|---|---|
| 1 | Get avatar rendering on expo-gl canvas | 1–2 days |
| 2 | Log all bone names, verify skeleton | 1 day |
| 3 | Hand-craft 5 keyframe JSON files and verify playback | 2 days |
| 4 | Build `useSignEngine` hook, wire to text input | 2 days |
| 5 | Build A–Z fingerspell fallback (26 static poses) | 2 days |
| 6 | Run MediaPipe extractor on ISL video clips | 3–5 days |
| 7 | Add smooth blending between signs | 1 day |
| 8 | Test with real sentences, fix edge cases | 2–3 days |
| 9 | Polish avatar lighting, background, camera angle | 1 day |

**Total estimated time:** ~3 weeks for a working MVP

---

## Key Resources

| Resource | Link | Use |
|---|---|---|
| ReadyPlayer.me | readyplayer.me | Free rigged avatar with finger bones |
| WLASL Dataset | github.com/dxli94/WLASL | 2000+ ASL words with pose data |
| MediaPipe Holistic | mediapipe.dev | Extract hand landmarks from video |
| Three.js docs | threejs.org/docs | AnimationMixer, KeyframeTrack |
| expo-three | github.com/expo/expo-three | Three.js on React Native |
| SignBD | signbd.net | Bengali sign language dataset |

---

## Notes

- **ISL vs ASL:** WLASL is American Sign Language. For Indian Sign Language (ISL), use MediaPipe to record your own dataset or look for ISL-specific datasets from IIT research papers.
- **Facial expressions:** Add morph targets (blendshapes) to your avatar for eyebrow and mouth shapes — these carry grammatical meaning in sign language.
- **Performance:** Pre-load all keyframe JSON files at app startup so there is no delay when the user types.
- **Offline support:** All sign data is bundled with the app — no internet needed for signing, which is important for accessibility use cases.

---

*SenseBridge — Bridging communication gaps with technology*
