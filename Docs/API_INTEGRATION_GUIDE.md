# API Integration Guide

Complete guide to integrating free cloud APIs for SenseBridge accessibility features.

## Overview

This guide covers setting up and integrating **three free APIs** for the core features:
- **Roboflow** - Object Detection & Currency Recognition
- **MediaPipe** - Sign Language Detection  
- **Web Speech API** - Speech-to-Text (Built-in)

All APIs are **100% free** with generous usage tiers.

---

## 1. Roboflow Setup (Object Detection & Currency

)

### Why Roboflow?
- ✅ **Free Tier**: 1,000 API calls/month (enough for development + testing)
- ✅ **Pre-trained Models**: Object detection, currency recognition
- ✅ **Custom Models**: Train your own if needed
- ✅ **Easy Integration**: Simple REST API

### Step 1: Create Account

1. Go to [https://roboflow.com](https://roboflow.com)
2. Click "Sign Up" (free account)
3. Verify your email

### Step 2: Get API Key

1. Log in to Roboflow dashboard
2. Click on your profile → **API Keys**
3. Copy your **API Key** (looks like: `abc123defXYZ456`)

### Step 3: Find Pre-trained Models

**For Object Detection:**
1. Go to [Roboflow Universe](https://universe.roboflow.com)
2. Search for "coco" or "object detection"
3. Choose a model (recommended: `coco-ssd`)
4. Copy the **Model ID** and **Version** number

**For Currency Recognition:**
1. Search "currency detection" or "money recognition"  
2. Choose Indian Rupee model or multi-currency model
3. Copy the **Model ID** and **Version**

### Step 4: Configure Environment

Create `.env` file in your project root:

```env
ROBOFLOW_API_KEY=your_api_key_here
ROBOFLOW_OBJECT_MODEL=coco-ssd/3
ROBOFLOW_CURRENCY_MODEL=indian-currency/2
```

### Step 5: Test the API

```bash
# Test object detection
curl -X POST "https://detect.roboflow.com/coco-ssd/3?api_key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"image":"base64_encoded_image_here"}'
```

---

## 2. MediaPipe Setup (Sign Language Detection)

### Why MediaPipe?
- ✅ **100% Free**: No API key needed, runs client-side
- ✅ **Real-time**: Hand tracking in real-time
- ✅ **Offline**: Works completely offline
- ✅ **Accurate**: Google's ML models

### Step 1: Install Package

```bash
npm install @mediapipe/hands @mediapipe/camera_utils
```

### Step 2: No API Key Needed!

MediaPipe runs entirely on-device, no server or API key required.

### Step 3: Implementation

See `src/services/cloudAI/signLanguage.ts` for the complete implementation.

**Basic Example:**

```typescript
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults((results) => {
  if (results.multiHandLandmarks) {
    // Process hand landmarks to detect signs
    const gesture = recognizeGesture(results.multiHandLandmarks[0]);
    console.log('Detected sign:', gesture);
  }
});
```

---

## 3. Web Speech API (Speech-to-Text)

### Why Web Speech API?
- ✅ **100% Free**: Built into modern browsers
- ✅ **No Setup**: Works out of the box
- ✅ **Real-time**: Continuous speech recognition
- ✅ **Multi-language**: Supports 100+ languages

### Step 1: No Installation Needed!

The Web Speech API is built into:
- Chrome (Android & Desktop)
- Safari (iOS & macOS)
- Edge
- React Native WebView (with polyfill)

### Step 2: Basic Usage

```typescript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'en-US';

recognition.onresult = (event) => {
  const transcript = Array.from(event.results)
    .map(result => result[0])
    .map(result => result.transcript)
    .join('');
  
  console.log('Transcription:', transcript);
};

recognition.start();
```

### Step 3: React Native Integration

For React Native, we use Expo's `expo-speech-recognition` or implement via WebView.

See `src/services/cloudAI/speechToText.ts` for implementation.

---

## Code Examples

### Object Detection (Roboflow)

```typescript
// src/services/cloudAI/objectDetection.ts
import axios from 'axios';

const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
const MODEL_ID = 'coco-ssd/3';

export async function detectObjects(base64Image: string) {
  const response = await axios.post(
    `https://detect.roboflow.com/${MODEL_ID}?api_key=${ROBOFLOW_API_KEY}`,
    { image: base64Image },
    { headers: { 'Content-Type': 'application/json' } }
  );

  return response.data.predictions.map((pred: any) => ({
    class: pred.class,
    confidence: pred.confidence,
    x: pred.x,
    y: pred.y,
    width: pred.width,
    height: pred.height,
  }));
}
```

### Currency Recognition (Roboflow)

```typescript
// src/services/cloudAI/currencyRecognition.ts
import axios from 'axios';

