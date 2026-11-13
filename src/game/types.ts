export type GameScreen =
  | 'main_menu'
  | 'playing'
  | 'paused'
  | 'missions'
  | 'inventory'
  | 'settings'
  | 'controls'
  | 'sound'
  | 'mission_complete'
  | 'game_over';

export type WeatherType = 'sunny' | 'cloudy' | 'rain' | 'thunderstorm' | 'fog';

export type VehicleCategory =
  | 'sports'
  | 'supercar'
  | 'suv'
  | 'motorcycle'
  | 'police'
  | 'truck'
  | 'bus';

export interface VehicleSpec {
  category: VehicleCategory;
  name: string;
  maxSpeed: number; // km/h display & physics cap
  accel: number;
  brakeForce: number;
  turnSpeed: number;
  driftGrip: number;
  mass: number;
  width: number;
  height: number;
  length: number;
  color: number;
}

export type WeaponGadgetId = 'fist' | 'emp_stunner' | 'signal_jammer' | 'turbo_dash';

export interface InventoryItem {
  id: string;
  name: string;
  category: 'gadget' | 'consumable' | 'collectible';
  description: string;
  quantity: number;
  maxQuantity: number;
  ammo?: number;
  maxAmmo?: number;
  gadgetId?: WeaponGadgetId;
}

export type MissionStatus = 'available' | 'active' | 'completed';

export interface MissionObjective {
  id: string;
  description: string;
  targetPos?: { x: number; y: number; z: number };
  radius?: number;
  completed: boolean;
}

export interface MissionDef {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  rewardMoney: number;
  startPos: { x: number; y: number; z: number };
  timeLimitSec?: number;
}

export interface LandmarkDef {
  id: string;
  name: string;
  district: string;
  x: number;
  y: number;
  z: number;
  color: string;
}

export interface GameSettings {
  shadows: boolean;
  trafficDensity: 'low' | 'medium' | 'high';
  dayNightSpeed: number; // 0 = paused, 1 = normal, 3 = fast
  weatherMode: 'auto' | WeatherType;
  mobileControls: 'auto' | 'on' | 'off';
  cameraSensitivity: number;
}

export interface SoundSettings {
  masterVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  muted: boolean;
}

export interface MinimapBlip {
  x: number;
  z: number;
  type: 'vehicle' | 'police' | 'mission' | 'landmark' | 'collectible' | 'racer';
  color: string;
  label?: string;
}

export interface HudState {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  money: number;
  wantedLevel: number; // 0..5
  wantedSearching: boolean;
  wantedCooldownPct: number; // 0..1
  timeOfDay: number; // 0..24 hours
  weather: WeatherType;
  districtName: string;
  inVehicle: boolean;
  vehicleName: string;
  vehicleCategory: VehicleCategory | null;
  speedKmh: number;
  vehicleCondition: number; // 0..100
  headlightsOn: boolean;
  equippedGadget: WeaponGadgetId;
  gadgetAmmo: Record<WeaponGadgetId, number>;
  activeMissionId: string | null;
  activeMissionTitle: string | null;
  activeObjectiveText: string | null;
  missionTimerSec: number | null;
  missionProgressText: string | null;
  interactPrompt: string | null;
  notificationText: string | null;
  completedMissions: string[];
  discoveredLocations: string[];
  collectiblesFound: number;
  totalCollectibles: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerYaw: number;
  minimapBlips: MinimapBlip[];
  racePosition?: number;
  raceTotal?: number;
}

export interface MissionResult {
  missionId: string;
  title: string;
  rewardMoney: number;
  timeTakenSec: number;
}

export interface SaveData {
  money: number;
  health: number;
  armor: number;
  playerPos: { x: number; y: number; z: number };
  completedMissions: string[];
  discoveredLocations: string[];
  collectedIds: string[];
  inventory: InventoryItem[];
  timeOfDay: number;
  savedAt: number;
}

export interface MobileInputState {
  moveX: number; // -1..1
  moveY: number; // -1..1 (forward positive)
  lookDeltaX: number;
  lookDeltaY: number;
  jump: boolean;
  sprint: boolean;
  handbrake: boolean;
}
