import { useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { MenuModals } from './components/MenuModals';
import { MobileControls } from './components/MobileControls';
import { CityGameEngine } from './game/engine';
import { createDefaultInventory } from './game/inventory';
import {
  loadGameSettings,
  loadSaveData,
  loadSoundSettings,
  saveGameSettings,
  saveSoundSettings,
} from './game/saveSystem';
import type {
  GameScreen,
  GameSettings,
  HudState,
  InventoryItem,
  MissionResult,
  SaveData,
  SoundSettings,
} from './game/types';

const INITIAL_HUD: HudState = {
  health: 100,
  maxHealth: 100,
  armor: 50,
  maxArmor: 100,
  money: 1200,
  wantedLevel: 0,
  wantedSearching: false,
  wantedCooldownPct: 0,
  timeOfDay: 10.5,
  weather: 'sunny',
  districtName: 'Downtown',
  inVehicle: false,
  vehicleName: '',
  vehicleCategory: null,
  speedKmh: 0,
  vehicleCondition: 100,
  headlightsOn: false,
  equippedGadget: 'fist',
  gadgetAmmo: { fist: 0, emp_stunner: 6, signal_jammer: 3, turbo_dash: 4 },
  activeMissionId: null,
  activeMissionTitle: null,
  activeObjectiveText: null,
  missionTimerSec: null,
  missionProgressText: null,
  interactPrompt: null,
  notificationText: null,
  completedMissions: [],
  discoveredLocations: [],
  collectiblesFound: 0,
  totalCollectibles: 6,
  playerX: -16,
  playerY: 0,
  playerZ: 54,
  playerYaw: 0,
  minimapBlips: [],
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CityGameEngine | null>(null);

  const [screen, setScreen] = useState<GameScreen>('main_menu');
  const [returnTarget, setReturnTarget] = useState<'main_menu' | 'paused'>('main_menu');
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [inventory, setInventory] = useState<InventoryItem[]>(() => createDefaultInventory());
  const [settings, setSettings] = useState<GameSettings>(() => loadGameSettings());
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => loadSoundSettings());
  const [savedGame, setSavedGame] = useState<SaveData | null>(() => loadSaveData());
  const [missionResult, setMissionResult] = useState<MissionResult | null>(null);
  const [gameOverReason, setGameOverReason] = useState<string>('BUSTED');
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const screenRef = useRef<GameScreen>('main_menu');
  screenRef.current = screen;

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const initialSave = loadSaveData();
    const engine = new CityGameEngine(
      container,
      loadGameSettings(),
      loadSoundSettings(),
      initialSave,
      {
        onHudUpdate: (nextHud) => setHud(nextHud),
        onMissionComplete: (res) => {
          setMissionResult(res);
          setReturnTarget('paused');
          setScreen('mission_complete');
          engine.setPaused(true);
        },
        onGameOver: (reason) => {
          setGameOverReason(reason);
          setScreen('game_over');
        },
        onPauseRequested: () => {
          const cur = screenRef.current;
          if (cur === 'playing') {
            engine.setPaused(true);
            setReturnTarget('paused');
            setScreen('paused');
          } else if (cur !== 'main_menu' && cur !== 'game_over') {
            engine.setPaused(false);
            setScreen('playing');
          }
        },
        onToggleMissions: () => {
          const cur = screenRef.current;
          if (cur === 'playing') {
            engine.setPaused(true);
            setReturnTarget('paused');
            setScreen('missions');
          } else if (cur === 'missions') {
            engine.setPaused(false);
            setScreen('playing');
          }
        },
        onToggleInventory: () => {
          const cur = screenRef.current;
          if (cur === 'playing') {
            setInventory(engine.getInventorySnapshot());
            engine.setPaused(true);
            setReturnTarget('paused');
            setScreen('inventory');
          } else if (cur === 'inventory') {
            engine.setPaused(false);
            setScreen('playing');
          }
        },
      }
    );

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleNewGame = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.startNewGame();
    setReturnTarget('paused');
    setScreen('playing');
  };

  const handleContinue = () => {
    const eng = engineRef.current;
    if (!eng || !savedGame) return;
    eng.continueGame(savedGame);
    setReturnTarget('paused');
    setScreen('playing');
  };

  const handleResume = () => {
    engineRef.current?.setPaused(false);
    setScreen('playing');
  };

  const handleSaveGame = () => {
    engineRef.current?.saveCurrentProgress();
    setSavedGame(loadSaveData());
    engineRef.current?.setPaused(false);
    setScreen('playing');
  };

  const handleMainMenu = () => {
    engineRef.current?.returnToMainMenu();
    setSavedGame(loadSaveData());
    setReturnTarget('main_menu');
    setScreen('main_menu');
  };

  const handleStartMission = (missionId: string) => {
    const eng = engineRef.current;
    if (!eng) return;
    if (returnTarget === 'main_menu') {
      if (savedGame) eng.continueGame(savedGame);
      else eng.startNewGame();
    }
    eng.startMission(missionId);
    eng.setPaused(false);
    setReturnTarget('paused');
    setScreen('playing');
  };

  const handleNavigate = (next: GameScreen) => {
    if (next === 'inventory' && engineRef.current) {
      setInventory(engineRef.current.getInventorySnapshot());
    }
    if (next === 'playing') {
      engineRef.current?.setPaused(false);
    }
    setScreen(next);
  };

  const showMobileOverlay =
    screen === 'playing' &&
    (settings.mobileControls === 'on' || (settings.mobileControls === 'auto' && isTouchDevice));

  return (
    <div className="relative w-full h-full overflow-hidden bg-zinc-950">
      {/* Isolated WebGL Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Active Gameplay HUD */}
      {screen === 'playing' && (
        <GameHud
          hud={hud}
          onOpenMissions={() => {
            engineRef.current?.setPaused(true);
            setReturnTarget('paused');
            setScreen('missions');
          }}
          onOpenInventory={() => {
            if (engineRef.current) setInventory(engineRef.current.getInventorySnapshot());
            engineRef.current?.setPaused(true);
            setReturnTarget('paused');
            setScreen('inventory');
          }}
          onPause={() => {
            engineRef.current?.setPaused(true);
            setReturnTarget('paused');
            setScreen('paused');
          }}
          onEquipGadget={(id) => engineRef.current?.equipGadget(id)}
          onUseGadget={() => engineRef.current?.triggerGadgetAction()}
        />
      )}

      {/* Mobile Touch Controls */}
      {showMobileOverlay && (
        <MobileControls
          inVehicle={hud.inVehicle}
          onInput={(partial) => engineRef.current?.setMobileInput(partial)}
          onEnterExit={() => engineRef.current?.triggerEnterExitVehicle()}
          onInteract={() => engineRef.current?.triggerInteract()}
          onGadget={() => engineRef.current?.triggerGadgetAction()}
        />
      )}

      {/* Menus & Modals */}
      <MenuModals
        screen={screen}
        returnTarget={returnTarget}
        hasSave={Boolean(savedGame)}
        hud={hud}
        inventory={inventory}
        settings={settings}
        soundSettings={soundSettings}
        missionResult={missionResult}
        gameOverReason={gameOverReason}
        onNavigate={handleNavigate}
        onNewGame={handleNewGame}
        onContinue={handleContinue}
        onResume={handleResume}
        onSaveGame={handleSaveGame}
        onRestart={handleNewGame}
        onRespawn={() => {
          engineRef.current?.respawnPlayer();
          setScreen('playing');
        }}
        onMainMenu={handleMainMenu}
        onStartMission={handleStartMission}
        onCancelMission={() => {
          engineRef.current?.cancelActiveMission();
          engineRef.current?.setPaused(false);
          setScreen('playing');
        }}
        onUseInventoryItem={(itemId) => {
          engineRef.current?.useInventoryItem(itemId);
          if (engineRef.current) setInventory(engineRef.current.getInventorySnapshot());
        }}
        onUpdateSettings={(next) => {
          setSettings(next);
          saveGameSettings(next);
          engineRef.current?.updateSettings(next);
        }}
        onUpdateSound={(next) => {
          setSoundSettings(next);
          saveSoundSettings(next);
          engineRef.current?.updateSoundSettings(next);
        }}
      />
    </div>
  );
}
