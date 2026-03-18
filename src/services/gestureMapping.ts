/**
 * Gesture Mapping Service
 * Maps keywords in transcripts to avatar gestures and emotions
 */

export interface GestureMapping {
  keywords: string[];
  gesture: string;
  emotion?: string;
}

export const GESTURE_MAPPINGS: GestureMapping[] = [
  // Positive responses
  {
    keywords: ['yes', 'yeah', 'yep', 'okay', 'ok', 'sure', 'alright', 'correct'],
    gesture: 'thumbup',
    emotion: 'happy'
  },
  
  // Negative responses
  {
    keywords: ['no', 'nope', 'never', 'not', 'wrong'],
    gesture: 'thumbdown',
    emotion: 'neutral'
  },
  
  // Wait/Stop
  {
    keywords: ['wait', 'stop', 'hold', 'pause', 'hang on'],
    gesture: 'handup',
    emotion: 'neutral'
  },
  
  // Greetings
  {
    keywords: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'],
    gesture: 'wave',
    emotion: 'happy'
  },
  
  // Gratitude
  {
    keywords: ['thank', 'thanks', 'appreciate', 'grateful'],
    gesture: 'namaste',
    emotion: 'happy'
  },
  
  // Help/Attention
  {
    keywords: ['help', 'please', 'excuse me', 'attention'],
    gesture: 'handup',
    emotion: 'neutral'
  },
  
  // Goodbye
  {
    keywords: ['bye', 'goodbye', 'see you', 'farewell', 'later'],
    gesture: 'wave',
    emotion: 'neutral'
  }
];

/**
 * Detect gesture and emotion from transcript text
 * @param text - The transcript text to analyze
 * @returns Object with optional gesture and emotion
 */
export function detectGesture(text: string): { gesture?: string; emotion?: string } {
  if (!text || typeof text !== 'string') {
    return {};
  }

  const lowerText = text.toLowerCase().trim();
  
  // Check each mapping
  for (const mapping of GESTURE_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      // Use word boundary matching for better accuracy
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(lowerText)) {
        return {
          gesture: mapping.gesture,
          emotion: mapping.emotion
        };
      }
    }
  }
  
  // No gesture detected
  return {};
}

/**
 * Get emotion from text sentiment (basic implementation)
 * @param text - The transcript text to analyze
 * @returns Emotion string
 */
export function detectEmotion(text: string): string {
  if (!text || typeof text !== 'string') {
    return 'neutral';
  }

  const lowerText = text.toLowerCase();
  
  // Positive emotions
  const positiveWords = ['happy', 'great', 'wonderful', 'excellent', 'good', 'love', 'amazing', 'fantastic'];
  if (positiveWords.some(word => lowerText.includes(word))) {
    return 'happy';
  }
  
  // Negative emotions
  const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'hate', 'angry', 'upset'];
  if (negativeWords.some(word => lowerText.includes(word))) {
    return 'sad';
  }
  
  // Fear/concern
  const fearWords = ['scared', 'afraid', 'worried', 'nervous', 'anxious'];
  if (fearWords.some(word => lowerText.includes(word))) {
    return 'fear';
  }
  
  return 'neutral';
}

/**
 * Get all available gestures
 * @returns Array of gesture names
 */
export function getAvailableGestures(): string[] {
  return Array.from(new Set(GESTURE_MAPPINGS.map(m => m.gesture)));
}

/**
 * Get all available emotions
 * @returns Array of emotion names
 */
export function getAvailableEmotions(): string[] {
  return ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'love', 'sleep'];
}
