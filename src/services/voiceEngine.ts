import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import config from '../constants/config';
import { GEMINI_API_KEY } from '@env';

export type VoiceCommandResult = {
    text: string | null;
    confidence: number;
    isFinal: boolean;
};

let currentRate = config.VOICE.DEFAULT_SPEED;
let currentLanguage = config.VOICE.LANGUAGE;

export const setVoiceSettings = (rate: number, language: string) => {
    currentRate = Math.max(config.VOICE.MIN_SPEED, Math.min(config.VOICE.MAX_SPEED, rate));
    currentLanguage = language;
};

export const speak = (text: string, interrupt = true) => {
    if (interrupt) {
        Speech.stop();
    }

    Speech.speak(text, {
        rate: currentRate,
        language: currentLanguage,
        pitch: 1.0,
    });
};

/**
 * Speak text and wait for it to finish before resolving.
 * Adds a small delay after TTS finishes to prevent mic echo.
 */
export const speakAndWait = (text: string): Promise<void> => {
    return new Promise((resolve) => {
        Speech.stop();
        Speech.speak(text, {
            rate: currentRate,
            language: currentLanguage,
            pitch: 1.0,
            onDone: () => {
                // Delay to let audio dissipate before mic starts
                setTimeout(resolve, 600);
            },
            onError: () => {
                setTimeout(resolve, 300);
            },
        });
    });
};

export const stopSpeaking = () => {
    Speech.stop();
};

// Minimum confidence to accept a voice recognition result
// Kept low (0.25) since single words often get lower scores; echo is handled by pattern filter
const MIN_CONFIDENCE = 0.25;

/**
 * Record audio from the microphone using expo-av, then send to
 * Google Cloud Speech-to-Text API for transcription.
 * Works in Expo Go — no native build required.
 *
 * On web, uses the browser's Web Speech API instead (no file system needed).
 */
let isRecording = false; // global mutex — only one recording at a time
let recordingMutexTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Force-reset the recording mutex.
 * Call this from the volume-button trigger to clear any stale lock
 * left behind by an interrupted recording session.
 */
export const forceResetRecordingState = () => {
    if (recordingMutexTimer) {
        clearTimeout(recordingMutexTimer);
        recordingMutexTimer = null;
    }
    isRecording = false;
    console.log('[VoiceEngine] 🔄 Recording mutex force-reset');
};

/**
 * Web-specific: use the browser's SpeechRecognition API.
 */
