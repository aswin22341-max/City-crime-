import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { LandmarkDef } from './types';
import type { ProceduralTextureSet } from './textures';

export const ROAD_COORDS = [-180, -120, -60, 0, 60, 120, 180];
export const ROAD_WIDTH = 14;
export const WORLD_HALF = 235;

export interface StaticBoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
  minY: number;
}

export interface TrafficLightNode {
  x: number;
  z: number;
  nsRedMesh: THREE.Mesh;
  nsGreenMesh: THREE.Mesh;
  ewRedMesh: THREE.Mesh;
  ewGreenMesh: THREE.Mesh;
}

export interface StreetLampBulb {
  mat: THREE.MeshStandardMaterial;
}

export interface CityBuildResult {
  group: THREE.Group;
  colliders: StaticBoxCollider[];
  landmarks: LandmarkDef[];
  trafficLights: TrafficLightNode[];
  waterMesh: THREE.Mesh;
  buildingWindowMats: THREE.MeshStandardMaterial[];
  lampBulbMat: THREE.MeshStandardMaterial;
  streetLights: THREE.PointLight[];
  undergroundLights: THREE.PointLight[];
  asphaltMat: THREE.MeshStandardMaterial;
  intersectionMat: THREE.MeshStandardMaterial;
  collectibleSpawns: Array<{ id: string; name: string; x: number; y: number; z: number; color: number }>;
  getDistrictAt: (x: number, z: number) => string;
  groundHeightAt: (x: number, z: number, currentY?: number) => number;
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function buildCity(
  scene: THREE.Scene,
  world: CANNON.World,
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean
): CityBuildResult {
  const rand = seededRand(4207);
  const group = new THREE.Group();
  const colliders: StaticBoxCollider[] = [];
  const buildingWindowMats: THREE.MeshStandardMaterial[] = [];
  const trafficLights: TrafficLightNode[] = [];
  const streetLights: THREE.PointLight[] = [];
  const undergroundLights: THREE.PointLight[] = [];

  const staticPhysicsMat = new CANNON.Material('static');

  const addPhysicsBox = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    registerObstacle = true
  ) => {
    const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
    const body = new CANNON.Body({ mass: 0, material: staticPhysicsMat });
    body.addShape(shape);
    body.position.set(x, y, z);
    world.addBody(body);

    if (registerObstacle) {
      colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        minY: y - h / 2,
        maxY: y + h / 2,
      });
    }
  };

  // Base terrain plane (underground floor excluded via cutout logic in groundHeightAt, physics ground at y=0 for main city)
  // We build the main city ground out of solid slabs around the underground garage pit so physics works cleanly inside the pit too!
  const pitBounds = { minX: 74, maxX: 106, minZ: 74, maxZ: 106 };

  // Main city ground physics plane at y = 0 (split or offset so pit works? Even better: 4 large physics ground slabs around pit + pit floor at -4.2)
  const addGroundSlab = (minX: number, maxX: number, minZ: number, maxZ: number, yTop: number) => {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const h = 2;
    const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
    const body = new CANNON.Body({ mass: 0, material: staticPhysicsMat });
    body.addShape(shape);
    body.position.set((minX + maxX) / 2, yTop - h / 2, (minZ + maxZ) / 2);
    world.addBody(body);
  };
  // West of pit
  addGroundSlab(-320, pitBounds.minX, -320, 320, 0);
  // East of pit
  addGroundSlab(pitBounds.maxX, 320, -320, 320, 0);
  // North of pit
  addGroundSlab(pitBounds.minX, pitBounds.maxX, -320, pitBounds.minZ, 0);
  // South of pit
  addGroundSlab(pitBounds.minX, pitBounds.maxX, pitBounds.maxZ, 320, 0);
  // Pit underground floor at y = -4.2
  addGroundSlab(pitBounds.minX - 6, pitBounds.maxX + 6, pitBounds.minZ - 6, pitBounds.maxZ + 12, -4.2);

  // Visual Ground Base (excluding pit opening via 4 visual ground quads around pit)
  const asphaltBaseMat = new THREE.MeshStandardMaterial({
    color: 0x262930,
    roughness: 0.85,
    metalness: 0.08,
  });

  const makeGroundQuad = (minX: number, maxX: number, minZ: number, maxZ: number, y: number, mat: THREE.Material) => {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((minX + maxX) / 2, y, (minZ + maxZ) / 2);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  makeGroundQuad(-240, pitBounds.minX, -240, 220, 0, asphaltBaseMat);
  makeGroundQuad(pitBounds.maxX, 225, -240, 220, 0, asphaltBaseMat);
  makeGroundQuad(pitBounds.minX, pitBounds.maxX, -240, pitBounds.minZ, 0, asphaltBaseMat);
  makeGroundQuad(pitBounds.minX, pitBounds.maxX, pitBounds.maxZ, 220, 0, asphaltBaseMat);

  // Ocean Water surrounding East & South coast (extends far to horizon so there's never an empty void)
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b4f6c,
    roughness: 0.16,
    metalness: 0.2,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
  });
  const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(160, -0.65, 160);
  group.add(waterMesh);

  // Beach Sand Strip along East (x: 195..238) & South (z: 192..230)
  const sandMat = new THREE.MeshStandardMaterial({
    map: textures.sand,
    roughness: 0.92,
    metalness: 0.02,
  });
  makeGroundQuad(194, 240, -140, 232, 0.02, sandMat);
  makeGroundQuad(-190, 240, 192, 232, 0.02, sandMat);

  // Wooden Sunset Pier extending over the ocean
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x7c5333, roughness: 0.85 });
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(58, 0.45, 9), pierMat);
  pierDeck.position.set(252, 0.85, 90);
  pierDeck.receiveShadow = true;
  pierDeck.castShadow = true;
  group.add(pierDeck);
  addPhysicsBox(252, 0.6, 90, 58, 0.9, 9, false);
  for (let px = 228; px <= 278; px += 10) {
    for (const pz of [86.2, 93.8]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 2.4, 8), pierMat);
      post.position.set(px, -0.1, pz);
      group.add(post);
    }
  }

  // Materials for Roads & Sidewalks
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltRoad,
    roughness: 0.72,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const intersectionMat = new THREE.MeshStandardMaterial({
    map: textures.intersectionRoad,
    roughness: 0.72,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalk,
    roughness: 0.84,
    metalness: 0.04,
  });

  // Render Road Segments between intersections
  const roadSegGeoNS = new THREE.PlaneGeometry(ROAD_WIDTH, 60 - ROAD_WIDTH);
  const roadSegGeoEW = new THREE.PlaneGeometry(60 - ROAD_WIDTH, ROAD_WIDTH);
  const interGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_WIDTH);

  for (let i = 0; i < ROAD_COORDS.length; i++) {
    const rx = ROAD_COORDS[i];
    for (let j = 0; j < ROAD_COORDS.length; j++) {
      const rz = ROAD_COORDS[j];
      // Intersection
      const inter = new THREE.Mesh(interGeo, intersectionMat);
      inter.rotation.x = -Math.PI / 2;
      inter.position.set(rx, 0.04, rz);
      inter.receiveShadow = true;
      group.add(inter);

      // NS segment north of intersection
      if (j < ROAD_COORDS.length - 1) {
        const segNS = new THREE.Mesh(roadSegGeoNS, asphaltMat);
        segNS.rotation.x = -Math.PI / 2;
        segNS.position.set(rx, 0.03, (rz + ROAD_COORDS[j + 1]) / 2);
        segNS.receiveShadow = true;
        group.add(segNS);
      }

      // EW segment east of intersection
      if (i < ROAD_COORDS.length - 1) {
        const segEW = new THREE.Mesh(roadSegGeoEW, asphaltMat);
        segEW.rotation.x = -Math.PI / 2;
        segEW.rotation.z = Math.PI / 2;
        segEW.position.set((rx + ROAD_COORDS[i + 1]) / 2, 0.03, rz);
        segEW.receiveShadow = true;
        group.add(segEW);
      }
    }
  }

  // Lamp bulb shared emissive material (toggled by day-night cycle)
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfde68a,
    emissiveIntensity: 0.1,
    roughness: 0.2,
  });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.5, metalness: 0.7 });

  // Instanced Streetlights along main avenues
  const polePositions: Array<{ x: number; z: number }> = [];
  for (const rx of [-120, -60, 0, 60, 120]) {
    for (let z = -160; z <= 160; z += 30) {
      if (ROAD_COORDS.some((rc) => Math.abs(z - rc) < 11)) continue;
      polePositions.push({ x: rx + 8.2, z });
      polePositions.push({ x: rx - 8.2, z });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.11, 0.16, 6.2, 8);
  const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, polePositions.length);
  const bulbGeo = new THREE.SphereGeometry(0.28, 8, 8);
  const bulbInst = new THREE.InstancedMesh(bulbGeo, lampBulbMat, polePositions.length);
  const dummy = new THREE.Object3D();
  polePositions.forEach((p, idx) => {
    dummy.position.set(p.x, 3.1, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(p.x, 6.25, p.z);
    dummy.updateMatrix();
    bulbInst.setMatrixAt(idx, dummy.matrix);
  });
  poleInst.computeBoundingSphere();
  bulbInst.computeBoundingSphere();
  group.add(poleInst, bulbInst);

  // Selective real PointLights for downtown & main intersections at night (keep <= 8 for performance!)
  const nightLightCoords = [
    { x: 0, z: 0 },
    { x: -60, z: 0 },
    { x: 60, z: 0 },
    { x: 0, z: -60 },
    { x: 0, z: 60 },
    { x: -60, z: 60 },
  ];
  for (const c of nightLightCoords) {
    const pl = new THREE.PointLight(0xffdfa8, 0, 48, 1.5);
    pl.position.set(c.x + 8, 7.2, c.z + 8);
    group.add(pl);
    streetLights.push(pl);
  }

  // Traffic Light poles at key central intersections
  const tlIntersections = [
    { x: -60, z: -60 },
    { x: 0, z: -60 },
    { x: 60, z: -60 },
    { x: -60, z: 0 },
    { x: 0, z: 0 },
    { x: 60, z: 0 },
    { x: -60, z: 60 },
    { x: 0, z: 60 },
    { x: 60, z: 60 },
  ];
  for (const pos of tlIntersections) {
    const tlGroup = new THREE.Group();
    tlGroup.position.set(pos.x + 8.5, 0, pos.z + 8.5);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.2, 8), poleMat);
    mast.position.y = 2.6;
    tlGroup.add(mast);

    const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.35, 0.75), poleMat);
    headBox.position.y = 4.9;
    tlGroup.add(headBox);

    const makeSignal = (color: number, xOff: number, yOff: number, zOff: number) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 })
      );
      m.position.set(xOff, yOff, zOff);
      tlGroup.add(m);
      return m;
    };

    const nsRedMesh = makeSignal(0xef4444, 0, 5.2, 0.4);
    const nsGreenMesh = makeSignal(0x22c55e, 0, 4.65, 0.4);
    const ewRedMesh = makeSignal(0xef4444, -0.4, 5.2, 0);
    const ewGreenMesh = makeSignal(0x22c55e, -0.4, 4.65, 0);

    group.add(tlGroup);
    trafficLights.push({
      x: pos.x,
      z: pos.z,
      nsRedMesh,
      nsGreenMesh,
      ewRedMesh,
      ewGreenMesh,
    });
  }

  // Materials for Buildings
  const glassFacadeMat = new THREE.MeshStandardMaterial({
    map: textures.buildingGlass,
    emissiveMap: textures.buildingGlassEmissive,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.08,
    roughness: 0.25,
    metalness: 0.55,
  });
  const resFacadeMat = new THREE.MeshStandardMaterial({
    map: textures.buildingResidential,
    emissiveMap: textures.buildingResidentialEmissive,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.08,
    roughness: 0.78,
    metalness: 0.08,
  });
  buildingWindowMats.push(glassFacadeMat, resFacadeMat);

  const concreteTrimMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.7, metalness: 0.2 });
  const industrialMat = new THREE.MeshStandardMaterial({
    map: textures.industrialMetal,
    roughness: 0.55,
    metalness: 0.45,
  });

  // Helper to build a raised sidewalk pad for a city block
  const addBlockPad = (cx: number, cz: number, w = 45.5, d = 45.5, customMat?: THREE.Material) => {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), customMat ?? sidewalkMat);
    pad.position.set(cx, 0.11, cz);
    pad.receiveShadow = true;
    group.add(pad);
  };

  // Helper to build a multi-part skyscraper (3-6 parts: podium, tower, setback crown, antenna)
  const addSkyscraper = (x: number, z: number, w: number, d: number, h: number, tint = 0xffffff) => {
    const mat = glassFacadeMat.clone();
    mat.color.setHex(tint);
    buildingWindowMats.push(mat);

    const podiumH = Math.min(8, h * 0.22);
    const podium = new THREE.Mesh(new THREE.BoxGeometry(w + 2, podiumH, d + 2), concreteTrimMat);
    podium.position.set(x, podiumH / 2 + 0.2, z);
    podium.castShadow = !isSoftwareGl;
    podium.receiveShadow = true;
    group.add(podium);

    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    tower.position.set(x, h / 2 + 0.2, z);
    tower.castShadow = !isSoftwareGl;
    tower.receiveShadow = true;
    group.add(tower);

    const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 3.2, d * 0.72), concreteTrimMat);
    crown.position.set(x, h + 1.8, z);
    group.add(crown);

    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.4, 8, 6), concreteTrimMat);
    spire.position.set(x, h + 7.4, z);
    group.add(spire);

    addPhysicsBox(x, h / 2, z, w + 1.5, h + 2, d + 1.5, true);
  };

  // Helper for residential apartment / house
  const addResidentialBuilding = (x: number, z: number, w: number, d: number, h: number, tint = 0xffffff) => {
    const mat = resFacadeMat.clone();
    mat.color.setHex(tint);
    buildingWindowMats.push(mat);

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.set(x, h / 2 + 0.2, z);
    body.castShadow = !isSoftwareGl;
    body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.65, d + 0.8), concreteTrimMat);
    roof.position.set(x, h + 0.5, z);
    group.add(roof);

    addPhysicsBox(x, h / 2, z, w, h + 1, d, true);
  };

  // Collect tree/palm instances to batch into InstancedMesh
  const treeCoords: Array<{ x: number; y: number; z: number; scale: number }> = [];
  const palmCoords: Array<{ x: number; y: number; z: number; scale: number }> = [];

  // Iterate 6x6 blocks between ROAD_COORDS
  // Block centers: -150, -90, -30, 30, 90, 150
  const blockCenters = [-150, -90, -30, 30, 90, 150];

  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      // Special Landmarks assigned to exact blocks:
      // 1. Underground Parking Pit at (90, 90)
      if (bx === 90 && bz === 90) {
        // Build Underground Parking Garage with open entrance ramp on West side
        const ugGroup = new THREE.Group();
        const floorMat = new THREE.MeshStandardMaterial({ map: textures.concreteGarage, roughness: 0.78 });
        const ugFloor = new THREE.Mesh(new THREE.BoxGeometry(36, 0.4, 36), floorMat);
        ugFloor.position.set(90, -4.4, 90);
        ugFloor.receiveShadow = true;
        ugGroup.add(ugFloor);

        // Retaining walls around pit (North, East, South; West has ramp!)
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.85 });
        const nWall = new THREE.Mesh(new THREE.BoxGeometry(36, 4.6, 1.2), wallMat);
        nWall.position.set(90, -2.1, 73);
        const sWall = new THREE.Mesh(new THREE.BoxGeometry(36, 4.6, 1.2), wallMat);
        sWall.position.set(90, -2.1, 107);
        const eWall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.6, 36), wallMat);
        eWall.position.set(107, -2.1, 90);
        ugGroup.add(nWall, sWall, eWall);
        addPhysicsBox(90, -2.1, 73, 36, 4.6, 1.2, true);
        addPhysicsBox(90, -2.1, 107, 36, 4.6, 1.2, true);
        addPhysicsBox(107, -2.1, 90, 1.2, 4.6, 36, true);

        // Sloped drivable ramp on West side from x=72 (y=0) down to x=88 (y=-4.2)
        const rampLen = Math.hypot(16, 4.2);
        const rampSlope = Math.atan2(4.2, 16);
        const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.5, 11), floorMat);
        rampMesh.position.set(80, -2.15, 90);
        rampMesh.rotation.z = -rampSlope;
        rampMesh.receiveShadow = true;
        ugGroup.add(rampMesh);

        const rampBody = new CANNON.Body({ mass: 0, material: staticPhysicsMat });
        rampBody.addShape(new CANNON.Box(new CANNON.Vec3(rampLen / 2, 0.35, 5.5)));
        rampBody.position.set(80, -2.2, 90);
        rampBody.quaternion.setFromEuler(0, 0, -rampSlope);
        world.addBody(rampBody);

        // Partial roof overhang on East half with glowing light strips
        const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 34), wallMat);
        roofDeck.position.set(98, 0.1, 90);
        ugGroup.add(roofDeck);

        const stripMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
        for (const sz of [82, 90, 98]) {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(12, 0.12, 0.5), stripMat);
          strip.position.set(96, -0.25, sz);
          ugGroup.add(strip);
        }

        const ugLight = new THREE.PointLight(0xdbeafe, 2.2, 36, 1.4);
        ugLight.position.set(96, -1.0, 90);
        ugGroup.add(ugLight);
        undergroundLights.push(ugLight);

        // Signpost "P"
        const signPost = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.4 }));
        signPost.position.set(70, 2.2, 82);
        ugGroup.add(signPost);

        group.add(ugGroup);
        continue;
      }

      addBlockPad(bx, bz);

      // 2. Central City Park at (30, 30)
      if (bx === 30 && bz === 30) {
        const parkLawn = new THREE.Mesh(
          new THREE.BoxGeometry(42, 0.28, 42),
          new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 0.9 })
        );
        parkLawn.position.set(30, 0.18, 30);
        parkLawn.receiveShadow = true;
        group.add(parkLawn);

        // Fountain
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6, 0.7, 20), concreteTrimMat);
        basin.position.set(30, 0.55, 30);
        const waterPool = new THREE.Mesh(
          new THREE.CylinderGeometry(4.9, 4.9, 0.45, 20),
          new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, roughness: 0.1, clearcoat: 1 })
        );
        waterPool.position.set(30, 0.72, 30);
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 2.8, 12), concreteTrimMat);
        pillar.position.set(30, 1.8, 30);
        group.add(basin, waterPool, pillar);
        addPhysicsBox(30, 1.0, 30, 11, 2, 11, true);

        for (const [tx, tz] of [
          [16, 16],
          [44, 16],
          [16, 44],
          [44, 44],
          [18, 30],
          [42, 30],
        ]) {
          treeCoords.push({ x: tx, y: 0.25, z: tz, scale: 1.15 });
        }
        continue;
      }

      // 3. Metro Shopping Mall at (-30, 30)
      if (bx === -30 && bz === 30) {
        const mallBase = new THREE.Mesh(
          new THREE.BoxGeometry(36, 10, 30),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5, metalness: 0.15 })
        );
        mallBase.position.set(-30, 5.2, 32);
        mallBase.castShadow = !isSoftwareGl;
        mallBase.receiveShadow = true;
        const atrium = new THREE.Mesh(
          new THREE.BoxGeometry(16, 13.5, 16),
          glassFacadeMat
        );
        atrium.position.set(-30, 7, 32);
        const sign = new THREE.Mesh(
          new THREE.BoxGeometry(16, 2.2, 0.6),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.6 })
        );
        sign.position.set(-30, 11.5, 16.8);
        group.add(mallBase, atrium, sign);
        addPhysicsBox(-30, 5.5, 32, 36, 11, 30, true);
        continue;
      }

      // 4. LCPD Police Station at (-90, 30)
      if (bx === -90 && bz === 30) {
        const hq = new THREE.Mesh(
          new THREE.BoxGeometry(30, 12, 24),
          new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.2 })
        );
        hq.position.set(-90, 6.2, 32);
        hq.castShadow = !isSoftwareGl;
        const blueBand = new THREE.Mesh(
          new THREE.BoxGeometry(30.4, 1.4, 24.4),
          new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x1d4ed8, emissiveIntensity: 0.55 })
        );
        blueBand.position.set(-90, 11.8, 32);
        const helipad = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.2, 20), concreteTrimMat);
        helipad.position.set(-90, 12.3, 32);
        group.add(hq, blueBand, helipad);
        addPhysicsBox(-90, 6.2, 32, 30, 12.5, 24, true);
        continue;
      }

      // 5. City General Hospital at (90, -30)
      if (bx === 90 && bz === -30) {
        const hosp = new THREE.Mesh(
          new THREE.BoxGeometry(30, 15, 26),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.1 })
        );
        hosp.position.set(90, 7.7, -30);
        hosp.castShadow = !isSoftwareGl;
        const crossMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.7 });
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5.2, 0.4), crossMat);
        crossV.position.set(90, 11.5, -16.8);
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.5, 0.4), crossMat);
        crossH.position.set(90, 11.5, -16.8);
        group.add(hosp, crossV, crossH);
        addPhysicsBox(90, 7.7, -30, 30, 15.5, 26, true);
        continue;
      }

      // 6. Car Dealership & Repair Garage at (-30, 90)
      if (bx === -30 && bz === 90) {
        const showroom = new THREE.Mesh(
          new THREE.BoxGeometry(24, 7.5, 18),
          new THREE.MeshPhysicalMaterial({ color: 0x93c5fd, roughness: 0.12, transparent: true, opacity: 0.55 })
        );
        showroom.position.set(-34, 4, 92);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(25, 0.8, 19), concreteTrimMat);
        roof.position.set(-34, 8.1, 92);
        const garageBay = new THREE.Mesh(new THREE.BoxGeometry(14, 5.5, 16), industrialMat);
        garageBay.position.set(-16, 2.9, 92);
        const repairStrip = new THREE.Mesh(
          new THREE.BoxGeometry(8, 0.1, 8),
          new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.45 })
        );
        repairStrip.position.set(-16, 0.25, 76);
        group.add(showroom, roof, garageBay, repairStrip);
        addPhysicsBox(-34, 4, 92, 24, 8, 18, true);
        addPhysicsBox(-16, 3, 92, 14, 6, 16, true);
        continue;
      }

      // 7. Gas Station at (90, 30)
      if (bx === 90 && bz === 30) {
        const canopy = new THREE.Mesh(
          new THREE.BoxGeometry(22, 0.9, 14),
          new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 })
        );
        canopy.position.set(90, 5.4, 30);
        for (const px of [82, 98]) {
          for (const pz of [25, 35]) {
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 5.2, 8), concreteTrimMat);
            col.position.set(px, 2.7, pz);
            group.add(col);
          }
        }
        for (const px of [86, 94]) {
          const pump = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.4 }));
          pump.position.set(px, 1.1, 30);
          group.add(pump);
          addPhysicsBox(px, 1.1, 30, 1.2, 2, 1.0, true);
        }
        const store = new THREE.Mesh(new THREE.BoxGeometry(16, 4.5, 9), resFacadeMat);
        store.position.set(90, 2.4, 43);
        group.add(canopy, store);
        addPhysicsBox(90, 2.4, 43, 16, 4.8, 9, true);
        continue;
      }

      // 8. Downtown Skyscrapers at (-30,-30), (30,-30), (-30, -30) neighbors
      if ((bx === -30 && bz === -30) || (bx === 30 && bz === -30) || (bx === -90 && bz === -30)) {
        const h1 = 36 + rand() * 34;
        const h2 = 24 + rand() * 24;
        addSkyscraper(bx - 10, bz - 8, 16, 16, h1, bx === -30 && bz === -30 ? 0xdbeafe : 0xe2e8f0);
        addSkyscraper(bx + 11, bz + 9, 15, 15, h2, 0xcbd5e1);
        continue;
      }

      // 9. Industrial Docks & Safehouse at x <= -90 and z >= 90
      if (bx <= -90 && bz >= 90) {
        const wh = new THREE.Mesh(new THREE.BoxGeometry(26, 8.5, 18), industrialMat);
        wh.position.set(bx - 5, 4.4, bz);
        wh.castShadow = !isSoftwareGl;
        wh.receiveShadow = true;
        group.add(wh);
        addPhysicsBox(bx - 5, 4.4, bz, 26, 8.5, 18, true);

        const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 18, 10), concreteTrimMat);
        stack.position.set(bx + 14, 9.2, bz - 10);
        group.add(stack);
        addPhysicsBox(bx + 14, 9.2, bz - 10, 3, 18, 3, true);

        const containerColors = [0xb91c1c, 0x0369a1, 0xd97706, 0x15803d];
        const cont = new THREE.Mesh(
          new THREE.BoxGeometry(10, 3.2, 3.4),
          new THREE.MeshStandardMaterial({ color: containerColors[Math.floor(rand() * 4)], roughness: 0.6, metalness: 0.35 })
        );
        cont.position.set(bx + 10, 1.8, bz + 12);
        group.add(cont);
        addPhysicsBox(bx + 10, 1.8, bz + 12, 10, 3.2, 3.4, true);
        continue;
      }

      // 10. Airport Zone at (90..150, -150..-90) — leave runway clear!
      if (bx >= 90 && bz <= -90) {
        continue;
      }

      // 11. Elevated Highway Corridor at bx === 150 — keep center clear for overpass pillars
      if (bx === 150 && bz >= -90 && bz <= 150) {
        addResidentialBuilding(bx + 14, bz, 12, 18, 14 + rand() * 10, 0xd4d4d8);
        continue;
      }

      // 12. Residential Suburbs & Mid-rise Apartments
      const count = 2;
      for (let k = 0; k < count; k++) {
        const ox = k === 0 ? -10 : 10;
        const oz = k === 0 ? -8 : 10;
        const h = 9 + rand() * 14;
        const tints = [0xe7e5e4, 0xfef3c7, 0xdbeafe, 0xfecdd3, 0xd1fae5];
        addResidentialBuilding(bx + ox, bz + oz, 15, 15, h, tints[Math.floor(rand() * tints.length)]);
      }
      treeCoords.push({ x: bx + 15, y: 0.22, z: bz - 15, scale: 0.95 });
    }
  }

  // International Airport (East-North coastal tarmac: x: 82..205, z: -205..-132)
  const airportPad = new THREE.Mesh(
    new THREE.BoxGeometry(128, 0.24, 72),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.82 })
  );
  airportPad.position.set(142, 0.12, -168);
  airportPad.receiveShadow = true;
  group.add(airportPad);

  const runwayMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 114),
    new THREE.MeshStandardMaterial({ map: textures.runway, roughness: 0.7 })
  );
  runwayMesh.rotation.x = -Math.PI / 2;
  runwayMesh.rotation.z = Math.PI / 2;
  runwayMesh.position.set(145, 0.27, -172);
  runwayMesh.receiveShadow = true;
  group.add(runwayMesh);

  // Airport Control Tower
  const towerShaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 22, 10), concreteTrimMat);
  towerShaft.position.set(96, 11, -142);
  const towerCab = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 3.6, 4.2, 10), glassFacadeMat);
  towerCab.position.set(96, 23, -142);
  group.add(towerShaft, towerCab);
  addPhysicsBox(96, 12, -142, 6, 24, 6, true);

  // Airport Hangar
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(24, 10, 20), industrialMat);
  hangar.position.set(118, 5.1, -142);
  group.add(hangar);
  addPhysicsBox(118, 5.1, -142, 24, 10, 20, true);

  // Parked Passenger Jet on tarmac
  const jetGroup = new THREE.Group();
  const fuselageMat = new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.4, clearcoat: 0.8 });
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 20, 14), fuselageMat);
  fuselage.rotation.z = Math.PI / 2;
  fuselage.position.y = 2.6;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.7, 4.2, 14), fuselageMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(12.1, 2.6, 0);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 19), fuselageMat);
  wing.position.set(0.5, 2.2, 0);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.2, 0.35), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }));
  tailFin.position.set(-8.6, 5.2, 0);
  jetGroup.add(fuselage, nose, wing, tailFin);
  jetGroup.position.set(162, 0, -146);
  group.add(jetGroup);
  addPhysicsBox(162, 3, -146, 22, 6, 18, true);

  // Elevated Highway Overpass + Coastal Bridge along x = 148 (y = 6.2)
  const hwMat = new THREE.MeshStandardMaterial({ color: 0x2e323b, roughness: 0.76 });
  const hwDeck = new THREE.Mesh(new THREE.BoxGeometry(12, 0.8, 170), hwMat);
  hwDeck.position.set(148, 6.0, 0);
  hwDeck.castShadow = !isSoftwareGl;
  hwDeck.receiveShadow = true;
  group.add(hwDeck);
  addGroundSlab(142, 154, -85, 85, 6.4);

  // Highway safety barriers
  for (const bxSide of [142.3, 153.7]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 170), concreteTrimMat);
    rail.position.set(bxSide, 6.85, 0);
    group.add(rail);
    addPhysicsBox(bxSide, 6.85, 0, 0.5, 1.0, 170, false);
  }
  // Pillars
  for (let pz = -75; pz <= 75; pz += 30) {
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 6.0, 10), concreteTrimMat);
    pil.position.set(148, 3.0, pz);
    group.add(pil);
  }
  // North & South Ramps for Elevated Highway (z: -125..-85 and z: 85..125)
  const hwRampLen = Math.hypot(40, 6.4);
  const hwRampAngle = Math.atan2(6.4, 40);
  const makeHwRamp = (zCenter: number, sign: number) => {
    const rMesh = new THREE.Mesh(new THREE.BoxGeometry(12, 0.7, hwRampLen), hwMat);
    rMesh.position.set(148, 3.0, zCenter);
    rMesh.rotation.x = sign * hwRampAngle;
    rMesh.receiveShadow = true;
    group.add(rMesh);

    const rBody = new CANNON.Body({ mass: 0, material: staticPhysicsMat });
    rBody.addShape(new CANNON.Box(new CANNON.Vec3(6, 0.4, hwRampLen / 2)));
    rBody.position.set(148, 3.05, zCenter);
    rBody.quaternion.setFromEuler(sign * hwRampAngle, 0, 0);
    world.addBody(rBody);
  };
  makeHwRamp(-105, -1); // climbs going +Z (-125 -> -85)
  makeHwRamp(105, 1);   // descends going +Z (85 -> 125)

  // Mountain Ridge & Winding Mountain Road on North-West corner (x: -245..-195, z: -245..-145)
  const mountainMat = new THREE.MeshStandardMaterial({ color: 0x4b5548, roughness: 0.92 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x646b65, roughness: 0.88 });
  const peakDefs = [
    { x: -238, z: -220, r: 44, h: 36 },
    { x: -195, z: -232, r: 38, h: 30 },
    { x: -242, z: -170, r: 36, h: 28 },
    { x: -245, z: -110, r: 34, h: 22 },
  ];
  for (const pk of peakDefs) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(pk.r, pk.h, 9), mountainMat);
    cone.position.set(pk.x, pk.h / 2 - 1, pk.z);
    cone.castShadow = !isSoftwareGl;
    cone.receiveShadow = true;
    group.add(cone);
  }
  // Mountain Scenic Overlook Platform & Drivable Switchback Ramp at x = -205, z = -195 (climbs from z=-145 y=0 up to z=-195 y=11)
  const mtnRoadLen = Math.hypot(50, 11);
  const mtnAngle = Math.atan2(11, 50);
  const mtnRampMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, mtnRoadLen), hwMat);
  mtnRampMesh.position.set(-206, 5.2, -170);
  mtnRampMesh.rotation.x = mtnAngle;
  mtnRampMesh.receiveShadow = true;
  group.add(mtnRampMesh);
  const mtnRampBody = new CANNON.Body({ mass: 0, material: staticPhysicsMat });
  mtnRampBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 0.5, mtnRoadLen / 2)));
  mtnRampBody.position.set(-206, 5.2, -170);
  mtnRampBody.quaternion.setFromEuler(mtnAngle, 0, 0);
  world.addBody(mtnRampBody);

  const overlookDeck = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 20), rockMat);
  overlookDeck.position.set(-206, 10.2, -205);
  overlookDeck.receiveShadow = true;
  group.add(overlookDeck);
  addGroundSlab(-217, -195, -215, -195, 10.8);

  // Palm Trees along Sunset Beach
  for (let bz = -100; bz <= 185; bz += 24) {
    palmCoords.push({ x: 204 + (bz % 3) * 3, y: 0.02, z: bz, scale: 1.0 });
  }
  for (let bx = -140; bx <= 185; bx += 28) {
    palmCoords.push({ x: bx, y: 0.02, z: 204, scale: 1.0 });
  }

  // Instanced City Trees (trunk + canopy)
  if (treeCoords.length > 0) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e6f34, roughness: 0.8 });
    const trunkInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.38, 2.8, 7), trunkMat, treeCoords.length);
    const leafInst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(2.1, 1), leafMat, treeCoords.length);
    const tintColor = new THREE.Color();
    treeCoords.forEach((tc, i) => {
      dummy.position.set(tc.x, tc.y + 1.4 * tc.scale, tc.z);
      dummy.scale.setScalar(tc.scale);
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tc.x, tc.y + 3.6 * tc.scale, tc.z);
      dummy.updateMatrix();
      leafInst.setMatrixAt(i, dummy.matrix);
      tintColor.setHSL(0.32 + (i % 5) * 0.015, 0.48, 0.3 + (i % 3) * 0.05);
      leafInst.setColorAt(i, tintColor);
    });
    trunkInst.computeBoundingSphere();
    leafInst.computeBoundingSphere();
    group.add(trunkInst, leafInst);
  }

  // Instanced Palm Trees
  if (palmCoords.length > 0) {
    const pTrunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6b4e, roughness: 0.88 });
    const pLeafMat = new THREE.MeshStandardMaterial({ color: 0x3b8c3b, roughness: 0.75 });
    const pTrunkInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.36, 5.5, 7), pTrunkMat, palmCoords.length);
    const pCrownInst = new THREE.InstancedMesh(new THREE.ConeGeometry(2.6, 1.4, 7), pLeafMat, palmCoords.length);
    palmCoords.forEach((pc, i) => {
      dummy.position.set(pc.x, pc.y + 2.75, pc.z);
      dummy.rotation.set(0.06 * ((i % 3) - 1), i * 1.1, 0.05);
      dummy.scale.setScalar(pc.scale);
      dummy.updateMatrix();
      pTrunkInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(pc.x, pc.y + 5.7, pc.z);
      dummy.rotation.set(0, i * 1.1, 0);
      dummy.updateMatrix();
      pCrownInst.setMatrixAt(i, dummy.matrix);
    });
    pTrunkInst.computeBoundingSphere();
    pCrownInst.computeBoundingSphere();
    group.add(pTrunkInst, pCrownInst);
  }

  // World Perimeter invisible walls so player doesn't drive off into endless ocean
  addPhysicsBox(0, 5, -238, 520, 12, 4, false);
  addPhysicsBox(0, 5, 236, 520, 12, 4, false);
  addPhysicsBox(-238, 5, 0, 4, 12, 520, false);
  addPhysicsBox(290, 5, 0, 4, 12, 520, false);

  const landmarks: LandmarkDef[] = [
    { id: 'downtown', name: 'Downtown Skyline Plaza', district: 'Downtown', x: 0, y: 0, z: 0, color: '#38bdf8' },
    { id: 'dealership', name: 'Apex Dealership & Garage', district: 'South Midtown', x: -16, y: 0, z: 70, color: '#f59e0b' },
    { id: 'mall', name: 'Metro Shopping Mall', district: 'Midtown West', x: -30, y: 0, z: 12, color: '#ec4899' },
    { id: 'police_hq', name: 'LCPD Central Station', district: 'West Precinct', x: -90, y: 0, z: 12, color: '#3b82f6' },
    { id: 'hospital', name: 'City General Hospital', district: 'East Medical', x: 90, y: 0, z: -12, color: '#ef4444' },
    { id: 'park', name: 'Central Fountain Park', district: 'Central Park', x: 30, y: 0, z: 12, color: '#22c55e' },
    { id: 'gas_station', name: 'RedStar Gas & Boost', district: 'Eastside', x: 90, y: 0, z: 20, color: '#f97316' },
    { id: 'underground', name: 'Underground Parking', district: 'Sub-Level P1', x: 94, y: -4.2, z: 90, color: '#a855f7' },
    { id: 'airport', name: 'International Airport', district: 'Airport Tarmac', x: 138, y: 0, z: -165, color: '#06b6d4' },
    { id: 'beach', name: 'Sunset Beach Pier', district: 'Sunset Coast', x: 245, y: 0.9, z: 90, color: '#eab308' },
    { id: 'industrial', name: 'Industrial Docks Safehouse', district: 'Industrial Docks', x: -120, y: 0, z: 120, color: '#84cc16' },
    { id: 'mountain', name: 'North Peak Overlook', district: 'Mountain Ridge', x: -206, y: 10.8, z: -205, color: '#14b8a6' },
  ];

  const collectibleSpawns = [
    { id: 'col_downtown', name: 'Skyline Gold Key', x: -14, y: 0.3, z: -14, color: 0xfacc15 },
    { id: 'col_underground', name: 'Sub-Level Vault Chip', x: 98, y: -4.2, z: 92, color: 0xa855f7 },
    { id: 'col_mountain', name: 'Summit Relic', x: -206, y: 10.8, z: -206, color: 0x14b8a6 },
    { id: 'col_pier', name: 'Ocean Pier Case', x: 274, y: 1.05, z: 90, color: 0x38bdf8 },
    { id: 'col_airport', name: 'Runway Blackbox', x: 175, y: 0.25, z: -172, color: 0x06b6d4 },
    { id: 'col_industrial', name: 'Dockyard Stash', x: -130, y: 0.25, z: 136, color: 0x84cc16 },
  ];

  const getDistrictAt = (x: number, z: number): string => {
    if (x > 74 && x < 108 && z > 74 && z < 108) return 'Underground Parking';
    if (x < -185 && z < -140) return 'Mountain Ridge';
    if (x > 80 && z < -130) return 'International Airport';
    if (x > 192 || z > 190) return 'Sunset Beach';
    if (x < -80 && z > 75) return 'Industrial Docks';
    if (Math.abs(x) < 65 && Math.abs(z) < 65) return 'Downtown';
    if (z < -65) return 'Residential North';
    if (x > 65) return 'Eastside';
    return 'Midtown';
  };

  const groundHeightAt = (x: number, z: number, currentY = 0): number => {
    // Underground Parking pit & ramp
    if (x >= 72 && x <= 108 && z >= 72 && z <= 108) {
      if (x < 88 && z >= 83 && z <= 97) {
        const t = THREE.MathUtils.clamp((x - 72) / 16, 0, 1);
        return -4.2 * t;
      }
      return -4.2;
    }
    // Mountain Overlook & Switchback Ramp
    if (x >= -218 && x <= -194 && z >= -216 && z <= -195) {
      return 10.8;
    }
    if (x >= -212 && x <= -200 && z >= -195 && z <= -145) {
      const t = THREE.MathUtils.clamp((-145 - z) / 50, 0, 1);
      return 10.8 * t;
    }
    // Elevated Highway deck & ramps when above ground
    if (x >= 142 && x <= 154) {
      if (z >= -85 && z <= 85 && currentY > 3.2) return 6.4;
      if (z >= -125 && z < -85 && currentY > 0.2) {
        const t = THREE.MathUtils.clamp((z - -125) / 40, 0, 1);
        return 6.4 * t;
      }
      if (z > 85 && z <= 125 && currentY > 0.2) {
        const t = THREE.MathUtils.clamp((125 - z) / 40, 0, 1);
        return 6.4 * t;
      }
    }
    // Sunset Pier
    if (x >= 223 && x <= 281 && z >= 85.5 && z <= 94.5) {
      return 1.05;
    }
    return 0;
  };

  scene.add(group);

  return {
    group,
    colliders,
    landmarks,
    trafficLights,
    waterMesh,
    buildingWindowMats,
    lampBulbMat,
    streetLights,
    undergroundLights,
    asphaltMat,
    intersectionMat,
    collectibleSpawns,
    getDistrictAt,
    groundHeightAt,
  };
}
