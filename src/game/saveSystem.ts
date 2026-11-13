import type { GameSettings, SaveData, SoundSettings } from './types';
import { createDefaultInventory } from './inventory';

const SAVE_KEY = 'city_crime_open_world_save_v1';
const SETTINGS_KEY = 'city_crime_open_world_settings_v1';
const SOUND_KEY = 'city_crime_open_world_sound_v1';

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  shadows: true,
  trafficDensity: 'medium',
  dayNightSpeed: 1,
  weatherMode: 'auto',
  mobileControls: 'auto',
  cameraSensitivity: 1.0,
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  masterVolume: 0.7,
  sfxVolume: 0.85,
  ambientVolume: 0.55,
  muted: false,
};

export function createFreshSaveData(): SaveData {
  return {
    money: 1200,
    health: 100,
    armor: 50,
    playerPos: { x: -16, y: 0.2, z: 54 }, // Starts near Dealership & Downtown
    completedMissions: [],
    discoveredLocations: [],
    collectedIds: [],
    inventory: createDefaultInventory(),
    timeOfDay: 10.5, // Crisp late morning sunlight
    savedAt: Date.now(),
  };
}

export function loadSaveData(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveData;
    if (!parsed || typeof parsed.money !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSaveData(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // ignore storage quota errors
  }
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_GAME_SETTINGS };
    return { ...DEFAULT_GAME_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) };
  } catch {
    return { ...DEFAULT_GAME_SETTINGS };
  }
}

export function saveGameSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function loadSoundSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(SOUND_KEY);
    if (!raw) return { ...DEFAULT_SOUND_SETTINGS };
    return { ...DEFAULT_SOUND_SETTINGS, ...(JSON.parse(raw) as Partial<SoundSettings>) };
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

export function saveSoundSettings(settings: SoundSettings): void {
  try {
    localStorage.setItem(SOUND_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
