# Native Module Integration Guide

This document explains how to implement the native Android modules required for SenseBridge's AI features.

## Overview

The app currently has all UI and JavaScript logic in place. To make the AI features fully functional, we need to create 4 native Android modules:

1. **TFLiteModule** - Run TensorFlow Lite models for object/currency/sign detection
2. **VoskModule** - Offline speech recognition
3. **MediaPipeModule** - Hand landmark extraction
4. **UnityBridge** - 3D avatar rendering

## Module 1: TFLiteModule

### Purpose
Run TensorFlow Lite models for:
- Obstacle detection (YOLOv5)
- Currency recognition (custom YOLO)
- Sign language classification (custom CNN)

### Implementation Steps

1. **Add TFLite dependency** (`android/app/build.gradle`):
   ```gradle
   dependencies {
       implementation 'org.tensorflow:tensorflow-lite:2.14.0'
       implementation 'org.tensorflow:tensorflow-lite-support:0.4.4'
   }
   ```

2. **Create native module** (`android/app/src/main/java/com/sensebridge/TFLiteModule.java`):
   ```java
   package com.sensebridge;
   
   import com.facebook.react.bridge.*;
   import org.tensorflow.lite.Interpreter;
   import java.nio.MappedByteBuffer;
   import java.io.FileInputStream;
   import java.io.IOException;
   import java.nio.channels.FileChannel;
   
   public class TFLiteModule extends ReactContextBaseJavaModule {
       private Interpreter obstacleModel;
       private Interpreter currencyModel;
       private Interpreter signModel;
       
       @ReactMethod
       public void loadModel(String modelPath, String modelType, Promise promise) {
           // Load .tflite model from assets
           // Initialize Interpreter
           // Store in appropriate field
       }
       
       @ReactMethod
       public void detectObjects(String imageUri, Promise promise) {
           // Load image from URI
           // Preprocess (resize to 640x640, normalize)
           // Run inference
           // Postprocess (NMS for YOLO)
           // Return detections as JSON array
       }
       
       @ReactMethod
       public void classifySign(ReadableArray landmarks, Promise promise) {
           // Convert landmarks to float array
           // Run sign classifier inference
           // Return predicted sign and confidence
       }
   }
   ```

3. **Register module** (`TFLitePackage.java` + `MainApplication.java`)

4. **JavaScript bridge** (`services/aiEngine.js`):
   ```javascript
   import { NativeModules } from 'react-native';
   const { TFLiteModule } = NativeModules;
   
   class AIEngine {
       async initialize() {
           await TFLiteModule.loadModel('obstacle.tflite', 'obstacle');
           await TFLiteModule.loadModel('currency.tflite', 'currency');
           await TFLiteModule.loadModel('sign.tflite', 'sign');
       }
       
       async detectObstacles(imageUri) {
           return await TFLiteModule.detectObjects(imageUri);
       }
   }
   ```

---

## Module 2: VoskModule

### Purpose
Offline speech-to-text recognition using Vosk library.

### Implementation Steps

1. **Download Vosk model**:
   - Get `vosk-model-small-en-us-0.15.zip` (~40MB)
   - Extract to `android/app/src/main/assets/vosk-model/`

2. **Add Vosk dependency** (`build.gradle`):
   ```gradle
   dependencies {
       implementation 'com.alphacephei:vosk-android:0.3.47@aar'
   }
   ```

3. **Create native module** (`VoskModule.java`):
   ```java
   package com.sensebridge;
   
   import org.vosk.*;
   import android.media.AudioRecord;
   import com.facebook.react.bridge.*;
   import com.facebook.react.modules.core.DeviceEventManagerModule;
   
   public class VoskModule extends ReactContextBaseJavaModule {
       private Model model;
       private Recognizer recognizer;
       private AudioRecord audioRecord;
       private Thread listeningThread;
       
       @ReactMethod
       public void initialize(Promise promise) {
           // Load Vosk model from assets
           // Create recognizer
       }
       
       @ReactMethod
       public void startListening() {
           // Start AudioRecord
           // Process audio in background thread
           // Emit events to JavaScript:
           //   - onPartialResult (real-time text)
           //   - onFinalResult (complete sentence)
       }
       
       @ReactMethod
       public void stopListening() {
           // Stop audio recording
           // Clean up threads
       }
       
       private void emitEvent(String eventName, String text) {
           getReactApplicationContext()
               .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
               .emit(eventName, text);
       }
   }
   ```

4. **JavaScript integration** (update `voiceEngine.js`):
   ```javascript
   import { NativeModules, NativeEventEmitter } from 'react-native';
   const { VoskModule } = NativeModules;
   const voskEmitter = new NativeEventEmitter(VoskModule);
   
   async initializeVosk() {
       await VoskModule.initialize();
       
       voskEmitter.addListener('onPartialResult', (text) => {
           this.partialCallback?.(text);
       });
       
       voskEmitter.addListener('onFinalResult', (text) => {
           this.finalCallback?.(text);
       });
   }
   ```

