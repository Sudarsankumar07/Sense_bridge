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
    Navigation: undefined;
    Settings: undefined;
};

export interface NavigationStep {
    instruction: string;
    distance: number;
    duration: number;
    type: number;
    name: string;
}

export interface NavigationRoute {
    steps: NavigationStep[];
    totalDistance: number;
    totalDuration: number;
    geometry: [number, number][];
}

export interface GeocodingResult {
    name: string;
    label: string;
    coordinates: [number, number];
}

export interface CloudError {
    source: 'object_detection' | 'currency_detection';
    provider: string;
    httpStatus?: number;
    message: string;
    timestamp: number;
}