const listenForCommandWeb = (timeoutMs = 4000): Promise<VoiceCommandResult> => {
    return new Promise((resolve) => {
        const SpeechRecognition =
            (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('[VoiceEngine] Web Speech API not supported in this browser');
            resolve({ text: null, confidence: 0, isFinal: true });
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = currentLanguage;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        let settled = false;
        const finish = (result: VoiceCommandResult) => {
            if (settled) return;
            settled = true;
            try { recognition.stop(); } catch (_) { }
            resolve(result);
        };

        // Timeout fallback
        const timer = setTimeout(() => {
            console.log('[VoiceEngine] Web speech timeout');
            finish({ text: null, confidence: 0, isFinal: true });
        }, timeoutMs + 1000);

        recognition.onresult = (event: any) => {
            clearTimeout(timer);
            const transcript = event.results[0]?.[0]?.transcript;
            const confidence = event.results[0]?.[0]?.confidence ?? 0.9;
            console.log(`[VoiceEngine] Web recognized: "${transcript}" (confidence: ${confidence})`);
            // Reject low-confidence results (likely echo or noise)
            if (confidence < MIN_CONFIDENCE) {
                console.log('[VoiceEngine] Rejected — below confidence threshold');
                finish({ text: null, confidence: 0, isFinal: true });
                return;
            }
            finish({ text: transcript || null, confidence, isFinal: true });
        };

        recognition.onerror = (event: any) => {
            clearTimeout(timer);
            // "no-speech" is not a real error, just means silence
            if (event.error === 'no-speech') {
                console.log('[VoiceEngine] Web: no speech detected');
            } else {
                console.error('[VoiceEngine] Web speech error:', event.error);
            }
            finish({ text: null, confidence: 0, isFinal: true });
        };

        recognition.onend = () => {
            clearTimeout(timer);
            finish({ text: null, confidence: 0, isFinal: true });
        };

        try {
            recognition.start();
        } catch (err) {
            clearTimeout(timer);
            console.error('[VoiceEngine] Failed to start web speech:', err);
            finish({ text: null, confidence: 0, isFinal: true });
        }
    });
};

/**
 * Native: record via expo-av, send to Google Cloud STT.
 */
const listenForCommandNative = async (timeoutMs = 4000): Promise<VoiceCommandResult> => {
    let recording: Audio.Recording | null = null;

    try {
        // Configure audio session for recording
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
        });

        // Start recording
        recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
            android: {
                extension: '.m4a',
                outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                audioEncoder: Audio.AndroidAudioEncoder.AAC,
                sampleRate: 16000,
                numberOfChannels: 1,
                bitRate: 128000,
            },
            ios: {
                extension: '.wav',
                outputFormat: Audio.IOSOutputFormat.LINEARPCM,
                audioQuality: Audio.IOSAudioQuality.HIGH,
                sampleRate: 16000,
                numberOfChannels: 1,
                bitRate: 128000,
                linearPCMBitDepth: 16,
                linearPCMIsBigEndian: false,
                linearPCMIsFloat: false,
            },
            web: {
                mimeType: 'audio/webm',
                bitsPerSecond: 128000,
            },
        });

        await recording.startAsync();

        // Record for the specified duration
        await new Promise((resolve) => setTimeout(resolve, timeoutMs));

        // Stop recording
        await recording.stopAndUnloadAsync();

        // Reset audio mode so audio playback (TTS) works again
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
        });

        const uri = recording.getURI();
        if (!uri) {
            console.warn('[VoiceEngine] No recording URI');
            return { text: null, confidence: 0, isFinal: true };
        }

        // Read audio file as base64
        // Use literal 'base64' string — avoids FileSystem.EncodingType enum issues
        // across expo-file-system version upgrades.
        const base64Audio = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType?.Base64 ?? 'base64' as any,
        });

        // Send to Gemini 1.5 Flash for transcription
        const apiKey = GEMINI_API_KEY;
        if (!apiKey || apiKey === 'your_gemini_api_key_here') {
            console.warn('[VoiceEngine] Gemini API key not configured');
            return { text: null, confidence: 0, isFinal: true };
        }

        const mimeType = Platform.OS === 'android' ? 'audio/mp4' : 'audio/wav';

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: "Transcribe this short voice command. Reply with ONLY the exact words spoken, no quotes, no punctuation. If there is no clear speech or it is just background noise, reply with exactly: null" },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64Audio,
                            },
                        },
                    ],
                },
            ],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 64,
            },
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            }
        );

        const data = await response.json();

        if (!response.ok || data.error) {
            console.error(`[VoiceEngine] API error: ${data.error?.message || response.statusText}`);
            return { text: null, confidence: 0, isFinal: true };
        }

        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const transcript = rawText.replace(/^["']|["']$/g, '');

        if (transcript && transcript.toLowerCase() !== 'null') {
            console.log(`[VoiceEngine] Recognized: "${transcript}"`);
            return {
                text: transcript,
                confidence: 0.9, // Gemini doesn't provide confidence, assume high if text is returned
                isFinal: true,
            };
        }

        console.log('[VoiceEngine] No speech detected');
        return { text: null, confidence: 0, isFinal: true };
    } catch (error) {
        console.error('[VoiceEngine] Speech recognition error:', error);

        // Ensure audio mode is reset even on error
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });
        } catch (_) { }

        return { text: null, confidence: 0, isFinal: true };
    }
};

/**
 * Listen for a voice command. Routes to Web Speech API on web,
 * or expo-av + Google Cloud STT on native.
 */
export const listenForCommand = async (timeoutMs = 4000): Promise<VoiceCommandResult> => {
    // Prevent concurrent recordings
    if (isRecording) {
        console.warn('[VoiceEngine] Already recording — ignoring duplicate trigger');
        return { text: null, confidence: 0, isFinal: true };
    }
    isRecording = true;

    // Safety timeout: if something crashes mid-recording, auto-unlock after timeoutMs + 10s
    if (recordingMutexTimer) clearTimeout(recordingMutexTimer);
    recordingMutexTimer = setTimeout(() => {
        if (isRecording) {
            console.warn('[VoiceEngine] ⚠️ Safety timeout hit — force-unlocking recording mutex');
            isRecording = false;
        }
    }, timeoutMs + 10000);

    // Stop any active TTS to prevent echo pickup
    Speech.stop();
    // Small delay for audio to dissipate before mic opens
    await new Promise(r => setTimeout(r, 500));

    try {
        if (Platform.OS === 'web') {
            return await listenForCommandWeb(timeoutMs);
        }
        return await listenForCommandNative(timeoutMs);
    } finally {
        isRecording = false;
        if (recordingMutexTimer) {
            clearTimeout(recordingMutexTimer);
            recordingMutexTimer = null;
        }
    }
};
