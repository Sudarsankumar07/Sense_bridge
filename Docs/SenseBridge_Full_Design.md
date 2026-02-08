# 🚀 SenseBridge -- Full Design & Implementation Document

------------------------------------------------------------------------

## 🧭 Project Goal

SenseBridge is an **offline-first accessibility mobile application**
that enables communication between: - Deaf users - Mute users - Blind
users - Normal users

The system uses **on-device AI models** and **zero-cost open-source
technologies**.

------------------------------------------------------------------------

# 🌟 Core Features

## 🤟 Offline Sign Language Recognition

Camera detects sign → Converts to text → Converts to voice output

## 🧑‍🦻 Sign Avatar for Deaf Users

Speech/Text → Converted → Avatar shows sign animation

## 👨‍🦯 Blind Assist Mode

-   Voice-based navigation
-   Obstacle detection
-   Currency detection (Notes + Coins)

## 🗣 Voice Mode Selection (App Opening)

App speaks and listens offline for mode selection.

------------------------------------------------------------------------

# 🧰 Final Tech Stack

## 📱 Mobile

-   React Native (CLI or Expo Bare)
-   TypeScript

## 🤖 On-Device AI

-   MediaPipe Hands → Hand tracking
-   TensorFlow Lite → Sign classification
-   Vosk → Offline speech recognition
-   YOLOv5 Nano TFLite → Object detection
-   Custom YOLO TFLite → Currency detection
-   Unity → Avatar animation engine
-   Android Offline TTS → Voice output

## 💾 Storage

-   SQLite
-   Async Storage

## ❌ Backend

Not required for MVP.

------------------------------------------------------------------------

# 🧠 System Architecture

    Camera + Mic
          ↓
    On Device AI Models
          ↓
    Decision Engine
          ↓
    Output (Voice + Avatar + Text)

------------------------------------------------------------------------

# 📱 App Opening Flow (Voice First UX)

1.  App opens
2.  Offline TTS speaks welcome message
3.  Offline STT listens for command
4.  Mode selected automatically

Commands: - Blind Mode - Sign Mode - Deaf Mode

------------------------------------------------------------------------

# 👨‍🦯 Blind Mode Implementation

## Obstacle Detection

Camera → YOLO TFLite → Distance Estimate → Voice Alert

Alerts: - Obstacle ahead - Person in front - Step detected

## Currency Detection

Camera → Currency YOLO → Class Prediction → TTS Output

------------------------------------------------------------------------

# 🤟 Sign Recognition Implementation

Camera → MediaPipe Hands → TFLite Gesture Model → Text → TTS

Dataset: - Capture 500+ samples per sign - Train CNN → Convert to TFLite

------------------------------------------------------------------------

# 🧑‍🦻 Deaf Mode Avatar Implementation

Speech → Offline STT → Text → Word Mapping → Avatar Animation

Avatar handled by Unity: - Prebuilt animations - Trigger animation based
on words

------------------------------------------------------------------------

# 🎤 Voice Command Engine

Using Vosk Offline STT

Commands: - Blind Mode - Sign Mode - Deaf Mode - Exit - Repeat

------------------------------------------------------------------------

# 💾 Dataset Strategy

## Sign Language

-   WLASL Dataset
-   Indian Sign Language Dataset
-   Self captured gestures

## Currency

-   Indian Currency Kaggle Dataset

## Object Detection

-   COCO Dataset subset

------------------------------------------------------------------------

# ⚡ Performance Planning

Minimum Device: - 4GB RAM - Android 10+

Approx AI Size: - Hand Model \~10MB - YOLO Model \~15MB - Currency Model
\~15MB - Vosk Model \~40MB

------------------------------------------------------------------------

# 🎨 UI Design Guidelines

Theme: - Dark Mode - Neon Blue Accent - High Contrast Accessibility

Accessibility: - Big Buttons - Voice Feedback - Haptic Feedback

------------------------------------------------------------------------

# 🛠 Development Roadmap

## Phase 1 (Weeks 1-2)

-   Base App UI
-   Offline TTS
-   Voice Mode Selection

## Phase 2 (Weeks 3-5)

-   Sign Recognition Basic

## Phase 3 (Weeks 6-8)

-   Obstacle Detection

## Phase 4 (Weeks 9-10)

-   Currency Detection

## Phase 5 (Weeks 11-12)

-   Avatar Integration

------------------------------------------------------------------------

# 💰 Cost

Total Cost = ₹0

All tools are open source and offline.

------------------------------------------------------------------------

# ⭐ Final Outcome

A futuristic offline accessibility mobile app using Edge AI and Computer
Vision that helps multiple disabled communities communicate and navigate
independently.
