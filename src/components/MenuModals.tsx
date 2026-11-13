import {
  CheckCircle2,
  ChevronLeft,
  Compass,
  Gamepad2,
  MapPin,
  Package,
  Play,
  RotateCcw,
  Save,
  Settings,
  Sliders,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { STORY_MISSIONS } from '../game/missions';
import type {
  GameScreen,
  GameSettings,
  HudState,
  InventoryItem,
  MissionResult,
  SoundSettings,
  WeatherType,
} from '../game/types';

interface MenuModalsProps {
  screen: GameScreen;
  returnTarget: 'main_menu' | 'paused';
  hasSave: boolean;
  hud: HudState;
  inventory: InventoryItem[];
  settings: GameSettings;
  soundSettings: SoundSettings;
  missionResult: MissionResult | null;
  gameOverReason: string;
  onNavigate: (s: GameScreen) => void;
  onNewGame: () => void;
  onContinue: () => void;
  onResume: () => void;
  onSaveGame: () => void;
  onRestart: () => void;
  onRespawn: () => void;
  onMainMenu: () => void;
  onStartMission: (missionId: string) => void;
  onCancelMission: () => void;
  onUseInventoryItem: (itemId: string) => void;
  onUpdateSettings: (next: GameSettings) => void;
  onUpdateSound: (next: SoundSettings) => void;
}

export function MenuModals({
  screen,
  returnTarget,
  hasSave,
  hud,
  inventory,
  settings,
  soundSettings,
  missionResult,
  gameOverReason,
  onNavigate,
  onNewGame,
  onContinue,
  onResume,
  onSaveGame,
  onRestart,
  onRespawn,
  onMainMenu,
  onStartMission,
  onCancelMission,
  onUseInventoryItem,
  onUpdateSettings,
  onUpdateSound,
}: MenuModalsProps) {
  if (screen === 'playing') return null;

  // MAIN MENU: Clean left-aligned dock over live 3D city aerial flyover
  if (screen === 'main_menu') {
    return (
      <div className="fixed inset-0 z-30 flex items-center bg-gradient-to-r from-zinc-950/90 via-zinc-950/55 to-transparent p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-amber-400">
              Open-World Action Adventure
            </p>
            <h1 className="mt-1.5 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white">
              CITY CRIME
            </h1>
            <p className="font-display text-lg font-semibold tracking-wider text-zinc-300">
              OPEN WORLD
            </p>
            <p className="mt-3 text-sm text-zinc-300 leading-relaxed max-w-sm">
              Explore a living 3D metropolis with 7 vehicle classes, dynamic traffic and police pursuits,
              story missions, day-night lighting, and shifting weather.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 max-w-xs">
            {hasSave && (
              <button
                onClick={onContinue}
                className="flex items-center justify-between rounded-lg bg-amber-400 px-5 py-3 text-sm font-bold text-zinc-950 hover:bg-amber-300 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Play className="w-4 h-4 fill-current" />
                  Continue
                </span>
                <span className="font-mono-hud text-xs text-zinc-900">Resume Save</span>
              </button>
            )}

            <button
              onClick={onNewGame}
              className={`flex items-center justify-between rounded-lg px-5 py-3 text-sm font-bold transition-colors ${
                hasSave
                  ? 'border border-white/15 bg-zinc-900/90 text-white hover:bg-zinc-800'
                  : 'bg-amber-400 text-zinc-950 hover:bg-amber-300'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Compass className="w-4 h-4" />
                New Game
              </span>
            </button>

            <button
              onClick={() => onNavigate('missions')}
              className="flex items-center gap-2.5 rounded-lg border border-white/15 bg-zinc-900/90 px-5 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <MapPin className="w-4 h-4 text-cyan-400" />
              Missions
            </button>

            <button
              onClick={() => onNavigate('settings')}
              className="flex items-center gap-2.5 rounded-lg border border-white/15 bg-zinc-900/90 px-5 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <Settings className="w-4 h-4 text-zinc-300" />
              Settings
            </button>

            <button
              onClick={() => onNavigate('controls')}
              className="flex items-center gap-2.5 rounded-lg border border-white/15 bg-zinc-900/90 px-5 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <Gamepad2 className="w-4 h-4 text-zinc-300" />
              Controls
            </button>

            <button
              onClick={() => onNavigate('sound')}
              className="flex items-center gap-2.5 rounded-lg border border-white/15 bg-zinc-900/90 px-5 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <Volume2 className="w-4 h-4 text-zinc-300" />
              Sound Settings
            </button>
          </div>

          <p className="pt-2 text-xs font-medium text-zinc-400">
            Developed by <span className="font-display font-semibold text-zinc-200">JEHFIL MUHAMMED 3rd B</span>
          </p>
        </div>
      </div>
    );
  }

  // CENTERED MODAL CONTAINER FOR ALL SUB-SCREENS
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-zinc-950/75 p-4">
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-xl border border-white/15 bg-zinc-900 p-6 shadow-2xl">
        {/* PAUSE MENU */}
        {screen === 'paused' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">Game Paused</h2>
                <p className="text-xs text-zinc-400">
                  {hud.districtName} · ${hud.money.toLocaleString()} · {hud.completedMissions.length}/5 Missions
                </p>
              </div>
              <button
                onClick={onResume}
                className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-300"
              >
                Resume
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={onSaveGame}
                className="flex items-center gap-2.5 rounded-lg border border-white/15 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                Save Progress
              </button>
              <button
                onClick={() => onNavigate('missions')}
                className="flex items-center gap-2.5 rounded-lg border border-white/15 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                <MapPin className="w-4 h-4 text-cyan-400" />
                Missions
              </button>
              <button
                onClick={() => onNavigate('inventory')}
                className="flex items-center gap-2.5 rounded-lg border border-white/15 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                <Package className="w-4 h-4 text-amber-400" />
                Inventory & Gadgets
              </button>
              <button
                onClick={() => onNavigate('settings')}
                className="flex items-center gap-2.5 rounded-lg border border-white/15 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                <Sliders className="w-4 h-4 text-zinc-300" />
                Settings
              </button>
              <button
                onClick={() => onNavigate('controls')}
                className="flex items-center gap-2.5 rounded-lg border border-white/15 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                <Gamepad2 className="w-4 h-4 text-zinc-300" />
                Controls
              </button>
              <button
                onClick={() => onNavigate('sound')}
                className="flex items-center gap-2.5 rounded-lg border border-white/15 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                <Volume2 className="w-4 h-4 text-zinc-300" />
                Sound Settings
              </button>
              <button
                onClick={onRestart}
                className="flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm font-semibold text-rose-200 hover:bg-rose-900/40"
              >
                <RotateCcw className="w-4 h-4" />
                Restart New Game
              </button>
              <button
                onClick={onMainMenu}
                className="flex items-center gap-2.5 rounded-lg border border-white/15 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                <ChevronLeft className="w-4 h-4" />
                Main Menu
              </button>
            </div>

            <p className="border-t border-white/10 pt-3 text-center text-xs text-zinc-400">
              Developed by <span className="font-display font-semibold text-zinc-200">JEHFIL MUHAMMED 3rd B</span>
            </p>
          </div>
        )}

        {/* MISSIONS MENU */}
        {screen === 'missions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">Story Missions</h2>
                <p className="text-xs text-zinc-400">
                  {hud.completedMissions.length} of {STORY_MISSIONS.length} completed · Select any mission to begin
                </p>
              </div>
              <button
                onClick={() => onNavigate(returnTarget === 'paused' ? 'playing' : 'main_menu')}
                className="rounded-lg border border-white/15 bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
              >
                Back
              </button>
            </div>

            {hud.activeMissionId && (
              <div className="flex items-center justify-between rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2.5">
                <span className="text-xs font-semibold text-amber-300">
                  Active: {hud.activeMissionTitle}
                </span>
                <button
                  onClick={onCancelMission}
                  className="rounded bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-zinc-700"
                >
                  Abandon Mission
                </button>
              </div>
            )}

            <div className="space-y-2.5">
              {STORY_MISSIONS.map((m) => {
                const done = hud.completedMissions.includes(m.id);
                const active = hud.activeMissionId === m.id;
                return (
                  <div
                    key={m.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-white/10 bg-zinc-950/70 p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-hud text-xs font-bold text-amber-400">
                          MISSION {m.number}
                        </span>
                        <span className="text-zinc-600">·</span>
                        <h3 className="font-display text-base font-bold text-white">{m.title}</h3>
                        {done && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{m.description}</p>
                      <p className="font-mono-hud text-xs font-semibold text-emerald-400">
                        Reward: ${m.rewardMoney.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => onStartMission(m.id)}
                      className={`shrink-0 rounded-lg px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-cyan-500 text-zinc-950'
                          : 'bg-amber-400 text-zinc-950 hover:bg-amber-300'
                      }`}
                    >
                      {active ? 'Restart' : done ? 'Replay' : 'Start Mission'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* INVENTORY & EQUIPMENT MENU */}
        {screen === 'inventory' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">Inventory & Equipment</h2>
                <p className="text-xs text-zinc-400">
                  Health {hud.health}% · Armor {hud.armor}% · Collectibles {hud.collectiblesFound}/{hud.totalCollectibles} · Landmarks {hud.discoveredLocations.length}/12
                </p>
              </div>
              <button
                onClick={() => onNavigate('playing')}
                className="rounded-lg border border-white/15 bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
              >
                Close [I]
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {inventory.map((item) => {
                const isEquipped = item.gadgetId && item.gadgetId === hud.equippedGadget;
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between rounded-lg border p-3.5 ${
                      isEquipped
                        ? 'border-amber-400/50 bg-amber-500/10'
                        : 'border-white/10 bg-zinc-950/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-white">{item.name}</h3>
                        <span className="font-mono-hud text-xs text-zinc-400">
                          {item.ammo !== undefined
                            ? `${item.ammo}/${item.maxAmmo} CHG`
                            : item.gadgetId
                              ? 'GADGET'
                              : `x${item.quantity}`}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{item.description}</p>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => onUseInventoryItem(item.id)}
                        disabled={!item.gadgetId && item.quantity <= 0}
                        className={`rounded px-3 py-1.5 text-xs font-bold transition-colors ${
                          isEquipped
                            ? 'bg-amber-400 text-zinc-950'
                            : !item.gadgetId && item.quantity <= 0
                              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                              : 'bg-zinc-800 text-white hover:bg-zinc-700'
                        }`}
                      >
                        {item.gadgetId ? (isEquipped ? 'Equipped' : 'Equip') : 'Use Item'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SETTINGS MENU */}
        {screen === 'settings' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="font-display text-2xl font-bold text-white">Game Settings</h2>
              <button
                onClick={() => onNavigate(returnTarget)}
                className="rounded-lg border border-white/15 bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
              >
                Back
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">Dynamic Shadows</p>
                  <p className="text-xs text-zinc-400">Real-time directional sunlight shadows</p>
                </div>
                <button
                  onClick={() => onUpdateSettings({ ...settings, shadows: !settings.shadows })}
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold ${
                    settings.shadows ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {settings.shadows ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">Traffic Density</p>
                  <p className="text-xs text-zinc-400">Number of AI vehicles roaming the city</p>
                </div>
                <div className="flex gap-1 bg-zinc-950 p-1 rounded-lg border border-white/10">
                  {(['low', 'medium', 'high'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => onUpdateSettings({ ...settings, trafficDensity: d })}
                      className={`px-3 py-1 rounded text-xs font-semibold capitalize ${
                        settings.trafficDensity === d ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">Day-Night Cycle Speed</p>
                  <p className="text-xs text-zinc-400">Control time progression speed</p>
                </div>
                <div className="flex gap-1 bg-zinc-950 p-1 rounded-lg border border-white/10">
                  {[
                    { label: 'Freeze', val: 0 },
                    { label: '1x', val: 1 },
                    { label: '3x', val: 3 },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => onUpdateSettings({ ...settings, dayNightSpeed: opt.val })}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        settings.dayNightSpeed === opt.val ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-white">Weather Condition</p>
                  <p className="text-xs text-zinc-400">Dynamic auto-cycle or lock specific weather</p>
                </div>
                <div className="flex flex-wrap gap-1 bg-zinc-950 p-1 rounded-lg border border-white/10">
                  {(['auto', 'sunny', 'cloudy', 'rain', 'thunderstorm', 'fog'] as Array<'auto' | WeatherType>).map(
                    (w) => (
                      <button
                        key={w}
                        onClick={() => onUpdateSettings({ ...settings, weatherMode: w })}
                        className={`px-2.5 py-1 rounded text-xs font-semibold capitalize ${
                          settings.weatherMode === w ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400'
                        }`}
                      >
                        {w}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">Touch Controls Overlay</p>
                  <p className="text-xs text-zinc-400">Virtual joystick & buttons for mobile</p>
                </div>
                <div className="flex gap-1 bg-zinc-950 p-1 rounded-lg border border-white/10">
                  {(['auto', 'on', 'off'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => onUpdateSettings({ ...settings, mobileControls: m })}
                      className={`px-3 py-1 rounded text-xs font-semibold uppercase ${
                        settings.mobileControls === m ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-white">Camera Sensitivity</span>
                  <span className="font-mono-hud text-xs text-amber-400">
                    {settings.cameraSensitivity.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={2.0}
                  step={0.1}
                  value={settings.cameraSensitivity}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, cameraSensitivity: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* CONTROLS REFERENCE */}
        {screen === 'controls' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="font-display text-2xl font-bold text-white">Controls</h2>
              <button
                onClick={() => onNavigate(returnTarget)}
                className="rounded-lg border border-white/15 bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
              >
                Back
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-4 space-y-2">
                <h3 className="font-display text-sm font-bold text-amber-400 uppercase">On Foot (Desktop)</h3>
                <div className="flex justify-between"><span className="text-zinc-400">Move</span><span className="font-mono-hud text-white">W A S D</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Sprint</span><span className="font-mono-hud text-white">SHIFT</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Jump</span><span className="font-mono-hud text-white">SPACE</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Crouch</span><span className="font-mono-hud text-white">C</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Enter Vehicle</span><span className="font-mono-hud text-white">E</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Interact / Mission</span><span className="font-mono-hud text-white">F</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Gadget / Action</span><span className="font-mono-hud text-white">R / 1-4</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Camera Rotate</span><span className="font-mono-hud text-white">Mouse Drag + Scroll</span></div>
              </div>

              <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-4 space-y-2">
                <h3 className="font-display text-sm font-bold text-cyan-400 uppercase">Driving (Desktop)</h3>
                <div className="flex justify-between"><span className="text-zinc-400">Accelerate</span><span className="font-mono-hud text-white">W</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Brake / Reverse</span><span className="font-mono-hud text-white">S</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Steer Left / Right</span><span className="font-mono-hud text-white">A / D</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Handbrake / Drift</span><span className="font-mono-hud text-white">SPACE</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Exit Vehicle</span><span className="font-mono-hud text-white">E</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Headlights</span><span className="font-mono-hud text-white">L</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Horn</span><span className="font-mono-hud text-white">H</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Inventory / Missions</span><span className="font-mono-hud text-white">I / M / ESC</span></div>
              </div>
            </div>
          </div>
        )}

        {/* SOUND SETTINGS */}
        {screen === 'sound' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="font-display text-2xl font-bold text-white">Sound Settings</h2>
              <button
                onClick={() => onNavigate(returnTarget)}
                className="rounded-lg border border-white/15 bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
              >
                Back
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Audio Output</span>
                <button
                  onClick={() => onUpdateSound({ ...soundSettings, muted: !soundSettings.muted })}
                  className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold ${
                    soundSettings.muted ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-zinc-950'
                  }`}
                >
                  {soundSettings.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  {soundSettings.muted ? 'Muted' : 'Active'}
                </button>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-zinc-200">Master Volume</span>
                  <span className="font-mono-hud text-xs text-amber-400">
                    {Math.round(soundSettings.masterVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={soundSettings.masterVolume}
                  onChange={(e) =>
                    onUpdateSound({ ...soundSettings, masterVolume: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-zinc-200">Vehicles, Sirens & Effects</span>
                  <span className="font-mono-hud text-xs text-amber-400">
                    {Math.round(soundSettings.sfxVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={soundSettings.sfxVolume}
                  onChange={(e) =>
                    onUpdateSound({ ...soundSettings, sfxVolume: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-zinc-200">Weather & City Ambience</span>
                  <span className="font-mono-hud text-xs text-amber-400">
                    {Math.round(soundSettings.ambientVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={soundSettings.ambientVolume}
                  onChange={(e) =>
                    onUpdateSound({ ...soundSettings, ambientVolume: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* MISSION COMPLETE */}
        {screen === 'mission_complete' && missionResult && (
          <div className="text-center space-y-5 py-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
              <Trophy className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Mission Passed</p>
              <h2 className="mt-1 font-display text-3xl font-bold text-white">{missionResult.title}</h2>
            </div>
            <div className="flex items-center justify-center gap-8 border-y border-white/10 py-4">
              <div>
                <p className="text-xs text-zinc-400">Cash Reward</p>
                <p className="font-mono-hud text-2xl font-bold text-emerald-400">
                  +${missionResult.rewardMoney.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Completion Time</p>
                <p className="font-mono-hud text-2xl font-bold text-white">{missionResult.timeTakenSec}s</p>
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={onResume}
                className="rounded-lg bg-amber-400 px-6 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-300"
              >
                Continue Exploring
              </button>
              <button
                onClick={() => onNavigate('missions')}
                className="rounded-lg border border-white/15 bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
              >
                Next Mission
              </button>
            </div>
          </div>
        )}

        {/* GAME OVER */}
        {screen === 'game_over' && (
          <div className="text-center space-y-5 py-4">
            <p className="font-display text-4xl font-bold text-rose-500 tracking-wide">
              {gameOverReason || 'BUSTED'}
            </p>
            <p className="text-sm text-zinc-300">
              You were incapacitated during city operations. Respawn at City General Hospital or restart your run.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={onRespawn}
                className="rounded-lg bg-amber-400 px-6 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-300"
              >
                Respawn (-$250)
              </button>
              <button
                onClick={onRestart}
                className="rounded-lg border border-white/15 bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
              >
                Restart Game
              </button>
              <button
                onClick={onMainMenu}
                className="rounded-lg border border-white/15 bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-700"
              >
                Main Menu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