const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
const MODEL_ID = 'indian-currency/2';

export async function detectCurrency(base64Image: string) {
  const response = await axios.post(
    `https://detect.roboflow.com/${MODEL_ID}?api_key=${ROBOFLOW_API_KEY}`,
    { image: base64Image },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const prediction = response.data.predictions[0];
  if (!prediction) return null;

  return {
    denomination: parseInt(prediction.class),
    confidence: prediction.confidence,
  };
}
```

### Sign Language Detection (MediaPipe)

```typescript
// src/services/cloudAI/signLanguage.ts
import { Hands, Results } from '@mediapipe/hands';

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

function recognizeGesture(landmarks: any) {
  // Simple gesture recognition logic
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  
  // Calculate distance between thumb and index finger
  const distance = Math.sqrt(
    Math.pow(thumbTip.x - indexTip.x, 2) + 
    Math.pow(thumbTip.y - indexTip.y, 2)
  );

  if (distance < 0.05) return 'Pinch';
  // Add more gestures...
  
  return 'Unknown';
}

export async function detectSignLanguage(videoElement: HTMLVideoElement) {
  await hands.send({ image: videoElement });
  // Results handled in hands.onResults callback
}
```

---

## Error Handling

### Roboflow Errors

```typescript
try {
  const objects = await detectObjects(image);
} catch (error) {
  if (error.response?.status === 429) {
    console.error('Rate limit exceeded - wait before retrying');
  } else if (error.response?.status === 401) {
    console.error('Invalid API key');
  } else {
    console.error('Detection failed:', error.message);
  }
}
```

### MediaPipe Errors

```typescript
hands.onResults((results) => {
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    console.log('No hands detected');
    return;
  }
  // Process results
});
```

### Web Speech API Errors

```typescript
recognition.onerror = (event) => {
  if (event.error === 'no-speech') {
    console.log('No speech detected');
  } else if (event.error === 'network') {
    console.error('Network error');
  }
};
```

---

## Best Practices

### 1. Rate Limiting (Roboflow)
- Free tier: 1,000 calls/month
- Cache results when possible
- Throttle camera frame processing

```typescript
let lastCallTime = 0;
const MIN_INTERVAL = 1000; // 1 second between calls

async function detectThrottled(image: string) {
  const now = Date.now();
  if (now - lastCallTime < MIN_INTERVAL) {
    return null; // Skip this frame
  }
  lastCallTime = now;
  return await detectObjects(image);
}
```

### 2. Confidence Thresholds
- Only show results with confidence > 0.6
- Use higher thresholds for critical features

```typescript
const results = predictions.filter(p => p.confidence > 0.6);
```

### 3. Offline Fallback
- Show graceful error messages when offline
- Queue requests and retry when online

---

## Troubleshooting

### Roboflow: "Invalid API Key"
- Double-check your API key in `.env`
- Ensure no extra spaces in the key
- Regenerate key from Roboflow dashboard

### Roboflow: "Rate Limit Exceeded"
- You've used your 1,000 free calls
- Wait until next month or upgrade plan
- Implement caching to reduce calls

### MediaPipe: Not Detecting Hands
- Ensure good lighting
- Lower `minDetectionConfidence` to 0.5
- Check camera permissions

### Web Speech API: Not Working
- Check browser compatibility
- Request microphone permissions
- Test with HTTPS (required for security)

---

## Next Steps

1. ✅ Get your Roboflow API key
2. ✅ Test object detection endpoint
3. ✅ Install MediaPipe package
4. ✅ Test sign language detection
5. ✅ Test Web Speech API
6. ✅ Integrate into your app

Need help? Check the [Roboflow Docs](https://docs.roboflow.com), [MediaPipe Docs](https://google.github.io/mediapipe/), or [Web Speech API Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API).
