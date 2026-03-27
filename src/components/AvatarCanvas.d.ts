/**
 * Platform-specific Avatar Component
 * Metro bundler automatically selects:
 * - AvatarCanvas.web.tsx on web platform
 * - AvatarCanvas.native.tsx on native (Expo) platform
 */

import React from 'react';
import * as THREE from 'three';

interface AvatarCanvasProps {
    onReady?: (mixer: THREE.AnimationMixer) => void;
    onError?: (message: string) => void;
    onBonesDetected?: (bones: string[], reportPath: string) => void;
}

export const AvatarCanvas: React.FC<AvatarCanvasProps>;
