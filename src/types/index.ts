export enum AppMode {
    BLIND = 'BLIND',
    SIGN = 'SIGN',
    DEAF = 'DEAF',
}

export interface DetectionResult {
    type: string;
    confidence: number;
    data: any;
    timestamp: number;
}

export interface ObjectDetection {
    class: string;
    confidence: number;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    distance?: number;
}

export interface CurrencyDetection {
    denomination: number;
    currency: string;
    confidence: number;
}

export interface SignDetection {
    sign: string;
    text: string;
    confidence: number;
}

export interface SpeechResult {
    text: string;
    isFinal: boolean;
    confidence: number;
}

export interface UserSettings {
    voiceSpeed: number;
    vibrationEnabled: boolean;
    language: string;
    lastMode?: AppMode;
}

export interface HistoryEntry {
    id: string;
    mode: AppMode;
    timestamp: number;
    output: string;
}

export type RootStackParamList = {
    Splash: undefined;
    ModeSelection: undefined;
    BlindMode: undefined;
    SignMode: undefined;
    DeafMode: undefined;
    Settings: undefined;
};
