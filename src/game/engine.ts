import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AudioManager } from './audio';
import { buildCity, ROAD_COORDS, type CityBuildResult } from './cityBuilder';
import { createDefaultInventory } from './inventory';
import { EXPLORE_TARGETS, RACE_CHECKPOINTS, STORY_MISSIONS } from './missions';
import {
  createCharacterModel,
  createCollectibleMesh,
  createMissionBeacon,
  createVehicleModel,
  VEHICLE_SPECS,
  type ArticulatedCharacter,
  type VehicleVisual,
} from './models';
import { createFreshSaveData, writeSaveData } from './saveSystem';
import { createProceduralTextures, type ProceduralTextureSet } from './textures';
import type {
  GameSettings,
  HudState,
  InventoryItem,
  MinimapBlip,
  MissionResult,
  MobileInputState,
  SaveData,
  SoundSettings,
  VehicleCategory,
  WeaponGadgetId,
  WeatherType,
} from './types';

interface VehicleEntity {
  id: string;
  category: VehicleCategory;
  visual: VehicleVisual;
  body: CANNON.Body;
  condition: number; // 0..100
  headlightsOn: boolean;
  speedKmh: number;
  steerAngle: number;
  isTraffic: boolean;
  isPolice: boolean;
  isRacer: boolean;
  trafficAxis: 'x' | 'z';
  trafficDir: 1 | -1;
  trafficLaneCoord: number;
  trafficTargetSpeed: number;
  empStunTimer: number;
  racerCheckpointIdx: number;
  racerLapFinished: boolean;
}

interface PedestrianEntity {
  model: ArticulatedCharacter;
  x: number;
  y: number;
  z: number;
  axis: 'x' | 'z';
  dir: 1 | -1;
  speed: number;
  walkPhase: number;
  fleeTimer: number;
  fleeVx: number;
  fleeVz: number;
}

interface CollectibleEntity {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  mesh: THREE.Group;
  collected: boolean;
}

interface EngineCallbacks {
  onHudUpdate: (hud: HudState) => void;
  onMissionComplete: (res: MissionResult) => void;
  onGameOver: (reason: string) => void;
  onPauseRequested: () => void;
  onToggleMissions: () => void;
  onToggleInventory: () => void;
}

// Reusable scratch math objects (zero GC in render loop)
const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _v3c = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _skyColor = new THREE.Color();
const _fogColor = new THREE.Color();
const _sunColor = new THREE.Color();