---

## Module 3: MediaPipeModule

### Purpose
Extract hand landmarks for sign language recognition.

### Implementation Steps

1. **Add MediaPipe dependencies** (`build.gradle`):
   ```gradle
   dependencies {
       implementation 'com.google.mediapipe:hands:0.10.9'
       implementation 'com.google.mediapipe:tasks-vision:0.10.9'
   }
   ```

2. **Download MediaPipe model**:
   - Get `hand_landmarker.task` from MediaPipe releases
   - Place in `assets/models/`

3. **Create native module** (`MediaPipeModule.java`):
   ```java
   package com.sensebridge;
   
   import com.google.mediapipe.tasks.vision.handlandmarker.*;
   import com.facebook.react.bridge.*;
   
   public class MediaPipeModule extends ReactContextBaseJavaModule {
       private HandLandmarker handLandmarker;
       
       @ReactMethod
       public void initialize(Promise promise) {
           // Initialize MediaPipe HandLandmarker
           // Load model from assets
       }
       
       @ReactMethod
       public void detectHands(String imageUri, Promise promise) {
           // Load image from URI
           // Run hand detection
           // Extract 21 landmarks per hand (x, y, z)
           // Return as JSON array: [{x, y, z}, ...]
       }
   }
   ```

4. **Integration** (update `SignModeScreen.js`):
   ```javascript
   const processFrameForSigns = async () => {
       if (!cameraRef.current) return;
       
       // Capture frame
       const photo = await cameraRef.current.takePictureAsync({ base64: true });
       
       // Get hand landmarks
       const landmarks = await MediaPipeModule.detectHands(photo.uri);
       
       if (landmarks.length > 0) {
           // Classify sign using TFLite
           const result = await TFLiteModule.classifySign(landmarks);
           // Process result...
       }
   };
   ```

---

## Module 4: UnityBridge

### Purpose
Render 3D avatar with sign language animations.

### Implementation Steps

1. **Create Unity project** (`unity_avatar/`):
   - Unity 2022 LTS
   - Create humanoid 3D character
   - Add Animator with sign animations
   - Export as Android Library (AAR)

2. **Integration approach**:
   - Follow "Unity as a Library" guide
   - Export Unity player as AAR
   - Include in `android/app/libs/`
   - Create bridge module

3. **Create native module** (`UnityBridge.java`):
   ```java
   package com.sensebridge;
   
   import com.facebook.react.bridge.*;
   import com.unity3d.player.UnityPlayer;
   
   public class UnityBridge extends ReactContextBaseJavaModule {
       @ReactMethod
       public void playAnimation(String animationName) {
           // Send message to Unity
           // UnityPlayer.UnitySendMessage("Avatar", "PlaySign", animationName);
       }
       
       @ReactMethod
       public void playSpelling(String letter) {
           // Trigger fingerspelling animation
       }
   }
   ```

---

## Model Training & Conversion

### Currency Recognition Model

1. **Dataset**: Download Indian Currency dataset from Kaggle
2. **Training**:
   ```bash
   # Clone YOLOv5
   git clone https://github.com/ultralytics/yolov5
   cd yolov5
   
   # Train
   python train.py --data currency.yaml --weights yolov5n.pt --epochs 100
   
   # Export to TFLite
   python export.py --weights runs/train/exp/weights/best.pt --include tflite
   ```

### Sign Language Classifier

1. **Dataset**: WLASL or ISL (extract landmarks using MediaPipe)
2. **Training** (TensorFlow):
   ```python
   model = Sequential([
       Dense(128, activation='relu', input_shape=(63,)),  # 21 landmarks × 3
       Dropout(0.3),
       Dense(64, activation='relu'),
       Dense(num_classes, activation='softmax')
   ])
   
   # Train on landmark data
   model.fit(X_train, y_train, epochs=50)
   
   # Convert to TFLite
   converter = tf.lite.TFLiteConverter.from_keras_model(model)
   converter.optimizations = [tf.lite.Optimize.DEFAULT]
   tflite_model = converter.convert()
   ```

---

## Testing Native Modules

1. **Build with native code**:
   ```bash
   npx expo prebuild --clean
   npx expo run:android
   ```

2. **Test each module**:
   ```javascript
   // Test TFLite
   const detections = await TFLiteModule.detectObjects(testImageUri);
   console.log('Detections:', detections);
   
   // Test Vosk
   await VoskModule.initialize();
   await VoskModule.startListening();
   // Speak something
   await VoskModule.stopListening();
   
   // Test MediaPipe
   const landmarks = await MediaPipeModule.detectHands(handImageUri);
   console.log('Landmarks:', landmarks);
   
   // Test Unity
   UnityBridge.playAnimation('hello');
   ```

---

## Next Steps

1. Implement TFLiteModule first (easiest)
2. Implement VoskModule second
3. Implement MediaPipeModule third
4. Implement UnityBridge last (most complex)

Each module can be developed and tested independently.
