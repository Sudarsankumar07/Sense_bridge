import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

class StorageService {
  constructor() {
    this.db = null;
  }

  // Initialize SQLite database
  async initializeDatabase() {
    try {
      this.db = await SQLite.openDatabaseAsync('sensebridge.db');
      
      // Create user_settings table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS user_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      // Create history table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mode TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          event_type TEXT,
          event_data TEXT
        );
      `);

      console.log('Database initialized successfully');
      
      // Set default settings if not exists
      await this.setDefaultSettings();
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  // Set default settings
  async setDefaultSettings() {
    const defaults = {
      voice_speed: '1.0',
      vibration_enabled: 'true',
      alert_sensitivity: 'medium',
      last_mode: 'none'
    };

    for (const [key, value] of Object.entries(defaults)) {
      const existing = await this.getSetting(key);
      if (existing === null) {
        await this.setSetting(key, value);
      }
    }
  }

  // AsyncStorage methods (for quick access)
  async saveToAsyncStorage(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('AsyncStorage save error:', error);
    }
  }

  async loadFromAsyncStorage(key) {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('AsyncStorage load error:', error);
      return null;
    }
  }

  async removeFromAsyncStorage(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('AsyncStorage remove error:', error);
    }
  }

  // SQLite Settings methods
  async setSetting(key, value) {
    if (!this.db) await this.initializeDatabase();
    
    try {
      await this.db.runAsync(
        'INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)',
        [key, String(value)]
      );
    } catch (error) {
      console.error('Set setting error:', error);
    }
  }

  async getSetting(key) {
    if (!this.db) await this.initializeDatabase();
    
    try {
      const result = await this.db.getFirstAsync(
        'SELECT value FROM user_settings WHERE key = ?',
        [key]
      );
      return result ? result.value : null;
    } catch (error) {
      console.error('Get setting error:', error);
      return null;
    }
  }

  async getAllSettings() {
    if (!this.db) await this.initializeDatabase();
    
    try {
      const results = await this.db.getAllAsync('SELECT * FROM user_settings');
      const settings = {};
      results.forEach(row => {
        settings[row.key] = row.value;
      });
      return settings;
    } catch (error) {
      console.error('Get all settings error:', error);
      return {};
    }
  }

  // History methods
  async addHistory(mode, eventType, eventData) {
    if (!this.db) await this.initializeDatabase();
    
    try {
      const timestamp = Date.now();
      await this.db.runAsync(
        'INSERT INTO history (mode, timestamp, event_type, event_data) VALUES (?, ?, ?, ?)',
        [mode, timestamp, eventType, JSON.stringify(eventData)]
      );
    } catch (error) {
      console.error('Add history error:', error);
    }
  }

  async getHistory(mode = null, limit = 50) {
    if (!this.db) await this.initializeDatabase();
    
    try {
      let query = 'SELECT * FROM history';
      let params = [];
      
      if (mode) {
        query += ' WHERE mode = ?';
        params.push(mode);
      }
      
      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);
      
      const results = await this.db.getAllAsync(query, params);
      return results.map(row => ({
        ...row,
        event_data: JSON.parse(row.event_data)
      }));
    } catch (error) {
      console.error('Get history error:', error);
      return [];
    }
  }

  async clearHistory(mode = null) {
    if (!this.db) await this.initializeDatabase();
    
    try {
      if (mode) {
        await this.db.runAsync('DELETE FROM history WHERE mode = ?', [mode]);
      } else {
        await this.db.runAsync('DELETE FROM history');
      }
    } catch (error) {
      console.error('Clear history error:', error);
    }
  }

  // Utility methods
  async getVoiceSpeed() {
    const speed = await this.getSetting('voice_speed');
    return speed ? parseFloat(speed) : 1.0;
  }

  async setVoiceSpeed(speed) {
    await this.setSetting('voice_speed', speed.toString());
  }

  async isVibrationEnabled() {
    const enabled = await this.getSetting('vibration_enabled');
    return enabled === 'true';
  }

  async setVibrationEnabled(enabled) {
    await this.setSetting('vibration_enabled', enabled ? 'true' : 'false');
  }

  async getLastMode() {
    return await this.getSetting('last_mode');
  }

  async setLastMode(mode) {
    await this.setSetting('last_mode', mode);
  }
}

// Export singleton instance
export default new StorageService();