export class CityGameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private world!: CANNON.World;
  private isSoftwareGl = false;

  private textures!: ProceduralTextureSet;
  private city!: CityBuildResult;
  public audio = new AudioManager();

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private lightningLight!: THREE.AmbientLight;

  // Rain & Particles
  private rainPoints!: THREE.Points;
  private rainPositions!: Float32Array;
  private smokeParticles: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }> = [];
  private empRingMesh!: THREE.Mesh;
  private empRingTimer = 0;

  // Player
  private playerModel!: ArticulatedCharacter;
  private playerBody!: CANNON.Body;
  private playerYaw = 0;
  private playerWalkPhase = 0;
  private playerGrounded = true;
  private playerCrouching = false;
  private playerTurboTimer = 0;

  // Vehicles & NPCs
  private vehicles: VehicleEntity[] = [];
  private currentVehicle: VehicleEntity | null = null;
  private pedestrians: PedestrianEntity[] = [];
  private collectibles: CollectibleEntity[] = [];
  private missionBeacons: Map<string, THREE.Group> = new Map();
  private activeObjectiveBeacon!: THREE.Group;

  // Camera State
  private camYaw = 0;
  private camPitch = 0.34;
  private camDistance = 8.5;
  private isDraggingCamera = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Input State
  private keys: Record<string, boolean> = {};
  private mobileInput: MobileInputState = {
    moveX: 0,
    moveY: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    jump: false,
    sprint: false,
    handbrake: false,
  };

  // Game State
  private isPlaying = false;
  private isPaused = false;
  private settings: GameSettings;
  private saveData: SaveData;

  private health = 100;
  private maxHealth = 100;
  private armor = 50;
  private maxArmor = 100;
  private money = 1200;
  private wantedLevel = 0;
  private wantedSearching = false;
  private wantedEscapeTimer = 0;
  private bustedTimer = 0;

  private timeOfDay = 10.5;
  private weather: WeatherType = 'sunny';
  private weatherChangeTimer = 75;
  private lightningTimer = 6;

  private equippedGadget: WeaponGadgetId = 'fist';
  private inventory: InventoryItem[] = createDefaultInventory();
  private completedMissions: Set<string> = new Set();
  private discoveredLocations: Set<string> = new Set();
  private collectedIds: Set<string> = new Set();

  // Active Mission Runtime
  private activeMissionId: string | null = null;
  private activeMissionStep = 0;
  private activeMissionTimer: number | null = null;
  private activeMissionElapsed = 0;
  private exploreVisited: Set<number> = new Set();
  private raceCheckpointIdx = 0;

  // Traffic Light Phase
  private trafficPhaseTime = 0;
  private nsGreen = true;

  // Notifications
  private notificationText: string | null = null;
  private notificationTimer = 0;

  // Loop
  private clock = new THREE.Clock();
  private elapsedTotal = 0;
  private frameId = 0;
  private disposed = false;
  private lastHudEmit = 0;
  private lastAutoSave = 0;

  // Bound event listeners
  private onResizeBound = () => this.handleResize();
  private onKeyDownBound = (e: KeyboardEvent) => this.handleKeyDown(e);
  private onKeyUpBound = (e: KeyboardEvent) => this.handleKeyUp(e);
  private onPointerDownBound = (e: PointerEvent) => this.handlePointerDown(e);
  private onPointerMoveBound = (e: PointerEvent) => this.handlePointerMove(e);
  private onPointerUpBound = () => {
    this.isDraggingCamera = false;
  };
  private onWheelBound = (e: WheelEvent) => {
    if (!this.isPlaying || this.isPaused) return;
    this.camDistance = THREE.MathUtils.clamp(this.camDistance + e.deltaY * 0.008, 4.5, 16);
  };

  constructor(
    container: HTMLElement,
    initialSettings: GameSettings,
    initialSound: SoundSettings,
    initialSave: SaveData | null,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.settings = { ...initialSettings };
    this.callbacks = callbacks;
    this.saveData = initialSave ?? createFreshSaveData();
    this.audio.setSettings(initialSound);

    this.initRendererAndScene();
    this.initPhysics();
    this.initWorldContent();
    this.applySaveData(this.saveData);
    this.bindEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.startLoop();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initRendererAndScene() {
    this.isSoftwareGl = this.detectSoftwareGl();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7cc4fa);
    this.scene.fog = new THREE.FogExp2(0x9bd3fc, 0.0024);

    // Mandatory studio environment reflections for metallic cars & glass buildings
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(64, w / h, 0.25, 750);
    this.camera.position.set(0, 48, 85);

    // Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0xa5d8ff, 0x3b4252, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
    this.sunLight.position.set(90, 140, 70);
    this.sunLight.castShadow = !this.isSoftwareGl && this.settings.shadows;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 360;
    const d = 110;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.lightningLight = new THREE.AmbientLight(0xdbeafe, 0);
    this.scene.add(this.lightningLight);

    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
  }

  private initPhysics() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -24, 0),
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = false;
  }

  private initWorldContent() {
    this.city = buildCity(this.scene, this.world, this.textures, this.isSoftwareGl);

    // Player Character
    this.playerModel = createCharacterModel(0x1e293b, 0x0f172a, 0xd4a373, this.textures.contactShadow, true);
    this.scene.add(this.playerModel.group);

    const playerMat = new CANNON.Material('player');
    this.playerBody = new CANNON.Body({
      mass: 75,
      material: playerMat,
      fixedRotation: true,
      linearDamping: 0.15,
    });
    this.playerBody.addShape(new CANNON.Sphere(0.55), new CANNON.Vec3(0, 0.55, 0));
    this.playerBody.addShape(new CANNON.Sphere(0.45), new CANNON.Vec3(0, 1.35, 0));
    this.playerBody.position.set(-16, 0.2, 54);
    this.world.addBody(this.playerBody);

    // Spawn Parked Showcase Vehicles (All 7 Categories!)
    this.spawnParkedVehicle('sports', -16, 62, Math.PI, 0xe11d48);     // Near Dealership & Spawn
    this.spawnParkedVehicle('supercar', -36, 70, Math.PI / 2, 0xf59e0b); // Dealership Forecourt
    this.spawnParkedVehicle('suv', -24, 10, 0, 0x334155);              // Outside Shopping Mall
    this.spawnParkedVehicle('motorcycle', 20, 12, Math.PI / 2, 0x06b6d4); // Central Park Edge
    this.spawnParkedVehicle('police', -84, 12, 0, 0x111827);           // Outside Police HQ
    this.spawnParkedVehicle('truck', -105, 114, Math.PI / 2, 0xb45309); // Industrial Docks
    this.spawnParkedVehicle('bus', 0, -14, Math.PI / 2, 0x0284c7);     // Downtown Plaza Stop
    this.spawnParkedVehicle('supercar', 110, -160, 0, 0x10b981);       // Airport Tarmac Jet-side
    this.spawnParkedVehicle('sports', 94, -4.0, -90 * (Math.PI / 180) + Math.PI, 0x8b5cf6); // Underground Parking

    // Spawn Traffic Vehicles
    this.rebuildTrafficPool();

    // Spawn Pedestrians
    this.spawnPedestrians();

    // Spawn Collectibles
    for (const c of this.city.collectibleSpawns) {
      const mesh = createCollectibleMesh(c.color);
      mesh.position.set(c.x, c.y, c.z);
      this.scene.add(mesh);
      this.collectibles.push({ ...c, mesh, collected: false });
    }

    // Mission Start Beacons
    for (const m of STORY_MISSIONS) {
      const beacon = createMissionBeacon(0xf59e0b);
      beacon.position.set(m.startPos.x, m.startPos.y + 0.05, m.startPos.z);
      this.scene.add(beacon);
      this.missionBeacons.set(m.id, beacon);
    }

    // Active Objective Beacon
    this.activeObjectiveBeacon = createMissionBeacon(0x22d3ee);
    this.activeObjectiveBeacon.visible = false;
    this.scene.add(this.activeObjectiveBeacon);

    // EMP Pulse Ring visual
    this.empRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1.0, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    this.empRingMesh.rotation.x = -Math.PI / 2;
    this.empRingMesh.visible = false;
    this.scene.add(this.empRingMesh);

    // Rain Particle System
    const rainCount = 700;
    this.rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 90;
      this.rainPositions[i * 3 + 1] = Math.random() * 36;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0xcbd5e1,
      size: 0.22,
      transparent: true,
      opacity: 0.65,
    });
    this.rainPoints = new THREE.Points(rainGeo, rainMat);
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);
  }

  private createVehicleEntity(
    id: string,
    category: VehicleCategory,
    x: number,
    y: number,
    z: number,
    yaw: number,
    colorOverride?: number,
    opts?: { isTraffic?: boolean; isPolice?: boolean; isRacer?: boolean }
  ): VehicleEntity {
    const spec = VEHICLE_SPECS[category];
    const isHero = !opts?.isTraffic && !opts?.isPolice && !opts?.isRacer;
    const visual = createVehicleModel(category, colorOverride, this.textures.contactShadow, isHero);
    this.scene.add(visual.group);

    const body = new CANNON.Body({
      mass: spec.mass,
      linearDamping: 0.08,
      angularDamping: 0.92,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(spec.width * 0.48, spec.height * 0.45, spec.length * 0.48)));
    body.angularFactor.set(0, 1, 0);
    body.position.set(x, y + spec.height * 0.48, z);
    body.quaternion.setFromEuler(0, yaw, 0);
    this.world.addBody(body);

    const entity: VehicleEntity = {
      id,
      category,
      visual,
      body,
      condition: 100,
      headlightsOn: false,
      speedKmh: 0,
      steerAngle: 0,
      isTraffic: Boolean(opts?.isTraffic),
      isPolice: Boolean(opts?.isPolice),
      isRacer: Boolean(opts?.isRacer),
      trafficAxis: 'z',
      trafficDir: 1,
      trafficLaneCoord: 0,
      trafficTargetSpeed: 38,
      empStunTimer: 0,
      racerCheckpointIdx: 0,
      racerLapFinished: false,
    };

    body.addEventListener('collide', (ev: { contact: CANNON.ContactEquation }) => {
      const impact = Math.abs(ev.contact.getImpactVelocityAlongNormal());
      if (impact > 4.5 && entity === this.currentVehicle) {
        const dmg = Math.min(24, (impact - 4) * 1.35);
        entity.condition = Math.max(0, entity.condition - dmg);
        this.audio.playCollision(Math.min(1, impact / 22));
        if (impact > 12) {
          this.applyDamageToPlayer(dmg * 0.4);
          if (this.wantedLevel === 0 && Math.random() < 0.35) {
            this.raiseWanted(1, 'Reckless Collision Reported');
          }
        }
      }
    });

    this.vehicles.push(entity);
    return entity;
  }

  private spawnParkedVehicle(category: VehicleCategory, x: number, z: number, yaw: number, color?: number) {
    const y = this.city.groundHeightAt(x, z, 0);
    this.createVehicleEntity(`parked_${category}_${x}_${z}`, category, x, y, z, yaw, color);
  }

  private rebuildTrafficPool() {
    // Remove existing traffic vehicles
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v.isTraffic && v !== this.currentVehicle) {
        this.scene.remove(v.visual.group);
        this.world.removeBody(v.body);
        this.vehicles.splice(i, 1);
      }
    }

    const desiredCount =
      this.settings.trafficDensity === 'low' ? 8 : this.settings.trafficDensity === 'high' ? 20 : 14;

    const cats: VehicleCategory[] = ['sports', 'suv', 'truck', 'bus', 'motorcycle', 'supercar'];
    const colors = [0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b, 0x64748b, 0xf43f5e, 0xe2e8f0, 0x8b5cf6];
    const roadChoices = [-120, -60, 0, 60, 120];

    for (let i = 0; i < desiredCount; i++) {
      const axis: 'x' | 'z' = i % 2 === 0 ? 'z' : 'x';
      const dir: 1 | -1 = i % 4 < 2 ? 1 : -1;
      const road = roadChoices[i % roadChoices.length];
      const laneOffset = dir === 1 ? 3.2 : -3.2;
      const along = -140 + ((i * 53) % 280);
      const x = axis === 'z' ? road + laneOffset : along;
      const z = axis === 'z' ? along : road + laneOffset;
      const yaw =
        axis === 'z' ? (dir === 1 ? 0 : Math.PI) : dir === 1 ? Math.PI / 2 : -Math.PI / 2;

      const cat = cats[i % cats.length];
      const v = this.createVehicleEntity(
        `traffic_${i}`,
        cat,
        x,
        0,
        z,
        yaw,
        colors[i % colors.length],
        { isTraffic: true }
      );
      v.trafficAxis = axis;
      v.trafficDir = dir;
      v.trafficLaneCoord = road + laneOffset;
      v.trafficTargetSpeed = cat === 'bus' || cat === 'truck' ? 28 : 38 + (i % 3) * 6;
    }
  }

  private spawnPedestrians() {
    const jacketColors = [0x2563eb, 0xdc2626, 0x059669, 0xd97706, 0x7c3aed, 0x334155, 0xdb2777];
    const pantsColors = [0x1e293b, 0x3f3f46, 0x27272a, 0x1d4ed8];
    const skinColors = [0xd4a373, 0x8d5524, 0xf1c27d, 0xc68642];

    const sidewalkRoads = [-60, 0, 60, 120];
    for (let i = 0; i < 24; i++) {
      const axis: 'x' | 'z' = i % 2 === 0 ? 'z' : 'x';
      const dir: 1 | -1 = i % 4 < 2 ? 1 : -1;
      const road = sidewalkRoads[i % sidewalkRoads.length];
      const sideOffset = (i % 2 === 0 ? 1 : -1) * 9.0;
      const along = -150 + ((i * 39) % 300);
      const x = axis === 'z' ? road + sideOffset : along;
      const z = axis === 'z' ? along : road + sideOffset;

      const model = createCharacterModel(
        jacketColors[i % jacketColors.length],
        pantsColors[i % pantsColors.length],
        skinColors[i % skinColors.length],
        this.textures.contactShadow,
        false
      );
      model.group.position.set(x, 0.15, z);
      this.scene.add(model.group);
      this.pedestrians.push({
        model,
        x,
        y: 0.15,
        z,
        axis,
        dir,
        speed: 2.1 + (i % 3) * 0.45,
        walkPhase: i * 0.9,
        fleeTimer: 0,
        fleeVx: 0,
        fleeVz: 0,
      });
    }
  }

  // ======================== PUBLIC LIFECYCLE & MENU CONTROLS ========================

  public startNewGame() {
    this.audio.unlock();
    const fresh = createFreshSaveData();
    this.applySaveData(fresh);
    this.wantedLevel = 0;
    this.wantedSearching = false;
    this.activeMissionId = null;
    this.activeObjectiveBeacon.visible = false;
    this.clearPoliceAndRacers();
    this.isPlaying = true;
    this.isPaused = false;
    this.showNotification('Welcome to City Crime. Press [E] near any vehicle or [M] for Missions.');
    this.emitHud();
  }

  public continueGame(save: SaveData) {
    this.audio.unlock();
    this.applySaveData(save);
    this.wantedLevel = 0;
    this.wantedSearching = false;
    this.isPlaying = true;
    this.isPaused = false;
    this.showNotification('Progress Loaded');
    this.emitHud();
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  public returnToMainMenu() {
    this.saveCurrentProgress();
    this.isPlaying = false;
    this.isPaused = false;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  public updateSettings(next: GameSettings) {
    const densityChanged = next.trafficDensity !== this.settings.trafficDensity;
    this.settings = { ...next };
    const allowShadows = !this.isSoftwareGl && next.shadows;
    this.renderer.shadowMap.enabled = allowShadows;
    this.sunLight.castShadow = allowShadows;
    if (next.weatherMode !== 'auto') {
      this.setWeather(next.weatherMode);
    }
    if (densityChanged) {
      this.rebuildTrafficPool();
    }
  }

  public updateSoundSettings(next: SoundSettings) {
    this.audio.setSettings(next);
  }

  public setMobileInput(partial: Partial<MobileInputState>) {
    Object.assign(this.mobileInput, partial);
  }

  public triggerEnterExitVehicle() {
    if (!this.isPlaying || this.isPaused) return;
    if (this.currentVehicle) {
      this.exitCurrentVehicle();
    } else {
      this.tryEnterNearestVehicle();
    }
  }

  public triggerInteract() {
    if (!this.isPlaying || this.isPaused) return;
    const pPos = this.getPlayerWorldPos();

    // Check mission start beacons
    if (!this.activeMissionId) {
      for (const m of STORY_MISSIONS) {
        if (this.completedMissions.has(m.id)) continue;
        const dist = Math.hypot(pPos.x - m.startPos.x, pPos.z - m.startPos.z);
        if (dist < 6.5) {
          this.startMission(m.id);
          return;
        }
      }
    }

    // Check Hospital Heal
    if (Math.hypot(pPos.x - 90, pPos.z - -12) < 9 && this.money >= 100) {
      this.money -= 100;
      this.health = this.maxHealth;
      this.audio.playPickup();
      this.showNotification('Hospital Treatment: Health 100% (-$100)');
      return;
    }

    // Check Repair Garage or Gas Station
    const nearGarage = Math.hypot(pPos.x - -16, pPos.z - 76) < 9;
    const nearGas = Math.hypot(pPos.x - 90, pPos.z - 20) < 9;
    if ((nearGarage || nearGas) && this.currentVehicle) {
      this.currentVehicle.condition = 100;
      this.audio.playPickup();
      this.showNotification(nearGarage ? 'Garage Service: Vehicle Repaired 100%' : 'Refueled & Boosted!');
      return;
    }
  }

  public triggerGadgetAction() {
    if (!this.isPlaying || this.isPaused) return;
    this.audio.unlock();

    if (this.equippedGadget === 'emp_stunner') {
      const item = this.inventory.find((i) => i.gadgetId === 'emp_stunner');
      if (!item || (item.ammo ?? 0) <= 0) {
        this.showNotification('EMP Stunner out of charges!');
        return;
      }
      item.ammo = (item.ammo ?? 1) - 1;
      this.audio.playEmpPulse();
      const pos = this.getPlayerWorldPos();
      this.empRingMesh.position.set(pos.x, pos.y + 0.35, pos.z);
      this.empRingMesh.scale.setScalar(1);
      this.empRingMesh.visible = true;
      this.empRingTimer = 0.65;

      let stunnedCount = 0;
      for (const v of this.vehicles) {
        if (v === this.currentVehicle) continue;
        const d = Math.hypot(v.body.position.x - pos.x, v.body.position.z - pos.z);
        if (d < 28) {
          v.empStunTimer = 6.5;
          stunnedCount++;
        }
      }
      if (this.wantedLevel === 0 && stunnedCount > 0) {
        this.raiseWanted(1, 'EMP Disturbance Detected');
      }
      this.showNotification(`EMP Pulse Fired (${stunnedCount} vehicles disabled)`);
    } else if (this.equippedGadget === 'signal_jammer') {
      const item = this.inventory.find((i) => i.gadgetId === 'signal_jammer');
      if (!item || (item.ammo ?? 0) <= 0) {
        this.showNotification('Signal Jammer out of charges!');
        return;
      }
      item.ammo = (item.ammo ?? 1) - 1;
      this.audio.playEmpPulse();
      if (this.wantedLevel > 0) {
        this.wantedSearching = true;
        this.wantedEscapeTimer += 6.5;
        this.showNotification('Police Radar Jammed!');
      } else {
        this.showNotification('Signal Jammer Activated');
      }
    } else if (this.equippedGadget === 'turbo_dash') {
      const item = this.inventory.find((i) => i.gadgetId === 'turbo_dash');
      if (!item || (item.ammo ?? 0) <= 0) {
        this.showNotification('Nitro Capacitor empty!');
        return;
      }
      item.ammo = (item.ammo ?? 1) - 1;
      this.playerTurboTimer = 3.5;
      this.audio.playPickup();
      if (this.currentVehicle) {
        const fwd = new CANNON.Vec3(0, 0, 1);
        this.currentVehicle.body.quaternion.vmult(fwd, fwd);
        this.currentVehicle.body.velocity.x += fwd.x * 16;
        this.currentVehicle.body.velocity.z += fwd.z * 16;
      }
      this.showNotification('Nitro Surge Engaged!');
    }
  }

  public equipGadget(id: WeaponGadgetId) {
    this.equippedGadget = id;
    this.emitHud();
  }

  public useInventoryItem(itemId: string) {
    const item = this.inventory.find((i) => i.id === itemId);
    if (!item) return;

    if (item.gadgetId) {
      this.equippedGadget = item.gadgetId;
      this.showNotification(`Equipped: ${item.name}`);
      this.emitHud();
      return;
    }

    if (item.quantity <= 0) return;

    if (item.id === 'item_medkit') {
      if (this.health >= this.maxHealth) return;
      item.quantity--;
      this.health = Math.min(this.maxHealth, this.health + 50);
      this.audio.playPickup();
      this.showNotification('Used First-Aid Kit (+50 Health)');
    } else if (item.id === 'item_armor') {
      if (this.armor >= this.maxArmor) return;
      item.quantity--;
      this.armor = Math.min(this.maxArmor, this.armor + 50);
      this.audio.playPickup();
      this.showNotification('Equipped Tactical Armor (+50 Armor)');
    } else if (item.id === 'item_repair') {
      if (!this.currentVehicle) {
        this.showNotification('Enter a vehicle to repair it.');
        return;
      }
      item.quantity--;
      this.currentVehicle.condition = 100;
      this.audio.playPickup();
      this.showNotification('Vehicle Condition Restored to 100%');
    }
    this.emitHud();
  }

  public startMission(missionId: string) {
    const def = STORY_MISSIONS.find((m) => m.id === missionId);
    if (!def) return;

    this.clearPoliceAndRacers();
    this.activeMissionId = def.id;
    this.activeMissionStep = 0;
    this.activeMissionElapsed = 0;
    this.activeMissionTimer = def.timeLimitSec ?? null;
    this.exploreVisited.clear();
    this.raceCheckpointIdx = 0;

    if (def.id === 'mission_1_first_drive') {
      // Teleport player near Dealership if far away so starting from menu is effortless
      const p = this.getPlayerWorldPos();
      if (Math.hypot(p.x - def.startPos.x, p.z - def.startPos.z) > 80 && !this.currentVehicle) {
        this.playerBody.position.set(-16, 0.3, 56);
        this.playerBody.velocity.setZero();
      }
      this.showNotification('Mission 1: Find & enter a Sports Car, then drive to Downtown Plaza!');
    } else if (def.id === 'mission_2_city_delivery') {
      this.showNotification('Mission 2: Grab the briefcase at Metro Mall & reach the Airport!');
    } else if (def.id === 'mission_3_police_chase') {
      if (!this.currentVehicle) {
        const car = this.createVehicleEntity('m3_getaway', 'sports', -78, 0.2, 10, Math.PI / 2, 0x22d3ee);
        this.enterVehicle(car);
      }
      this.raiseWanted(3, 'LCPD Pursuit Initiated!');
      this.showNotification('Mission 3: Outrun LCPD & reach Industrial Docks Safehouse!');
    } else if (def.id === 'mission_4_street_race') {
      // Line up player + 3 AI racers on Coastal Highway start grid (60, 0, 120 facing -Z)
      if (!this.currentVehicle) {
        const car = this.createVehicleEntity('m4_player', 'supercar', 57, 0.2, 120, Math.PI, 0xf59e0b);
        this.enterVehicle(car);
      } else {
        this.currentVehicle.body.position.set(57, 0.6, 120);
        this.currentVehicle.body.velocity.setZero();
        this.currentVehicle.body.quaternion.setFromEuler(0, Math.PI, 0);
      }
      const rivalSpecs: Array<{ cat: VehicleCategory; color: number; xOff: number; zOff: number }> = [
        { cat: 'supercar', color: 0xe11d48, xOff: 63, zOff: 120 },
        { cat: 'sports', color: 0x3b82f6, xOff: 57, zOff: 128 },
        { cat: 'sports', color: 0x10b981, xOff: 63, zOff: 128 },
      ];
      rivalSpecs.forEach((r, idx) => {
        const rv = this.createVehicleEntity(`racer_${idx}`, r.cat, r.xOff, 0.2, r.zOff, Math.PI, r.color, {
          isRacer: true,
        });
        rv.racerCheckpointIdx = 0;
      });
      this.showNotification('Mission 4: Street Race Started! Hit all 6 Checkpoints!');
    } else if (def.id === 'mission_5_city_exploration') {
      this.showNotification('Mission 5: Visit all 4 iconic landmarks across the city!');
    }

    this.updateObjectiveBeacon();
    this.emitHud();
  }

  public cancelActiveMission() {
    this.activeMissionId = null;
    this.activeMissionTimer = null;
    this.activeObjectiveBeacon.visible = false;
    this.clearRacersOnly();
    this.emitHud();
  }

  public saveCurrentProgress() {
    const pos = this.getPlayerWorldPos();
    const data: SaveData = {
      money: this.money,
      health: this.health,
      armor: this.armor,
      playerPos: { x: pos.x, y: Math.max(0.2, pos.y), z: pos.z },
      completedMissions: Array.from(this.completedMissions),
      discoveredLocations: Array.from(this.discoveredLocations),
      collectedIds: Array.from(this.collectedIds),
      inventory: this.inventory,
      timeOfDay: this.timeOfDay,
      savedAt: Date.now(),
    };
    this.saveData = data;
    writeSaveData(data);
  }

  private applySaveData(data: SaveData) {
    this.money = data.money;
    this.health = data.health;
    this.armor = data.armor;
    this.timeOfDay = data.timeOfDay ?? 10.5;
    this.completedMissions = new Set(data.completedMissions ?? []);
    this.discoveredLocations = new Set(data.discoveredLocations ?? []);
    this.collectedIds = new Set(data.collectedIds ?? []);
    this.inventory = data.inventory?.length ? data.inventory : createDefaultInventory();

    if (this.currentVehicle) {
      this.exitCurrentVehicle();
    }
    this.playerBody.position.set(data.playerPos.x, data.playerPos.y + 0.3, data.playerPos.z);
    this.playerBody.velocity.setZero();

    for (const c of this.collectibles) {
      c.collected = this.collectedIds.has(c.id);
      c.mesh.visible = !c.collected;
    }
  }

  // ======================== INPUT & EVENTS ========================

  private bindEvents() {
    window.addEventListener('resize', this.onResizeBound);
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDownBound);
    window.addEventListener('pointermove', this.onPointerMoveBound);
    window.addEventListener('pointerup', this.onPointerUpBound);
    this.renderer.domElement.addEventListener('wheel', this.onWheelBound, { passive: true });
  }

  private handleResize() {
    if (!this.container) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private handleKeyDown(e: KeyboardEvent) {
    this.keys[e.code] = true;
    if (!this.isPlaying) return;

    if (e.code === 'Escape') {
      this.callbacks.onPauseRequested();
      return;
    }
    if (e.code === 'KeyM') {
      this.callbacks.onToggleMissions();
      return;
    }
    if (e.code === 'KeyI') {
      this.callbacks.onToggleInventory();
      return;
    }
    if (this.isPaused) return;

    this.audio.unlock();

    if (e.code === 'KeyE') {
      this.triggerEnterExitVehicle();
    } else if (e.code === 'KeyF') {
      this.triggerInteract();
    } else if (e.code === 'KeyC' && !this.currentVehicle) {
      this.playerCrouching = !this.playerCrouching;
    } else if (e.code === 'KeyL' && this.currentVehicle) {
      this.currentVehicle.headlightsOn = !this.currentVehicle.headlightsOn;
    } else if (e.code === 'KeyH' && this.currentVehicle) {
      this.audio.playHorn();
      // Nearby pedestrians look/scatter slightly on horn
      const pos = this.getPlayerWorldPos();
      for (const ped of this.pedestrians) {
        if (Math.hypot(ped.x - pos.x, ped.z - pos.z) < 16) {
          ped.fleeTimer = 2.0;
          const ang = Math.atan2(ped.z - pos.z, ped.x - pos.x);
          ped.fleeVx = Math.cos(ang) * 5.2;
          ped.fleeVz = Math.sin(ang) * 5.2;
        }
      }
    } else if (e.code === 'KeyR') {
      this.triggerGadgetAction();
    } else if (e.code === 'Digit1') {
      this.equipGadget('fist');
    } else if (e.code === 'Digit2') {
      this.equipGadget('emp_stunner');
    } else if (e.code === 'Digit3') {
      this.equipGadget('signal_jammer');
    } else if (e.code === 'Digit4') {
      this.equipGadget('turbo_dash');
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keys[e.code] = false;
  }

  private handlePointerDown(e: PointerEvent) {
    if (!this.isPlaying || this.isPaused) return;
    this.audio.unlock();
    this.isDraggingCamera = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  }

  private handlePointerMove(e: PointerEvent) {
    if (!this.isPlaying || this.isPaused) return;
    const sens = 0.0045 * this.settings.cameraSensitivity;
    if (document.pointerLockElement === this.renderer.domElement) {
      this.camYaw -= e.movementX * sens;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + e.movementY * sens, 0.08, 1.15);
    } else if (this.isDraggingCamera) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.camYaw -= dx * sens;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * sens, 0.08, 1.15);
    }
  }

  // ======================== MAIN SIMULATION LOOP ========================

  private startLoop() {
    this.clock.start();
    const tick = () => {
      if (this.disposed) return;
      const rawDelta = this.clock.getDelta();
      const dt = Math.min(rawDelta, 0.05);
      this.elapsedTotal += dt;

      if (!this.isPaused) {
        this.updateDayNightAndWeather(dt);
        this.updateTrafficLights(dt);

        if (this.isPlaying) {
          this.world.step(1 / 60, dt, 3);
          this.updatePlayer(dt);
          this.updateAllVehicles(dt);
          this.updatePedestrians(dt);
          this.updatePoliceSystem(dt);
          this.updateMissionsAndWorldPickups(dt);
          this.updateParticles(dt);
          this.updateThirdPersonCamera(dt);
          this.updateAudioState();

          if (this.elapsedTotal - this.lastAutoSave > 15) {
            this.lastAutoSave = this.elapsedTotal;
            this.saveCurrentProgress();
          }
          if (this.elapsedTotal - this.lastHudEmit > 0.06) {
            this.lastHudEmit = this.elapsedTotal;
            this.emitHud();
          }
        } else {
          // Menu scenic camera orbit over city skyline
          const angle = this.elapsedTotal * 0.14;
          this.camera.position.set(Math.cos(angle) * 115, 48 + Math.sin(angle * 0.6) * 8, Math.sin(angle) * 115);
          this.camera.lookAt(0, 12, 0);
          this.updatePedestrians(dt);
          this.updateAllVehicles(dt);
        }
      }

      // Gentle ocean wave shimmer
      this.city.waterMesh.position.y = -0.65 + Math.sin(this.elapsedTotal * 1.4) * 0.08;

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  // ======================== PLAYER & VEHICLE MOVEMENT ========================

  private getPlayerWorldPos(): THREE.Vector3 {
    if (this.currentVehicle) {
      return _v3a.set(
        this.currentVehicle.body.position.x,
        this.currentVehicle.body.position.y,
        this.currentVehicle.body.position.z
      );
    }
    return _v3a.set(
      this.playerBody.position.x,
      this.playerBody.position.y,
      this.playerBody.position.z
    );
  }

  private tryEnterNearestVehicle() {
    const px = this.playerBody.position.x;
    const pz = this.playerBody.position.z;
    let best: VehicleEntity | null = null;
    let bestDist = 4.6;

    for (const v of this.vehicles) {
      if (v.isRacer) continue;
      const d = Math.hypot(v.body.position.x - px, v.body.position.z - pz);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }

    if (best) {
      if (best.isTraffic || best.isPolice) {
        const wasPolice = best.isPolice;
        best.isTraffic = false;
        best.isPolice = false;
        this.raiseWanted(wasPolice ? 2 : 1, wasPolice ? 'Police Cruiser Hijacked!' : 'Vehicle Theft Reported');
      }
      this.enterVehicle(best);
    }
  }

  private enterVehicle(v: VehicleEntity) {
    this.currentVehicle = v;
    this.playerModel.group.visible = false;
    this.playerBody.collisionResponse = false;
    this.playerBody.mass = 0;
    this.playerBody.updateMassProperties();
    this.playerBody.velocity.setZero();
    this.playerCrouching = false;

    const isNight = this.timeOfDay < 6.2 || this.timeOfDay > 18.2;
    v.headlightsOn = isNight;
    this.showNotification(`Entered ${VEHICLE_SPECS[v.category].name}`);
  }

  private exitCurrentVehicle() {
    if (!this.currentVehicle) return;
    const v = this.currentVehicle;
    const leftOffset = new CANNON.Vec3(-2.3, 0.3, 0);
    v.body.quaternion.vmult(leftOffset, leftOffset);

    this.playerBody.mass = 75;
    this.playerBody.updateMassProperties();
    this.playerBody.collisionResponse = true;
    this.playerBody.position.set(
      v.body.position.x + leftOffset.x,
      v.body.position.y + 0.4,
      v.body.position.z + leftOffset.z
    );
    this.playerBody.velocity.set(0, 0, 0);
    this.playerModel.group.visible = true;
    this.currentVehicle = null;
  }

  private updatePlayer(dt: number) {
    if (this.playerTurboTimer > 0) this.playerTurboTimer -= dt;
    if (this.notificationTimer > 0) {
      this.notificationTimer -= dt;
      if (this.notificationTimer <= 0) this.notificationText = null;
    }

    // Apply mobile look delta if any
    if (this.mobileInput.lookDeltaX !== 0 || this.mobileInput.lookDeltaY !== 0) {
      this.camYaw -= this.mobileInput.lookDeltaX * 0.008 * this.settings.cameraSensitivity;
      this.camPitch = THREE.MathUtils.clamp(
        this.camPitch + this.mobileInput.lookDeltaY * 0.006 * this.settings.cameraSensitivity,
        0.08,
        1.15
      );
      this.mobileInput.lookDeltaX = 0;
      this.mobileInput.lookDeltaY = 0;
    }

    if (this.currentVehicle) {
      // Keep dormant player body synced with vehicle
      this.playerBody.position.copy(this.currentVehicle.body.position);
      return;
    }

    // On-foot movement
    const forwardInput =
      (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) -
      (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0) +
      this.mobileInput.moveY;
    const strafeInput =
      (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) -
      (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0) +
      this.mobileInput.moveX;

    const sprinting = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.mobileInput.sprint);
    const jumpPressed = Boolean(this.keys['Space'] || this.mobileInput.jump);

    const floorY = this.city.groundHeightAt(
      this.playerBody.position.x,
      this.playerBody.position.z,
      this.playerBody.position.y
    );
    this.playerGrounded = this.playerBody.position.y <= floorY + 0.35 && Math.abs(this.playerBody.velocity.y) < 1.2;
    if (this.playerBody.position.y < floorY) {
      this.playerBody.position.y = floorY;
      this.playerBody.velocity.y = Math.max(0, this.playerBody.velocity.y);
    }

    if (jumpPressed && this.playerGrounded) {
      this.playerBody.velocity.y = 9.2;
      this.playerGrounded = false;
      this.playerCrouching = false;
      this.audio.playJump();
    }

    const moveMag = Math.min(1, Math.hypot(forwardInput, strafeInput));
    const speedBase = this.playerCrouching ? 3.5 : sprinting ? 10.6 : 6.0;
    const speed = speedBase * (this.playerTurboTimer > 0 ? 1.6 : 1.0);

    if (moveMag > 0.08) {
      // Camera forward on XZ plane
      const camFwdX = -Math.sin(this.camYaw);
      const camFwdZ = -Math.cos(this.camYaw);
      const camRightX = Math.cos(this.camYaw);
      const camRightZ = -Math.sin(this.camYaw);

      const dirX = camFwdX * forwardInput + camRightX * strafeInput;
      const dirZ = camFwdZ * forwardInput + camRightZ * strafeInput;
      const len = Math.hypot(dirX, dirZ) || 1;
      const nx = dirX / len;
      const nz = dirZ / len;

      this.playerBody.velocity.x = nx * speed * moveMag;
      this.playerBody.velocity.z = nz * speed * moveMag;

      const targetYaw = Math.atan2(nx, nz);
      let diff = targetYaw - this.playerYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerYaw += diff * Math.min(1, dt * 12);

      this.playerWalkPhase += dt * (sprinting ? 13 : 8.5);
      if (this.playerGrounded) {
        this.audio.playFootstep(sprinting, this.elapsedTotal);
      }
    } else {
      this.playerBody.velocity.x *= Math.pow(0.001, dt);
      this.playerBody.velocity.z *= Math.pow(0.001, dt);
    }

    // Sync Visual Articulated Character
    this.playerModel.group.position.set(
      this.playerBody.position.x,
      this.playerBody.position.y,
      this.playerBody.position.z
    );
    this.playerModel.group.rotation.y = this.playerYaw;

    const swing = moveMag > 0.08 ? Math.sin(this.playerWalkPhase) * (sprinting ? 0.72 : 0.48) : 0;
    this.playerModel.leftLeg.rotation.x = swing;
    this.playerModel.rightLeg.rotation.x = -swing;
    this.playerModel.leftArm.rotation.x = -swing * 0.85;
    this.playerModel.rightArm.rotation.x = swing * 0.85;
    this.playerModel.bodyPivot.position.y = this.playerCrouching ? -0.35 : Math.abs(swing) * 0.06;
    this.playerModel.bodyPivot.scale.y = this.playerCrouching ? 0.78 : 1.0;
  }

  private updateAllVehicles(dt: number) {
    const isWet = this.weather === 'rain' || this.weather === 'thunderstorm';
    const isNight = this.timeOfDay < 6.2 || this.timeOfDay > 18.2;

    for (const v of this.vehicles) {
      if (v.empStunTimer > 0) v.empStunTimer -= dt;

      // Clamp vehicle floor if above/below expected elevation
      const groundY = this.city.groundHeightAt(v.body.position.x, v.body.position.z, v.body.position.y);
      const spec = VEHICLE_SPECS[v.category];
      const minCenterY = groundY + spec.height * 0.46;
      if (v.body.position.y < minCenterY) {
        v.body.position.y = minCenterY;
        v.body.velocity.y = Math.max(0, v.body.velocity.y);
      }

      if (v === this.currentVehicle) {
        this.drivePlayerVehicle(v, dt, isWet);
      } else if (v.isTraffic && v.empStunTimer <= 0) {
        this.updateTrafficVehicle(v, dt);
      } else if (v.isRacer && v.empStunTimer <= 0) {
        this.updateRacerVehicle(v, dt);
      } else if (v.isPolice && this.wantedLevel > 0 && v.empStunTimer <= 0) {
        this.updatePoliceVehicle(v, dt);
      } else {
        // Parked / stunned damping
        v.body.velocity.x *= 0.92;
        v.body.velocity.z *= 0.92;
        v.body.angularVelocity.y *= 0.85;
      }

      // Sync Three.js Group with Physics Body
      v.visual.group.position.set(v.body.position.x, v.body.position.y - spec.height * 0.46, v.body.position.z);
      v.visual.group.quaternion.set(
        v.body.quaternion.x,
        v.body.quaternion.y,
        v.body.quaternion.z,
        v.body.quaternion.w
      );

      // Wheel spinning & front steering visual
      const fwd = _v3a.set(0, 0, 1).applyQuaternion(v.visual.group.quaternion);
      const vel = _v3b.set(v.body.velocity.x, 0, v.body.velocity.z);
      const signedSpeed = vel.dot(fwd);
      v.speedKmh = Math.abs(signedSpeed) * 3.6;

      for (const w of v.visual.wheels) {
        w.rotation.x += signedSpeed * dt * 2.2;
      }
      for (const pivot of v.visual.frontWheelSteerPivots) {
        pivot.rotation.y = v.steerAngle * 0.55;
      }

      // Headlights & Police Lightbar animation
      const lightsActive = v === this.currentVehicle ? v.headlightsOn : isNight || v.isPolice;
      for (const hl of v.visual.headlightMeshes) {
        const mat = hl.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = lightsActive ? 2.4 : 0.15;
      }
      for (const spot of v.visual.headlightSpots) {
        spot.intensity = v === this.currentVehicle && v.headlightsOn ? 18 : 0;
      }
      if (v.visual.policeRedLight && v.visual.policeBlueLight) {
        const flash = Math.sin(this.elapsedTotal * 14) > 0;
        const sirenActive = v.isPolice && this.wantedLevel > 0;
        (v.visual.policeRedLight.material as THREE.MeshStandardMaterial).emissiveIntensity =
          sirenActive && flash ? 4.0 : 0.25;
        (v.visual.policeBlueLight.material as THREE.MeshStandardMaterial).emissiveIntensity =
          sirenActive && !flash ? 4.0 : 0.25;
      }

      // Damage smoke effect when condition < 45
      if (v.condition < 45 && Math.random() < 0.25) {
        this.spawnSmoke(v.visual.group.position.x, v.visual.group.position.y + 1.1, v.visual.group.position.z, 0x3f3f46);
      }
    }
  }

  private drivePlayerVehicle(v: VehicleEntity, dt: number, isWet: boolean) {
    const spec = VEHICLE_SPECS[v.category];
    const throttle =
      (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) -
      (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0) +
      this.mobileInput.moveY;
    const steerInput =
      (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0) -
      (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) -
      this.mobileInput.moveX;
    const handbrake = Boolean(this.keys['Space'] || this.mobileInput.handbrake);

    const quat = new THREE.Quaternion(v.body.quaternion.x, v.body.quaternion.y, v.body.quaternion.z, v.body.quaternion.w);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const vel = new THREE.Vector3(v.body.velocity.x, 0, v.body.velocity.z);

    const fwdSpeed = vel.dot(fwd);
    const latSpeed = vel.dot(right);
    const maxSpeedMs = (spec.maxSpeed / 3.6) * (this.playerTurboTimer > 0 ? 1.25 : 1.0);

    // Steering
    v.steerAngle = THREE.MathUtils.lerp(v.steerAngle, steerInput * 0.75, Math.min(1, dt * 10));
    const speedFactor = THREE.MathUtils.clamp(Math.abs(fwdSpeed) / 7, 0.25, 1.0);
    const reverseSign = fwdSpeed >= -0.5 ? 1 : -1;
    const turnRate = steerInput * spec.turnSpeed * speedFactor * reverseSign * (handbrake ? 1.38 : 1.0);
    if (Math.abs(fwdSpeed) > 0.6) {
      v.body.angularVelocity.y = turnRate;
    } else {
      v.body.angularVelocity.y *= 0.8;
    }

    // Acceleration / Braking / Reverse
    let newFwdSpeed = fwdSpeed;
    if (throttle > 0.05) {
      if (fwdSpeed < -1) {
        newFwdSpeed += spec.brakeForce * dt;
      } else {
        newFwdSpeed += spec.accel * throttle * dt;
      }
    } else if (throttle < -0.05) {
      if (fwdSpeed > 1) {
        newFwdSpeed -= spec.brakeForce * dt;
      } else {
        newFwdSpeed += spec.accel * 0.55 * throttle * dt;
      }
    } else {
      newFwdSpeed *= Math.pow(0.45, dt);
    }

    if (handbrake) {
      newFwdSpeed *= Math.pow(0.35, dt);
      if (Math.abs(fwdSpeed) > 8 && Math.random() < 0.5) {
        this.spawnSmoke(v.visual.group.position.x, v.visual.group.position.y + 0.2, v.visual.group.position.z, 0xd4d4d8);
      }
    }

    newFwdSpeed = THREE.MathUtils.clamp(newFwdSpeed, -maxSpeedMs * 0.4, maxSpeedMs);

    // Lateral Grip (lower on wet roads or handbrake for realistic drifting!)
    const gripFactor = handbrake ? 0.84 : isWet ? spec.driftGrip * 0.94 : spec.driftGrip;
    const newLatSpeed = latSpeed * Math.pow(1 - gripFactor, dt * 12);

    const finalVel = fwd.multiplyScalar(newFwdSpeed).add(right.multiplyScalar(newLatSpeed));
    v.body.velocity.x = finalVel.x;
    v.body.velocity.z = finalVel.z;

    // Brake light intensity
    const braking = throttle < -0.05 || handbrake;
    for (const tl of v.visual.taillightMeshes) {
      (tl.material as THREE.MeshStandardMaterial).emissiveIntensity = braking ? 3.2 : 0.45;
    }
    // Subtle body roll lean
    v.visual.chassisGroup.rotation.z = THREE.MathUtils.lerp(
      v.visual.chassisGroup.rotation.z,
      -steerInput * Math.min(0.08, Math.abs(fwdSpeed) * 0.0025),
      dt * 8
    );
  }

  private updateTrafficVehicle(v: VehicleEntity, dt: number) {
    const px = v.body.position.x;
    const pz = v.body.position.z;

    // Check traffic lights before entering intersections
    let shouldStop = false;
    const lookAhead = 14;
    const nextX = v.trafficAxis === 'x' ? px + v.trafficDir * lookAhead : px;
    const nextZ = v.trafficAxis === 'z' ? pz + v.trafficDir * lookAhead : pz;

    for (const rc of ROAD_COORDS) {
      if (v.trafficAxis === 'z') {
        const distToInt = (rc - pz) * v.trafficDir;
        if (distToInt > 7 && distToInt < 15 && !this.nsGreen) shouldStop = true;
      } else {
        const distToInt = (rc - px) * v.trafficDir;
        if (distToInt > 7 && distToInt < 15 && this.nsGreen) shouldStop = true;
      }
    }

    // Check player or other cars ahead
    const pPos = this.getPlayerWorldPos();
    if (Math.hypot(pPos.x - nextX, pPos.z - nextZ) < 6.5) shouldStop = true;
    for (const other of this.vehicles) {
      if (other === v) continue;
      if (Math.hypot(other.body.position.x - nextX, other.body.position.z - nextZ) < 6.5) {
        shouldStop = true;
        break;
      }
    }

    const targetMs = shouldStop ? 0 : v.trafficTargetSpeed / 3.6;
    const vx = v.trafficAxis === 'x' ? v.trafficDir * targetMs : 0;
    const vz = v.trafficAxis === 'z' ? v.trafficDir * targetMs : 0;
    v.body.velocity.x = THREE.MathUtils.lerp(v.body.velocity.x, vx, dt * 3.5);
    v.body.velocity.z = THREE.MathUtils.lerp(v.body.velocity.z, vz, dt * 3.5);

    const desiredYaw =
      v.trafficAxis === 'z'
        ? v.trafficDir === 1
          ? 0
          : Math.PI
        : v.trafficDir === 1
          ? Math.PI / 2
          : -Math.PI / 2;
    v.body.quaternion.setFromEuler(0, desiredYaw, 0);

    // Wrap around city perimeter cleanly
    if (px > 188 && v.trafficDir === 1) v.body.position.x = -188;
    if (px < -188 && v.trafficDir === -1) v.body.position.x = 188;
    if (pz > 188 && v.trafficDir === 1) v.body.position.z = -188;
    if (pz < -188 && v.trafficDir === -1) v.body.position.z = 188;
  }

  private updateRacerVehicle(v: VehicleEntity, dt: number) {
    const target = RACE_CHECKPOINTS[v.racerCheckpointIdx % RACE_CHECKPOINTS.length];
    const dx = target.x - v.body.position.x;
    const dz = target.z - v.body.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 14) {
      v.racerCheckpointIdx++;
      if (v.racerCheckpointIdx >= RACE_CHECKPOINTS.length) {
        v.racerLapFinished = true;
        v.racerCheckpointIdx = RACE_CHECKPOINTS.length - 1;
      }
    }

    const targetYaw = Math.atan2(dx, dz);
    const speedMs = v.racerLapFinished ? 4 : 38;
    v.body.quaternion.setFromEuler(0, targetYaw, 0);
    v.body.velocity.x = THREE.MathUtils.lerp(v.body.velocity.x, Math.sin(targetYaw) * speedMs, dt * 3);
    v.body.velocity.z = THREE.MathUtils.lerp(v.body.velocity.z, Math.cos(targetYaw) * speedMs, dt * 3);
  }

  // ======================== TRAFFIC LIGHTS & PEDESTRIANS ========================

  private updateTrafficLights(dt: number) {
    this.trafficPhaseTime = (this.trafficPhaseTime + dt) % 16;
    this.nsGreen = this.trafficPhaseTime < 8;

    for (const tl of this.city.trafficLights) {
      (tl.nsGreenMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = this.nsGreen ? 2.2 : 0.08;
      (tl.nsRedMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = this.nsGreen ? 0.08 : 2.2;
      (tl.ewGreenMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = this.nsGreen ? 0.08 : 2.2;
      (tl.ewRedMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = this.nsGreen ? 2.2 : 0.08;
    }
  }

  private updatePedestrians(dt: number) {
    const pPos = this.getPlayerWorldPos();
    const playerSpeed = this.currentVehicle ? this.currentVehicle.speedKmh : 0;

    for (const ped of this.pedestrians) {
      // React to speeding vehicle nearby
      const distToPlayer = Math.hypot(ped.x - pPos.x, ped.z - pPos.z);
      if (distToPlayer < 9 && playerSpeed > 32 && ped.fleeTimer <= 0) {
        ped.fleeTimer = 2.5;
        const ang = Math.atan2(ped.z - pPos.z, ped.x - pPos.x);
        ped.fleeVx = Math.cos(ang) * 6.0;
        ped.fleeVz = Math.sin(ang) * 6.0;
      }

      if (ped.fleeTimer > 0) {
        ped.fleeTimer -= dt;
        ped.x += ped.fleeVx * dt;
        ped.z += ped.fleeVz * dt;
        ped.walkPhase += dt * 13;
        ped.model.group.rotation.y = Math.atan2(ped.fleeVx, ped.fleeVz);
      } else {
        // Cross road check at intersections
        const step = ped.speed * ped.dir * dt;
        if (ped.axis === 'z') ped.z += step;
        else ped.x += step;
        ped.walkPhase += dt * 7;
        ped.model.group.rotation.y =
          ped.axis === 'z' ? (ped.dir === 1 ? 0 : Math.PI) : ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      }

      if (ped.x > 188) ped.dir = -1;
      if (ped.x < -188) ped.dir = 1;
      if (ped.z > 188) ped.dir = -1;
      if (ped.z < -188) ped.dir = 1;

      ped.model.group.position.set(ped.x, 0.16, ped.z);
      const swing = Math.sin(ped.walkPhase) * 0.55;
      ped.model.leftLeg.rotation.x = swing;
      ped.model.rightLeg.rotation.x = -swing;
      ped.model.leftArm.rotation.x = -swing * 0.7;
      ped.model.rightArm.rotation.x = swing * 0.7;
    }
  }

  // ======================== POLICE & WANTED SYSTEM ========================

  private raiseWanted(starsDelta: number, reason: string) {
    const prev = this.wantedLevel;
    this.wantedLevel = Math.min(5, Math.max(this.wantedLevel + starsDelta, 1));
    this.wantedSearching = false;
    this.wantedEscapeTimer = 0;
    if (this.wantedLevel > prev) {
      this.showNotification(`${reason} · Wanted ${this.wantedLevel}★`);
    }
    this.syncPoliceSpawnCount();
  }

  private syncPoliceSpawnCount() {
    const activePolice = this.vehicles.filter((v) => v.isPolice);
    const needed = this.wantedLevel; // 1 star = 1 unit ... 5 stars = 5 units!
    const pPos = this.getPlayerWorldPos();

    while (activePolice.length < needed) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 58 + Math.random() * 26;
      const sx = THREE.MathUtils.clamp(pPos.x + Math.cos(angle) * dist, -175, 175);
      const sz = THREE.MathUtils.clamp(pPos.z + Math.sin(angle) * dist, -175, 175);
      const cruiser = this.createVehicleEntity(
        `police_${Date.now()}_${activePolice.length}`,
        'police',
        sx,
        0.2,
        sz,
        0,
        0x111827,
        { isPolice: true }
      );
      activePolice.push(cruiser);
    }
  }

  private clearPoliceAndRacers() {
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if ((v.isPolice || v.isRacer) && v !== this.currentVehicle) {
        this.scene.remove(v.visual.group);
        this.world.removeBody(v.body);
        this.vehicles.splice(i, 1);
      }
    }
  }

  private clearRacersOnly() {
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v.isRacer) {
        this.scene.remove(v.visual.group);
        this.world.removeBody(v.body);
        this.vehicles.splice(i, 1);
      }
    }
  }

  private updatePoliceVehicle(v: VehicleEntity, dt: number) {
    const pPos = this.getPlayerWorldPos();
    const dx = pPos.x - v.body.position.x;
    const dz = pPos.z - v.body.position.z;
    const dist = Math.hypot(dx, dz);

    // Obstacle avoidance check
    let targetYaw = Math.atan2(dx, dz);
    const lookX = v.body.position.x + Math.sin(targetYaw) * 8;
    const lookZ = v.body.position.z + Math.cos(targetYaw) * 8;
    for (const c of this.city.colliders) {
      if (lookX > c.minX - 2 && lookX < c.maxX + 2 && lookZ > c.minZ - 2 && lookZ < c.maxZ + 2) {
        targetYaw += Math.PI * 0.42;
        break;
      }
    }

    const chaseSpeed = 24 + this.wantedLevel * 4.5;
    v.body.quaternion.setFromEuler(0, targetYaw, 0);
    if (dist > 4.5) {
      v.body.velocity.x = THREE.MathUtils.lerp(v.body.velocity.x, Math.sin(targetYaw) * chaseSpeed, dt * 2.8);
      v.body.velocity.z = THREE.MathUtils.lerp(v.body.velocity.z, Math.cos(targetYaw) * chaseSpeed, dt * 2.8);
    } else {
      v.body.velocity.x *= 0.9;
      v.body.velocity.z *= 0.9;
    }
  }

  private updatePoliceSystem(dt: number) {
    if (this.wantedLevel <= 0) {
      this.bustedTimer = 0;
      return;
    }

    const pPos = this.getPlayerWorldPos();
    const policeUnits = this.vehicles.filter((v) => v.isPolice && v.empStunTimer <= 0);
    let minPoliceDist = 9999;

    for (const unit of policeUnits) {
      const d = Math.hypot(unit.body.position.x - pPos.x, unit.body.position.z - pPos.z);
      if (d < minPoliceDist) minPoliceDist = d;

      // Relocate stuck far units closer during active chase
      if (d > 155 && !this.wantedSearching) {
        const ang = Math.random() * Math.PI * 2;
        unit.body.position.set(
          THREE.MathUtils.clamp(pPos.x + Math.cos(ang) * 70, -175, 175),
          1,
          THREE.MathUtils.clamp(pPos.z + Math.sin(ang) * 70, -175, 175)
        );
      }
    }

    // Busted check if cornered closely
    const speed = this.currentVehicle ? this.currentVehicle.speedKmh : 0;
    if (minPoliceDist < 5.2 && speed < 6 && !this.currentVehicle) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 3.0) {
        this.triggerGameOver('BUSTED BY LCPD');
        return;
      }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 1.5);
    }

    // Search & Escape cooldown
    if (minPoliceDist > 72) {
      this.wantedSearching = true;
      this.wantedEscapeTimer += dt;
      const requiredSec = 8 + this.wantedLevel * 2.5;
      if (this.wantedEscapeTimer >= requiredSec) {
        this.wantedLevel = 0;
        this.wantedSearching = false;
        this.wantedEscapeTimer = 0;
        this.clearPoliceAndRacers();
        this.showNotification('Wanted Level Cleared!');
      }
    } else {
      this.wantedSearching = false;
      this.wantedEscapeTimer = Math.max(0, this.wantedEscapeTimer - dt * 2);
    }
  }

  private applyDamageToPlayer(amount: number) {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.triggerGameOver('WASTED');
    }
  }

  private triggerGameOver(reason: string) {
    this.wantedLevel = 0;
    this.clearPoliceAndRacers();
    this.isPaused = true;
    this.callbacks.onGameOver(reason);
  }

  public respawnPlayer() {
    this.health = 100;
    this.armor = 25;
    this.wantedLevel = 0;
    this.bustedTimer = 0;
    this.money = Math.max(0, this.money - 250);
    if (this.currentVehicle) this.exitCurrentVehicle();
    this.playerBody.position.set(90, 0.4, -10); // Hospital entrance
    this.playerBody.velocity.setZero();
    this.isPaused = false;
    this.showNotification('Discharged from City General Hospital (-$250)');
    this.emitHud();
  }

  // ======================== MISSIONS & PICKUPS ========================

  private updateMissionsAndWorldPickups(dt: number) {
    const pPos = this.getPlayerWorldPos();

    // Rotate mission start beacons & collectibles
    for (const [id, beacon] of this.missionBeacons) {
      beacon.visible = !this.activeMissionId && !this.completedMissions.has(id);
      beacon.rotation.y += dt * 1.4;
    }
    this.activeObjectiveBeacon.rotation.y += dt * 2.0;

    for (const c of this.collectibles) {
      if (c.collected) continue;
      c.mesh.rotation.y += dt * 1.8;
      if (Math.hypot(pPos.x - c.x, pPos.z - c.z) < 2.8 && Math.abs(pPos.y - c.y) < 3.5) {
        c.collected = true;
        c.mesh.visible = false;
        this.collectedIds.add(c.id);
        this.money += 500;
        this.audio.playPickup();
        this.showNotification(`Discovered ${c.name} (+$500)`);
      }
    }

    // Landmark discovery
    for (const lm of this.city.landmarks) {
      if (!this.discoveredLocations.has(lm.id)) {
        if (Math.hypot(pPos.x - lm.x, pPos.z - lm.z) < 18) {
          this.discoveredLocations.add(lm.id);
          this.money += 200;
          this.audio.playPickup();
          this.showNotification(`Discovered ${lm.name} (+$200)`);
        }
      }
    }

    if (!this.activeMissionId) return;
    this.activeMissionElapsed += dt;

    if (this.activeMissionTimer !== null) {
      this.activeMissionTimer -= dt;
      if (this.activeMissionTimer <= 0) {
        this.cancelActiveMission();
        this.showNotification('Mission Failed: Time Expired!');
        return;
      }
    }

    // Evaluate active mission steps
    if (this.activeMissionId === 'mission_1_first_drive') {
      if (this.activeMissionStep === 0 && this.currentVehicle) {
        this.activeMissionStep = 1;
        this.updateObjectiveBeacon();
        this.showNotification('Drive to Downtown Skyline Plaza!');
      } else if (this.activeMissionStep === 1 && Math.hypot(pPos.x - 0, pPos.z - 0) < 10) {
        this.finishActiveMission();
      }
    } else if (this.activeMissionId === 'mission_2_city_delivery') {
      if (this.activeMissionStep === 0 && Math.hypot(pPos.x - -30, pPos.z - 12) < 9) {
        this.activeMissionStep = 1;
        this.audio.playPickup();
        this.updateObjectiveBeacon();
        this.showNotification('Package Acquired! Deliver to Airport Terminal!');
      } else if (this.activeMissionStep === 1 && Math.hypot(pPos.x - 138, pPos.z - -165) < 12) {
        this.finishActiveMission();
      }
    } else if (this.activeMissionId === 'mission_3_police_chase') {
      if (Math.hypot(pPos.x - -120, pPos.z - 120) < 11) {
        this.wantedLevel = 0;
        this.clearPoliceAndRacers();
        this.finishActiveMission();
      }
    } else if (this.activeMissionId === 'mission_4_street_race') {
      const cp = RACE_CHECKPOINTS[this.raceCheckpointIdx];
      if (cp && Math.hypot(pPos.x - cp.x, pPos.z - cp.z) < 14) {
        this.raceCheckpointIdx++;
        this.audio.playPickup();
        if (this.raceCheckpointIdx >= RACE_CHECKPOINTS.length) {
          this.finishActiveMission();
        } else {
          this.updateObjectiveBeacon();
        }
      }
    } else if (this.activeMissionId === 'mission_5_city_exploration') {
      EXPLORE_TARGETS.forEach((t, idx) => {
        if (!this.exploreVisited.has(idx) && Math.hypot(pPos.x - t.x, pPos.z - t.z) < 12 && Math.abs(pPos.y - t.y) < 4) {
          this.exploreVisited.add(idx);
          this.audio.playPickup();
          this.showNotification(`Visited ${t.name} (${this.exploreVisited.size}/${EXPLORE_TARGETS.length})`);
          this.updateObjectiveBeacon();
        }
      });
      if (this.exploreVisited.size >= EXPLORE_TARGETS.length) {
        this.finishActiveMission();
      }
    }
  }

  private updateObjectiveBeacon() {
    if (!this.activeMissionId) {
      this.activeObjectiveBeacon.visible = false;
      return;
    }
    let pos: { x: number; y: number; z: number } | null = null;

    if (this.activeMissionId === 'mission_1_first_drive') {
      pos = this.activeMissionStep === 0 ? { x: -16, y: 0, z: 62 } : { x: 0, y: 0, z: 0 };
    } else if (this.activeMissionId === 'mission_2_city_delivery') {
      pos = this.activeMissionStep === 0 ? { x: -30, y: 0, z: 12 } : { x: 138, y: 0, z: -165 };
    } else if (this.activeMissionId === 'mission_3_police_chase') {
      pos = { x: -120, y: 0, z: 120 };
    } else if (this.activeMissionId === 'mission_4_street_race') {
      pos = RACE_CHECKPOINTS[this.raceCheckpointIdx] ?? null;
    } else if (this.activeMissionId === 'mission_5_city_exploration') {
      const nextIdx = EXPLORE_TARGETS.findIndex((_, i) => !this.exploreVisited.has(i));
      pos = nextIdx >= 0 ? EXPLORE_TARGETS[nextIdx] : null;
    }

    if (pos) {
      this.activeObjectiveBeacon.visible = true;
      this.activeObjectiveBeacon.position.set(pos.x, pos.y + 0.08, pos.z);
    } else {
      this.activeObjectiveBeacon.visible = false;
    }
  }

  private finishActiveMission() {
    const def = STORY_MISSIONS.find((m) => m.id === this.activeMissionId);
    if (!def) return;
    this.completedMissions.add(def.id);
    this.money += def.rewardMoney;
    const timeTakenSec = Math.round(this.activeMissionElapsed);
    this.activeMissionId = null;
    this.activeMissionTimer = null;
    this.activeObjectiveBeacon.visible = false;
    this.clearRacersOnly();
    this.audio.playMissionComplete();
    this.saveCurrentProgress();
    this.callbacks.onMissionComplete({
      missionId: def.id,
      title: def.title,
      rewardMoney: def.rewardMoney,
      timeTakenSec,
    });
  }

  // ======================== DAY/NIGHT, WEATHER & PARTICLES ========================

  private updateDayNightAndWeather(dt: number) {
    // Advance Day-Night clock (1 real sec = ~6 game minutes at 1x speed -> full 24h cycle in 4 minutes)
    if (this.settings.dayNightSpeed > 0) {
      this.timeOfDay = (this.timeOfDay + dt * 0.1 * this.settings.dayNightSpeed) % 24;
    }

    // Auto-cycle weather if set to 'auto'
    if (this.settings.weatherMode === 'auto') {
      this.weatherChangeTimer -= dt;
      if (this.weatherChangeTimer <= 0) {
        this.weatherChangeTimer = 65 + Math.random() * 40;
        const pool: WeatherType[] = ['sunny', 'cloudy', 'rain', 'thunderstorm', 'fog'];
        this.setWeather(pool[Math.floor(Math.random() * pool.length)]);
      }
    }

    // Sun angle & color interpolation
    const t = this.timeOfDay;
    const sunAngle = ((t - 6) / 24) * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const daylight = THREE.MathUtils.clamp((sunHeight + 0.18) / 0.65, 0, 1);

    this.sunLight.position.set(Math.cos(sunAngle) * 140, Math.max(18, sunHeight * 150), 65);
    if (daylight < 0.35 && daylight > 0.02) {
      // Sunrise / Sunset warm amber
      _sunColor.setHex(0xfb923c).lerp(new THREE.Color(0xfff1d6), daylight / 0.35);
    } else if (daylight <= 0.02) {
      _sunColor.setHex(0x64748b);
    } else {
      _sunColor.setHex(0xfff7e6);
    }
    this.sunLight.color.copy(_sunColor);

    const weatherDim =
      this.weather === 'thunderstorm'
        ? 0.45
        : this.weather === 'rain'
          ? 0.6
          : this.weather === 'cloudy' || this.weather === 'fog'
            ? 0.78
            : 1.0;

    this.sunLight.intensity = (0.28 + daylight * 1.75) * weatherDim;
    this.hemiLight.intensity = (0.28 + daylight * 0.55) * weatherDim;

    // Sky & Fog Color
    const nightSky = 0x090d16;
    const daySky = this.weather === 'sunny' ? 0x67b7f7 : this.weather === 'cloudy' ? 0x94a3b8 : 0x475569;
    _skyColor.setHex(nightSky).lerp(new THREE.Color(daySky), daylight);
    if (daylight > 0.05 && daylight < 0.32 && this.weather === 'sunny') {
      _skyColor.lerp(new THREE.Color(0xf97316), 0.35);
    }
    (this.scene.background as THREE.Color).copy(_skyColor);
    _fogColor.copy(_skyColor);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(_fogColor);
    fog.density = this.weather === 'fog' ? 0.0085 : this.weather === 'thunderstorm' ? 0.0045 : 0.0022;

    // Night emissive windows & streetlights
    const nightFactor = 1 - daylight;
    for (const mat of this.city.buildingWindowMats) {
      mat.emissiveIntensity = 0.06 + nightFactor * 1.15;
    }
    this.city.lampBulbMat.emissiveIntensity = 0.1 + nightFactor * 2.6;
    for (const pl of this.city.streetLights) {
      pl.intensity = nightFactor * 22;
    }

    // Wet Road Reflections during Rain / Thunderstorm
    const wet = this.weather === 'rain' || this.weather === 'thunderstorm';
    this.city.asphaltMat.roughness = THREE.MathUtils.lerp(this.city.asphaltMat.roughness, wet ? 0.16 : 0.75, dt * 1.5);
    this.city.asphaltMat.metalness = THREE.MathUtils.lerp(this.city.asphaltMat.metalness, wet ? 0.35 : 0.08, dt * 1.5);
    this.city.intersectionMat.roughness = this.city.asphaltMat.roughness;
    this.city.intersectionMat.metalness = this.city.asphaltMat.metalness;

    // Thunderstorm Lightning
    if (this.weather === 'thunderstorm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 7 + Math.random() * 11;
        this.lightningLight.intensity = 2.6;
        this.audio.playThunder();
      }
    }
    if (this.lightningLight.intensity > 0) {
      this.lightningLight.intensity = Math.max(0, this.lightningLight.intensity - dt * 8);
    }
  }

  public setWeather(w: WeatherType) {
    this.weather = w;
    this.rainPoints.visible = w === 'rain' || w === 'thunderstorm';
  }

  private updateParticles(dt: number) {
    // Rain particles follow camera
    if (this.rainPoints.visible) {
      this.rainPoints.position.set(this.camera.position.x, 0, this.camera.position.z);
      const posArr = this.rainPositions;
      for (let i = 0; i < posArr.length; i += 3) {
        posArr[i + 1] -= 34 * dt;
        if (posArr[i + 1] < 0) posArr[i + 1] = 36;
      }
      this.rainPoints.geometry.attributes.position.needsUpdate = true;
    }

    // EMP pulse ring expansion
    if (this.empRingTimer > 0) {
      this.empRingTimer -= dt;
      const pct = 1 - this.empRingTimer / 0.65;
      this.empRingMesh.scale.setScalar(1 + pct * 28);
      (this.empRingMesh.material as THREE.MeshBasicMaterial).opacity = (1 - pct) * 0.85;
      if (this.empRingTimer <= 0) this.empRingMesh.visible = false;
    }

    // Smoke puffs
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.addScalar(dt * 1.4);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life * 0.65);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.smokeParticles.splice(i, 1);
      }
    }
  }

  private spawnSmoke(x: number, y: number, z: number, colorHex: number) {
    if (this.smokeParticles.length > 35) return;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 6, 6),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.55 })
    );
    mesh.position.set(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6);
    this.scene.add(mesh);
    this.smokeParticles.push({
      mesh,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1.8 + Math.random() * 1.5,
      vz: (Math.random() - 0.5) * 1.5,
      life: 0.85,
    });
  }

  // ======================== THIRD-PERSON CAMERA ========================

  private updateThirdPersonCamera(dt: number) {
    const targetPos = this.getPlayerWorldPos();
    const targetHeight = this.currentVehicle ? 1.55 : this.playerCrouching ? 1.05 : 1.55;
    _camTarget.set(targetPos.x, targetPos.y + targetHeight, targetPos.z);

    // Subtle auto-align behind moving vehicle when player isn't dragging camera
    if (this.currentVehicle && !this.isDraggingCamera && this.currentVehicle.speedKmh > 18) {
      const vehFwd = _v3b.set(0, 0, 1).applyQuaternion(this.currentVehicle.visual.group.quaternion);
      const vehYaw = Math.atan2(-vehFwd.x, -vehFwd.z);
      let diff = vehYaw - this.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.camYaw += diff * Math.min(1, dt * 1.8);
    }

    const dist = this.currentVehicle ? this.camDistance + 1.8 : this.camDistance * 0.68;
    const horizDist = Math.cos(this.camPitch) * dist;
    const vertDist = Math.sin(this.camPitch) * dist;

    _camDesired.set(
      _camTarget.x + Math.sin(this.camYaw) * horizDist,
      _camTarget.y + vertDist,
      _camTarget.z + Math.cos(this.camYaw) * horizDist
    );

    const groundAtCam = this.city.groundHeightAt(_camDesired.x, _camDesired.z, _camTarget.y);
    if (_camDesired.y < groundAtCam + 0.9) {
      _camDesired.y = groundAtCam + 0.9;
    }

    const damp = 1 - Math.exp(-12 * dt);
    this.camera.position.lerp(_camDesired, damp);
    this.camera.lookAt(_camTarget);

    // Dynamic Speed FOV
    const speedRatio = this.currentVehicle ? Math.min(1, this.currentVehicle.speedKmh / 200) : 0;
    const targetFov = 62 + speedRatio * 15;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 5);
      this.camera.updateProjectionMatrix();
    }

    // Keep shadow frustum centered near player for razor-sharp shadows anywhere in city
    this.sunLight.target.position.set(_camTarget.x, 0, _camTarget.z);
  }

  private updateAudioState() {
    this.audio.updateContinuous(
      Boolean(this.currentVehicle),
      this.currentVehicle?.speedKmh ?? 0,
      Boolean(this.currentVehicle && (this.keys['Space'] || this.mobileInput.handbrake)),
      this.wantedLevel > 0,
      this.weather === 'rain' || this.weather === 'thunderstorm',
      this.elapsedTotal
    );
  }

  private showNotification(text: string) {
    this.notificationText = text;
    this.notificationTimer = 4.2;
  }

  // ======================== HUD STATE SYNC ========================

  private emitHud() {
    const pPos = this.getPlayerWorldPos();

    // Nearby prompt
    let interactPrompt: string | null = null;
    if (!this.currentVehicle) {
      for (const v of this.vehicles) {
        if (!v.isRacer && Math.hypot(v.body.position.x - pPos.x, v.body.position.z - pPos.z) < 4.5) {
          interactPrompt = `Press [E] to enter ${VEHICLE_SPECS[v.category].name}`;
          break;
        }
      }
    }
    if (!interactPrompt && !this.activeMissionId) {
      for (const m of STORY_MISSIONS) {
        if (!this.completedMissions.has(m.id) && Math.hypot(pPos.x - m.startPos.x, pPos.z - m.startPos.z) < 6.5) {
          interactPrompt = `Press [F] to start Mission ${m.number}: ${m.title}`;
          break;
        }
      }
    }
    if (!interactPrompt) {
      if (Math.hypot(pPos.x - 90, pPos.z - -12) < 9) {
        interactPrompt = 'Press [F] at Hospital to Heal ($100)';
      } else if (this.currentVehicle && Math.hypot(pPos.x - -16, pPos.z - 76) < 9) {
        interactPrompt = 'Press [F] at Garage to Repair Vehicle (Free)';
      } else if (this.currentVehicle && Math.hypot(pPos.x - 90, pPos.z - 20) < 9) {
        interactPrompt = 'Press [F] at Gas Station to Refuel & Repair';
      }
    }

    // Active Mission Text
    let activeMissionTitle: string | null = null;
    let activeObjectiveText: string | null = null;
    let missionProgressText: string | null = null;
    if (this.activeMissionId) {
      const def = STORY_MISSIONS.find((m) => m.id === this.activeMissionId);
      activeMissionTitle = def ? `Mission ${def.number}: ${def.title}` : null;
      if (this.activeMissionId === 'mission_1_first_drive') {
        activeObjectiveText =
          this.activeMissionStep === 0 ? 'Enter a Sports Car at the Dealership' : 'Drive to Downtown Skyline Plaza';
      } else if (this.activeMissionId === 'mission_2_city_delivery') {
        activeObjectiveText =
          this.activeMissionStep === 0 ? 'Pick up courier package at Metro Mall' : 'Deliver to International Airport';
      } else if (this.activeMissionId === 'mission_3_police_chase') {
        activeObjectiveText = 'Evade LCPD Interceptors & reach Industrial Docks Safehouse';
      } else if (this.activeMissionId === 'mission_4_street_race') {
        activeObjectiveText = `Hit Checkpoint ${this.raceCheckpointIdx + 1} / ${RACE_CHECKPOINTS.length}`;
        missionProgressText = `CP ${this.raceCheckpointIdx}/${RACE_CHECKPOINTS.length}`;
      } else if (this.activeMissionId === 'mission_5_city_exploration') {
        const nextIdx = EXPLORE_TARGETS.findIndex((_, i) => !this.exploreVisited.has(i));
        activeObjectiveText =
          nextIdx >= 0 ? `Visit ${EXPLORE_TARGETS[nextIdx].name}` : 'All Landmarks Visited!';
        missionProgressText = `${this.exploreVisited.size}/${EXPLORE_TARGETS.length} Landmarks`;
      }
    }

    // Minimap blips
    const blips: MinimapBlip[] = [];
    for (const lm of this.city.landmarks) {
      blips.push({ x: lm.x, z: lm.z, type: 'landmark', color: lm.color, label: lm.name });
    }
    for (const v of this.vehicles) {
      if (v === this.currentVehicle) continue;
      if (v.isPolice) {
        blips.push({ x: v.body.position.x, z: v.body.position.z, type: 'police', color: '#ef4444' });
      } else if (v.isRacer) {
        blips.push({ x: v.body.position.x, z: v.body.position.z, type: 'racer', color: '#f59e0b' });
      } else if (!v.isTraffic) {
        blips.push({ x: v.body.position.x, z: v.body.position.z, type: 'vehicle', color: '#a1a1aa' });
      }
    }
    if (this.activeObjectiveBeacon.visible) {
      blips.push({
        x: this.activeObjectiveBeacon.position.x,
        z: this.activeObjectiveBeacon.position.z,
        type: 'mission',
        color: '#22d3ee',
      });
    } else {
      for (const m of STORY_MISSIONS) {
        if (!this.completedMissions.has(m.id)) {
          blips.push({ x: m.startPos.x, z: m.startPos.z, type: 'mission', color: '#f59e0b' });
        }
      }
    }

    // Race rank calculation if in race
    let racePosition: number | undefined;
    let raceTotal: number | undefined;
    if (this.activeMissionId === 'mission_4_street_race') {
      const racers = this.vehicles.filter((v) => v.isRacer);
      raceTotal = racers.length + 1;
      let ahead = 0;
      for (const r of racers) {
        if (r.racerCheckpointIdx > this.raceCheckpointIdx) ahead++;
      }
      racePosition = 1 + ahead;
    }

    const gadgetAmmo: Record<WeaponGadgetId, number> = {
      fist: 0,
      emp_stunner: this.inventory.find((i) => i.gadgetId === 'emp_stunner')?.ammo ?? 0,
      signal_jammer: this.inventory.find((i) => i.gadgetId === 'signal_jammer')?.ammo ?? 0,
      turbo_dash: this.inventory.find((i) => i.gadgetId === 'turbo_dash')?.ammo ?? 0,
    };

    const requiredEscSec = 8 + this.wantedLevel * 2.5;

    this.callbacks.onHudUpdate({
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      armor: Math.round(this.armor),
      maxArmor: this.maxArmor,
      money: this.money,
      wantedLevel: this.wantedLevel,
      wantedSearching: this.wantedSearching,
      wantedCooldownPct: this.wantedLevel > 0 ? Math.min(1, this.wantedEscapeTimer / requiredEscSec) : 0,
      timeOfDay: this.timeOfDay,
      weather: this.weather,
      districtName: this.city.getDistrictAt(pPos.x, pPos.z),
      inVehicle: Boolean(this.currentVehicle),
      vehicleName: this.currentVehicle ? VEHICLE_SPECS[this.currentVehicle.category].name : '',
      vehicleCategory: this.currentVehicle ? this.currentVehicle.category : null,
      speedKmh: Math.round(this.currentVehicle?.speedKmh ?? 0),
      vehicleCondition: Math.round(this.currentVehicle?.condition ?? 100),
      headlightsOn: this.currentVehicle?.headlightsOn ?? false,
      equippedGadget: this.equippedGadget,
      gadgetAmmo,
      activeMissionId: this.activeMissionId,
      activeMissionTitle,
      activeObjectiveText,
      missionTimerSec: this.activeMissionTimer !== null ? Math.ceil(this.activeMissionTimer) : null,
      missionProgressText,
      interactPrompt,
      notificationText: this.notificationText,
      completedMissions: Array.from(this.completedMissions),
      discoveredLocations: Array.from(this.discoveredLocations),
      collectiblesFound: this.collectedIds.size,
      totalCollectibles: this.collectibles.length,
      playerX: pPos.x,
      playerY: pPos.y,
      playerZ: pPos.z,
      playerYaw: this.currentVehicle
        ? Math.atan2(
            _v3c.set(0, 0, 1).applyQuaternion(this.currentVehicle.visual.group.quaternion).x,
            _v3c.z
          )
        : this.playerYaw,
      minimapBlips: blips,
      racePosition,
      raceTotal,
    });
  }

  public getInventorySnapshot(): InventoryItem[] {
    return this.inventory.map((i) => ({ ...i }));
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResizeBound);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDownBound);
    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
    this.renderer.domElement.removeEventListener('wheel', this.onWheelBound);

    this.audio.dispose();

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
