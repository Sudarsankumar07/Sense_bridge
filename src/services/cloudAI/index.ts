export { detectObjects } from './objectDetection';
export { detectCurrency, resetCurrencyBuffer } from './currencyRecognition';
export { recognizeSign } from './signLanguage';
export type { ISLDetection } from './signLanguage';
export {
    initializeSpeechRecognition,
    startListening,
    stopListening,
    recognizeCommand,
} from './speechToText';
