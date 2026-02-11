import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { AppMode, HistoryEntry, UserSettings } from '../types';
import config from '../constants/config';

const SETTINGS_KEY = 'sensebridge.settings';
const LAST_MODE_KEY = 'sensebridge.last_mode';

let db: SQLite.SQLiteDatabase | null = null;

const getDb = () => {
    if (!db) {
        db = SQLite.openDatabase('sensebridge.db');
        db.transaction(tx => {
            tx.executeSql(
                'CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY NOT NULL, mode TEXT, timestamp INTEGER, output TEXT);'
            );
        });
    }

    return db;
};

export const getSettings = async (): Promise<UserSettings> => {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) {
        return {
            voiceSpeed: config.VOICE.DEFAULT_SPEED,
            vibrationEnabled: true,
            language: config.VOICE.LANGUAGE,
        };
    }

    return JSON.parse(raw) as UserSettings;
};

export const saveSettings = async (settings: UserSettings) => {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const getLastMode = async (): Promise<AppMode | null> => {
    const value = await AsyncStorage.getItem(LAST_MODE_KEY);
    return value ? (value as AppMode) : null;
};

export const setLastMode = async (mode: AppMode) => {
    await AsyncStorage.setItem(LAST_MODE_KEY, mode);
};

export const addHistoryEntry = async (entry: HistoryEntry) => {
    const database = getDb();
    database.transaction(tx => {
        tx.executeSql('INSERT INTO history (id, mode, timestamp, output) VALUES (?, ?, ?, ?);', [
            entry.id,
            entry.mode,
            entry.timestamp,
            entry.output,
        ]);
    });
};

export const getHistory = async (): Promise<HistoryEntry[]> => {
    const database = getDb();
    return new Promise(resolve => {
        database.transaction(tx => {
            tx.executeSql('SELECT * FROM history ORDER BY timestamp DESC LIMIT 50;', [], (_, result) => {
                resolve(result.rows._array as HistoryEntry[]);
                return false;
            });
        });
    });
};
