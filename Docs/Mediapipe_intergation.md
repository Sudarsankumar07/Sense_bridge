# Gesture recognition guide for Android

The MediaPipe Gesture Recognizer task lets you recognize hand gestures in real time, and
provides the recognized hand gesture results and hand landmarks of the
detected hands. These instructions show you how to use the Gesture Recognizer
with Android apps. The code sample described in these instructions is available
on [GitHub](https://github.com/google-ai-edge/mediapipe-samples/tree/main/examples/gesture_recognizer/android).

You can see this task in action by viewing the
[web demo](https://google-ai-edge.github.io/mediapipe-samples-web/#/vision/gesture_recognizer).
For more information about the capabilities, models, and configuration options
of this task, see the [Overview](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/index).

## Code example

The MediaPipe Tasks example code is a simple implementation of a Gesture Recognizer
app for Android. The example uses the camera on a physical Android device to
continuously detect hand gestures, and can also use images and videos from the
device gallery to statically detect gestures.

You can use the app as a starting point for your own Android app, or refer to it
when modifying an existing app. The Gesture Recognizer example code is hosted on
[GitHub](https://github.com/google-ai-edge/mediapipe-samples/tree/main/examples/gesture_recognizer/android).

### Download the code

The following instructions show you how to create a local copy of the example
code using the [git](https://git-scm.com/) command line tool.

> [!WARNING]
> **Attention:** This MediaPipe Solutions Preview is an early release. [Learn more](https://ai.google.dev/edge/mediapipe/solutions/about#notice).

To download the example code:

1. Clone the git repository using the following command:

   ```
   git clone https://github.com/google-ai-edge/mediapipe-samples
   ```
2. Optionally, configure your git instance to use sparse checkout, so you have only the files for the Gesture Recognizer example app:

   ```
   cd mediapipe-samples
   git sparse-checkout init --cone
   git sparse-checkout set examples/gesture_recognizer/android
   ```

After creating a local version of the example code, you can import the project
into Android Studio and run the app. For instructions, see the
[Setup Guide for Android](https://ai.google.dev/mediapipe/solutions/setup_android#example_code).

### Key components

The following files contain the crucial code for this hand gesture
recognition example application:

- [GestureRecognizerHelper.kt](https://github.com/googlesamples/mediapipe/blob/main/examples/gesture_recognizer/android/app/src/main/java/com/google/mediapipe/examples/gesturerecognizer/GestureRecognizerHelper.kt) - Initializes the gesture recognizer and handles the model and delegate selection.
- [MainActivity.kt](https://github.com/googlesamples/mediapipe/blob/main/examples/gesture_recognizer/android/app/src/main/java/com/google/mediapipe/examples/gesturerecognizer/MainActivity.kt) - Implements the application, including calling `GestureRecognizerHelper` and `GestureRecognizerResultsAdapter`.
- [GestureRecognizerResultsAdapter.kt](https://github.com/googlesamples/mediapipe/blob/main/examples/gesture_recognizer/android/app/src/main/java/com/google/mediapipe/examples/gesturerecognizer/fragment/GestureRecognizerResultsAdapter.kt) - Handles and formats the results.

## Setup

This section describes key steps for setting up your development environment and
code projects specifically to use Gesture Recognizer. For general information on
setting up your development environment for using MediaPipe tasks, including
platform version requirements, see the
[Setup guide for Android](https://ai.google.dev/mediapipe/solutions/setup_android).

> [!WARNING]
> **Attention:** This MediaPipe Solutions Preview is an early release. [Learn more](https://ai.google.dev/edge/mediapipe/solutions/about#notice).

### Dependencies

The Gesture Recognizer task uses the `com.google.mediapipe:tasks-vision`
library. Add this dependency to the `build.gradle` file of your Android app:

    dependencies {
        implementation 'com.google.mediapipe:tasks-vision:latest.release'
    }

### Model

The MediaPipe Gesture Recognizer task requires a trained model bundle that is compatible with
this task. For more information on available trained models for Gesture Recognizer,
see the task overview [Models section](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/index#models).

Select and download the model, and store it within your project directory:

    <dev-project-root>/src/main/assets

Specify the path of the model within the `ModelAssetPath` parameter. In the
example code,
the model is defined in the [`GestureRecognizerHelper.kt`](https://github.com/googlesamples/mediapipe/blob/main/examples/gesture_recognizer/android/app/src/main/java/com/google/mediapipe/examples/gesturerecognizer/GestureRecognizerHelper.kt#L76)
file:

    baseOptionBuilder.setModelAssetPath(MP_RECOGNIZER_TASK)

## Create the task

The MediaPipe Gesture Recognizer task uses the `createFromOptions()` function to set
up the task. The `createFromOptions()` function accepts values for
the configuration options. For more information on configuration options,
see [Configuration options](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/android#configuration_options).

The Gesture Recognizer supports 3 input data types: still images, video files, and
live video streams. You need to specify the running mode corresponding to
your input data type when creating the task. Choose the tab corresponding to
your input data type to see how to create the task and run inference.

### Image

```
val baseOptionsBuilder = BaseOptions.builder().setModelAssetPath(MP_RECOGNIZER_TASK)
val baseOptions = baseOptionBuilder.build()

val optionsBuilder =
    GestureRecognizer.GestureRecognizerOptions.builder()
        .setBaseOptions(baseOptions)
        .setMinHandDetectionConfidence(minHandDetectionConfidence)
        .setMinTrackingConfidence(minHandTrackingConfidence)
        .setMinHandPresenceConfidence(minHandPresenceConfidence)
        .setRunningMode(RunningMode.IMAGE)

val options = optionsBuilder.build()
gestureRecognizer =
    GestureRecognizer.createFromOptions(context, options)
    
```

### Video

```
val baseOptionsBuilder = BaseOptions.builder().setModelAssetPath(MP_RECOGNIZER_TASK)
val baseOptions = baseOptionBuilder.build()

val optionsBuilder =
    GestureRecognizer.GestureRecognizerOptions.builder()
        .setBaseOptions(baseOptions)
        .setMinHandDetectionConfidence(minHandDetectionConfidence)
        .setMinTrackingConfidence(minHandTrackingConfidence)
        .setMinHandPresenceConfidence(minHandPresenceConfidence)
        .setRunningMode(RunningMode.VIDEO)

val options = optionsBuilder.build()
gestureRecognizer =
    GestureRecognizer.createFromOptions(context, options)
    
```

### Live stream

```
val baseOptionsBuilder = BaseOptions.builder().setModelAssetPath(MP_RECOGNIZER_TASK)
val baseOptions = baseOptionBuilder.build()

val optionsBuilder =
    GestureRecognizer.GestureRecognizerOptions.builder()
        .setBaseOptions(baseOptions)
        .setMinHandDetectionConfidence(minHandDetectionConfidence)
        .setMinTrackingConfidence(minHandTrackingConfidence)
        .setMinHandPresenceConfidence(minHandPresenceConfidence)
        .setResultListener(this::returnLivestreamResult)
        .setErrorListener(this::returnLivestreamError)
        .setRunningMode(RunningMode.LIVE_STREAM)

val options = optionsBuilder.build()
gestureRecognizer =
    GestureRecognizer.createFromOptions(context, options)
    
```

> [!NOTE]
> **Note:** If you use the live stream mode, you'll need to register a result listener when creating the task. The listener is called whenever the task has finished processing a video frame with the detection result and the input image as parameters.

> [!NOTE]
> **Note:** If you use the video mode or live stream mode, Gesture Recognizer uses tracking to avoid triggering palm detection model on every frame, which helps reduce the latency of Gesture Recognizer.

The Gesture Recognizer example code implementation allows the user to switch between
processing modes. The approach makes the task creation code more complicated and
may not be appropriate for your use case. You can see this code in the
`setupGestureRecognizer()` function in the
[`GestureRecognizerHelper.kt`](https://github.com/googlesamples/mediapipe/blob/main/examples/gesture_recognizer/android/app/src/main/java/com/google/mediapipe/examples/gesturerecognizer/GestureRecognizerHelper.kt#L79-L95)
file.

### Configuration options

This task has the following configuration options for Android apps:

| Option Name | Description | Value Range | Default Value |
|---|---|---|---|---|
| `runningMode` | Sets the running mode for the task. There are three modes: <br /> IMAGE: The mode for single image inputs. <br /> VIDEO: The mode for decoded frames of a video. <br /> LIVE_STREAM: The mode for a livestream of input data, such as from a camera. In this mode, resultListener must be called to set up a listener to receive results asynchronously. | {`IMAGE, VIDEO, LIVE_STREAM`} | `IMAGE` |
| `numHands` | The maximum number of hands can be detected by the `GestureRecognizer`. | `Any integer > 0` | `1` |
| `minHandDetectionConfidence` | The minimum confidence score for the hand detection to be considered successful in palm detection model. | `0.0 - 1.0` | `0.5` |
| `minHandPresenceConfidence` | The minimum confidence score of hand presence score in the hand landmark detection model. In Video mode and Live stream mode of Gesture Recognizer, if the hand presence confident score from the hand landmark model is below this threshold, it triggers the palm detection model. Otherwise, a lightweight hand tracking algorithm is used to determine the location of the hand(s) for subsequent landmark detection. | `0.0 - 1.0` | `0.5` |
| `minTrackingConfidence` | The minimum confidence score for the hand tracking to be considered successful. This is the bounding box IoU threshold between hands in the current frame and the last frame. In Video mode and Stream mode of Gesture Recognizer, if the tracking fails, Gesture Recognizer triggers hand detection. Otherwise, the hand detection is skipped. | `0.0 - 1.0` | `0.5` |
| `cannedGesturesClassifierOptions` | Options for configuring the canned gestures classifier behavior. The canned gestures are `["None", "Closed_Fist", "Open_Palm", "Pointing_Up", "Thumb_Down", "Thumb_Up", "Victory", "ILoveYou"]` - Display names locale: the locale to use for display names specified through the TFLite Model Metadata, if any. - Max results: the maximum number of top-scored classification results to return. If \< 0, all available results will be returned. - Score threshold: the score below which results are rejected. If set to 0, all available results will be returned. - Category allowlist: the allowlist of category names. If non-empty, classification results whose category is not in this set will be filtered out. Mutually exclusive with denylist. - Category denylist: the denylist of category names. If non-empty, classification results whose category is in this set will be filtered out. Mutually exclusive with allowlist. | - Display names locale: `any string` - Max results: `any integer` - Score threshold: `0.0-1.0` - Category allowlist: `vector of strings` - Category denylist: `vector of strings` | - Display names locale: `"en"` - Max results: `-1` - Score threshold: `0` - Category allowlist: empty - Category denylist: empty |
| `customGesturesClassifierOptions` | Options for configuring the custom gestures classifier behavior. - Display names locale: the locale to use for display names specified through the TFLite Model Metadata, if any. - Max results: the maximum number of top-scored classification results to return. If \< 0, all available results will be returned. - Score threshold: the score below which results are rejected. If set to 0, all available results will be returned. - Category allowlist: the allowlist of category names. If non-empty, classification results whose category is not in this set will be filtered out. Mutually exclusive with denylist. - Category denylist: the denylist of category names. If non-empty, classification results whose category is in this set will be filtered out. Mutually exclusive with allowlist. | - Display names locale: `any string` - Max results: `any integer` - Score threshold: `0.0-1.0` - Category allowlist: `vector of strings` - Category denylist: `vector of strings` | - Display names locale: `"en"` - Max results: `-1` - Score threshold: `0` - Category allowlist: empty - Category denylist: empty |
| `resultListener` | Sets the result listener to receive the classification results asynchronously when the gesture recognizer is in the live stream mode. Can only be used when running mode is set to `LIVE_STREAM` | `ResultListener` | N/A | N/A |
| `errorListener` | Sets an optional error listener. | `ErrorListener` | N/A | N/A |

## Prepare data

Gesture Recognizer works with images, video file and live stream video. The task
handles the data input preprocessing, including resizing, rotation and value
normalization.

The following code demonstrates how to hand off data for processing. Theses
samples include details on how to handle data from images, video files, and live
video streams.

### Image

```
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage

// Convert the input Bitmap object to an MPImage object to run inference
val mpImage = BitmapImageBuilder(image).build()
    
```

### Video

```
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage

val argb8888Frame =
    if (frame.config == Bitmap.Config.ARGB_8888) frame
    else frame.copy(Bitmap.Config.ARGB_8888, false)

// Convert the input Bitmap object to an MPImage object to run inference
val mpImage = BitmapImageBuilder(argb8888Frame).build()
    
```

### Live stream

```
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage

// Convert the input Bitmap object to an MPImage object to run inference
val mpImage = BitmapImageBuilder(rotatedBitmap).build()
    
```

In the
Gesture Recognizer example code, the data preparation is handled in the
[`GestureRecognizerHelper.kt`](https://github.com/googlesamples/mediapipe/blob/main/examples/gesture_recognizer/android/app/src/main/java/com/google/mediapipe/examples/gesturerecognizer/GestureRecognizerHelper.kt#L123-L154)
file.

## Run the task

The Gesture Recognizer uses the `recognize`, `recognizeForVideo`, and `recognizeAsync`
functions to trigger inferences. For gesture recognition, this involves
preprocessing input data, detecting hands in the image, detecting hand
landmarks, and recognizing hand gesture from the landmarks.

The following code demonstrates how to execute the processing with the task model.
These samples include details on how to handle data from images, video files,
and live video streams.

### Image

```
val result = gestureRecognizer?.recognize(mpImage)
    
```

### Video

```
val timestampMs = i * inferenceIntervalMs

gestureRecognizer?.recognizeForVideo(mpImage, timestampMs)
    ?.let { recognizerResult ->
        resultList.add(recognizerResult)
    }
    
```

### Live stream

```
val mpImage = BitmapImageBuilder(rotatedBitmap).build()
val frameTime = SystemClock.uptimeMillis()

gestureRecognizer?.recognizeAsync(mpImage, frameTime)
    
```

Note the following:

- When running in the video mode or the live stream mode, you must also provide the timestamp of the input frame to the Gesture Recognizer task.
- When running in the image or the video mode, the Gesture Recognizer task will block the current thread until it finishes processing the input image or frame. To avoid blocking the user interface, execute the processing in a background thread.
- When running in the live stream mode, the Gesture Recognizer task doesn't block the current thread but returns immediately. It will invoke its result listener with the recognition result every time it has finished processing an input frame. If the recognition function is called when the Gesture Recognizer task is busy processing another frame, the task will ignore the new input frame.

In the
Gesture Recognizer example code, the `recognize`, `recognizeForVideo`, and
`recognizeAsync` functions are defined in the
[`GestureRecognizerHelper.kt`](https://github.com/googlesamples/mediapipe/blob/main/examples/gesture_recognizer/android/app/src/main/java/com/google/mediapipe/examples/gesturerecognizer/fragment/GestureRecognizerResultsAdapter.kt)
file.

## Handle and display results

The Gesture Recognizer generates a gesture detection result object for each
recognition run. The result object contains hand landmarks in image coordinates,
hand landmarks in world coordinates, handedness(left/right hand), and hand
gestures categories of the detected hands.

The following shows an example of the output data from this task:

The resulted `GestureRecognizerResult` contains four components, and each component is an array, where each element contains the detected result of a single detected hand.

- Handedness

  Handedness represents whether the detected hands are left or right hands.
- Gestures

  The recognized gesture categories of the detected hands.
- Landmarks

  There are 21 hand landmarks, each composed of `x`, `y` and `z` coordinates. The
  `x` and `y` coordinates are normalized to \[0.0, 1.0\] by the image width and
  height, respectively. The `z` coordinate represents the landmark depth, with
  the depth at the wrist being the origin. The smaller the value, the closer the
  landmark is to the camera. The magnitude of `z` uses roughly the same scale as
  `x`.
- World Landmarks

  The 21 hand landmarks are also presented in world coordinates. Each landmark
  is composed of `x`, `y`, and `z`, representing real-world 3D coordinates in
  meters with the origin at the hand's geometric center.

    GestureRecognizerResult:
      Handedness:
        Categories #0:
          index        : 0
          score        : 0.98396
          categoryName : Left
      Gestures:
        Categories #0:
          score        : 0.76893
          categoryName : Thumb_Up
      Landmarks:
        Landmark #0:
          x            : 0.638852
          y            : 0.671197
          z            : -3.41E-7
        Landmark #1:
          x            : 0.634599
          y            : 0.536441
          z            : -0.06984
        ... (21 landmarks for a hand)
      WorldLandmarks:
        Landmark #0:
          x            : 0.067485
          y            : 0.031084
          z            : 0.055223
        Landmark #1:
          x            : 0.063209
          y            : -0.00382
          z            : 0.020920
        ... (21 world landmarks for a hand)

The following images shows a visualization of the task output:

![A hand in a thumbs up motion with the skeletal structure of the hand mapped](https://ai.google.dev/static/mediapipe/images/solutions/gesture-recognizer.png)

In the
Gesture Recognizer example code, the `GestureRecognizerResultsAdapter` class in the
[`GestureRecognizerResultsAdapter.kt`](https://github.com/googlesamples/mediapipe/blob/main/examples/gesture_recognizer/android/app/src/main/java/com/google/mediapipe/examples/gesturerecognizer/fragment/GestureRecognizerResultsAdapter.kt#L37-L48)
file handles the results.