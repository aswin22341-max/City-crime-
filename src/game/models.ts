import * as THREE from 'three';
import type { VehicleCategory, VehicleSpec } from './types';

export const VEHICLE_SPECS: Record<VehicleCategory, VehicleSpec> = {
  sports: {
    category: 'sports',
    name: 'Vortex GT Coupe',
    maxSpeed: 185,
    accel: 34,
    brakeForce: 48,
    turnSpeed: 2.5,
    driftGrip: 0.91,
    mass: 1350,
    width: 2.05,
    height: 1.32,
    length: 4.5,
    color: 0xe11d48,
  },
  supercar: {
    category: 'supercar',
    name: 'Apex Hyperion V12',
    maxSpeed: 235,
    accel: 46,
    brakeForce: 56,
    turnSpeed: 2.75,
    driftGrip: 0.92,
    mass: 1220,
    width: 2.15,
    height: 1.2,
    length: 4.7,
    color: 0xf59e0b,
  },
  suv: {
    category: 'suv',
    name: 'Titan Expedition 4x4',
    maxSpeed: 145,
    accel: 25,
    brakeForce: 38,
    turnSpeed: 2.0,
    driftGrip: 0.94,
    mass: 2200,
    width: 2.25,
    height: 1.85,
    length: 4.9,
    color: 0x334155,
  },
  motorcycle: {
    category: 'motorcycle',
    name: 'Shadow R1000',
    maxSpeed: 205,
    accel: 42,
    brakeForce: 50,
    turnSpeed: 3.1,
    driftGrip: 0.93,
    mass: 260,
    width: 0.85,
    height: 1.15,
    length: 2.25,
    color: 0x06b6d4,
  },
  police: {
    category: 'police',
    name: 'LCPD Interceptor',
    maxSpeed: 195,
    accel: 38,
    brakeForce: 52,
    turnSpeed: 2.55,
    driftGrip: 0.92,
    mass: 1650,
    width: 2.08,
    height: 1.48,
    length: 4.75,
    color: 0x111827,
  },
  truck: {
    category: 'truck',
    name: 'IronHaul Freight',
    maxSpeed: 118,
    accel: 18,
    brakeForce: 30,
    turnSpeed: 1.55,
    driftGrip: 0.96,
    mass: 4200,
    width: 2.55,
    height: 2.85,
    length: 6.8,
    color: 0xb45309,
  },
  bus: {
    category: 'bus',
    name: 'Metro Transit Line',
    maxSpeed: 105,
    accel: 15,
    brakeForce: 28,
    turnSpeed: 1.35,
    driftGrip: 0.96,
    mass: 5800,
    width: 2.6,
    height: 3.1,
    length: 8.8,
    color: 0x0284c7,
  },
};

export interface ArticulatedCharacter {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  head: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  shadowPlane: THREE.Mesh;
}

export function createCharacterModel(
  jacketColor: number,
  pantsColor: number,
  skinColor: number,
  contactShadowTex: THREE.Texture,
  isPlayer = false
): ArticulatedCharacter {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);

  const jacketMat = new THREE.MeshStandardMaterial({
    color: jacketColor,
    roughness: 0.65,
    metalness: 0.08,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0xe4e4e7,
    roughness: 0.75,
    metalness: 0.02,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColor,
    roughness: 0.8,
    metalness: 0.04,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.55,
    metalness: 0.02,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.4,
    metalness: 0.15,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x1f1b18,
    roughness: 0.85,
    metalness: 0.05,
  });

  // Contact shadow on ground
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.03;
  group.add(shadowPlane);

  // Pelvis
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.26), pantsMat);
  pelvis.position.y = 0.88;
  pelvis.castShadow = true;
  bodyPivot.add(pelvis);

  // Torso jacket + inner collar
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.56, 0.28), jacketMat);
  torso.position.y = 1.24;
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  const chestDetail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.295), shirtMat);
  chestDetail.position.y = 1.24;
  bodyPivot.add(chestDetail);

  // Head + Hair + Sunglasses (for player)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
  head.position.y = 1.69;
  head.castShadow = true;
  bodyPivot.add(head);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.11, 0.3), hairMat);
  hair.position.set(0, 0.13, -0.01);
  head.add(hair);

  if (isPlayer) {
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.15,
      metalness: 0.85,
    });
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.06), visorMat);
    glasses.position.set(0, 0.03, 0.13);
    head.add(glasses);
  }

  // Left Arm
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.32, 1.47, 0);
  const lUpper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.46, 0.15), jacketMat);
  lUpper.position.y = -0.2;
  lUpper.castShadow = true;
  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.12), skinMat);
  lHand.position.y = -0.46;
  leftArm.add(lUpper, lHand);
  bodyPivot.add(leftArm);

  // Right Arm
  const rightArm = new THREE.Group();
  rightArm.position.set(0.32, 1.47, 0);
  const rUpper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.46, 0.15), jacketMat);
  rUpper.position.y = -0.2;
  rUpper.castShadow = true;
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.12), skinMat);
  rHand.position.y = -0.46;
  rightArm.add(rUpper, rHand);
  bodyPivot.add(rightArm);

  // Left Leg
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.12, 0.82, 0);
  const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.19), pantsMat);
  lLegMesh.position.y = -0.34;
  lLegMesh.castShadow = true;
  const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.27), shoeMat);
  lShoe.position.set(0, -0.74, 0.04);
  lShoe.castShadow = true;
  leftLeg.add(lLegMesh, lShoe);
  bodyPivot.add(leftLeg);

  // Right Leg
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.12, 0.82, 0);
  const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.19), pantsMat);
  rLegMesh.position.y = -0.34;
  rLegMesh.castShadow = true;
  const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.27), shoeMat);
  rShoe.position.set(0, -0.74, 0.04);
  rShoe.castShadow = true;
  rightLeg.add(rLegMesh, rShoe);
  bodyPivot.add(rightLeg);

  return {
    group,
    bodyPivot,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    shadowPlane,
  };
}

export interface VehicleVisual {
  group: THREE.Group;
  chassisGroup: THREE.Group;
  wheels: THREE.Group[];
  frontWheelSteerPivots: THREE.Group[];
  headlightMeshes: THREE.Mesh[];
  taillightMeshes: THREE.Mesh[];
  headlightSpots: THREE.SpotLight[];
  policeRedLight?: THREE.Mesh;
  policeBlueLight?: THREE.Mesh;
  paintMaterial: THREE.MeshPhysicalMaterial;
}

export function createVehicleModel(
  category: VehicleCategory,
  colorOverride?: number,
  contactShadowTex?: THREE.Texture,
  enableSpotLights = false
): VehicleVisual {
  const spec = VEHICLE_SPECS[category];
  const color = colorOverride ?? spec.color;
  const group = new THREE.Group();
  const chassisGroup = new THREE.Group();
  group.add(chassisGroup);

  const paintMaterial = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.65,
    roughness: 0.28,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.72,
    metalness: 0.18,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    roughness: 0.18,
    metalness: 0.92,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.72,
    clearcoat: 1.0,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x141416,
    roughness: 0.88,
    metalness: 0.05,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 0.2,
    roughness: 0.2,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.35,
    roughness: 0.25,
  });

  if (contactShadowTex) {
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.width * 1.45, spec.length * 1.2),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    group.add(shadow);
  }

  const wheels: THREE.Group[] = [];
  const frontWheelSteerPivots: THREE.Group[] = [];
  const headlightMeshes: THREE.Mesh[] = [];
  const taillightMeshes: THREE.Mesh[] = [];
  const headlightSpots: THREE.SpotLight[] = [];

  const addWheel = (x: number, y: number, z: number, radius: number, width: number, isFront: boolean) => {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(x, y, z);
    const spinGroup = new THREE.Group();

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, width + 0.02, 10),
      chromeMat
    );
    rim.rotation.z = Math.PI / 2;

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, width + 0.04, 8),
      darkTrimMat
    );
    hub.rotation.z = Math.PI / 2;

    spinGroup.add(tire, rim, hub);
    steerPivot.add(spinGroup);
    group.add(steerPivot);
    wheels.push(spinGroup);
    if (isFront) frontWheelSteerPivots.push(steerPivot);
  };

  let policeRedLight: THREE.Mesh | undefined;
  let policeBlueLight: THREE.Mesh | undefined;

  if (category === 'motorcycle') {
    // Sleek 2-wheel sport bike
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 1.35), darkTrimMat);
    frame.position.set(0, 0.58, 0);
    frame.castShadow = true;
    chassisGroup.add(frame);

    const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.95), paintMaterial);
    fairing.position.set(0, 0.72, 0.25);
    fairing.rotation.x = -0.18;
    fairing.castShadow = true;
    chassisGroup.add(fairing);

    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.52), paintMaterial);
    tank.position.set(0, 0.85, 0.12);
    chassisGroup.add(tank);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.62), darkTrimMat);
    seat.position.set(0, 0.79, -0.35);
    chassisGroup.add(seat);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.06), glassMat);
    windshield.position.set(0, 0.97, 0.65);
    windshield.rotation.x = 0.55;
    chassisGroup.add(windshield);

    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.74, 8), chromeMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 0.92, 0.54);
    chassisGroup.add(handlebar);

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.75, 10), chromeMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0.24, 0.42, -0.45);
    chassisGroup.add(exhaust);

    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.08), headlightMat.clone());
    hl.position.set(0, 0.76, 0.74);
    chassisGroup.add(hl);
    headlightMeshes.push(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.08), taillightMat.clone());
    tl.position.set(0, 0.76, -0.74);
    chassisGroup.add(tl);
    taillightMeshes.push(tl);

    addWheel(0, 0.34, 0.72, 0.34, 0.18, true);
    addWheel(0, 0.34, -0.72, 0.34, 0.22, false);
  } else if (category === 'bus') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.25, 8.6), paintMaterial);
    body.position.set(0, 1.55, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    chassisGroup.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.16, 8.4), new THREE.MeshStandardMaterial({ color: 0xe4e4e7, roughness: 0.5 }));
    roof.position.set(0, 2.72, 0);
    chassisGroup.add(roof);

    // AC pods on roof
    for (const zOff of [-2.0, 1.5]) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.24, 1.4), darkTrimMat);
      ac.position.set(0, 2.9, zOff);
      chassisGroup.add(ac);
    }

    // Panoramic windows band
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.85, 7.6), glassMat);
    sideGlass.position.set(0, 1.95, 0.1);
    chassisGroup.add(sideGlass);

    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(2.28, 1.15, 0.08), glassMat);
    frontGlass.position.set(0, 1.85, 4.3);
    chassisGroup.add(frontGlass);

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.3, 0.25), darkTrimMat);
    bumperF.position.set(0, 0.45, 4.32);
    chassisGroup.add(bumperF);

    for (const sx of [-0.9, 0.9]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.08), headlightMat.clone());
      hl.position.set(sx, 0.72, 4.32);
      chassisGroup.add(hl);
      headlightMeshes.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.08), taillightMat.clone());
      tl.position.set(sx, 0.85, -4.32);
      chassisGroup.add(tl);
      taillightMeshes.push(tl);
    }

    addWheel(-1.18, 0.5, 2.8, 0.5, 0.34, true);
    addWheel(1.18, 0.5, 2.8, 0.5, 0.34, true);
    addWheel(-1.18, 0.5, -2.6, 0.5, 0.34, false);
    addWheel(1.18, 0.5, -2.6, 0.5, 0.34, false);
  } else if (category === 'truck') {
    // Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.95, 2.3), paintMaterial);
    cab.position.set(0, 1.48, 1.85);
    cab.castShadow = true;
    chassisGroup.add(cab);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.78, 0.08), glassMat);
    windshield.position.set(0, 1.92, 3.01);
    chassisGroup.add(windshield);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.75, 0.1), chromeMat);
    grille.position.set(0, 1.05, 3.01);
    chassisGroup.add(grille);

    // Exhaust stacks
    for (const sx of [-1.05, 1.05]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), chromeMat);
      stack.position.set(sx, 2.1, 0.75);
      chassisGroup.add(stack);
    }

    // Flatbed & Cargo Container
    const chassisRail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.34, 6.5), darkTrimMat);
    chassisRail.position.set(0, 0.65, -0.1);
    chassisGroup.add(chassisRail);

    const cargoBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.45, 2.05, 4.1),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65, metalness: 0.15 })
    );
    cargoBox.position.set(0, 1.85, -1.35);
    cargoBox.castShadow = true;
    cargoBox.receiveShadow = true;
    chassisGroup.add(cargoBox);

    for (const sx of [-0.9, 0.9]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.08), headlightMat.clone());
      hl.position.set(sx, 0.85, 3.02);
      chassisGroup.add(hl);
      headlightMeshes.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.08), taillightMat.clone());
      tl.position.set(sx, 0.75, -3.42);
      chassisGroup.add(tl);
      taillightMeshes.push(tl);
    }

    addWheel(-1.12, 0.48, 2.1, 0.48, 0.32, true);
    addWheel(1.12, 0.48, 2.1, 0.48, 0.32, true);
    addWheel(-1.12, 0.48, -1.8, 0.48, 0.34, false);
    addWheel(1.12, 0.48, -1.8, 0.48, 0.34, false);
  } else {
    // Sports, Supercar, SUV, Police
    const isSuv = category === 'suv';
    const isSuper = category === 'supercar';
    const isPolice = category === 'police';

    const bodyH = isSuv ? 0.82 : isSuper ? 0.52 : 0.62;
    const cabinH = isSuv ? 0.68 : isSuper ? 0.44 : 0.52;
    const bodyY = isSuv ? 0.8 : 0.62;

    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width - 0.08, bodyH, spec.length - 0.15),
      paintMaterial
    );
    lowerBody.position.set(0, bodyY, 0);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    chassisGroup.add(lowerBody);

    // Police white doors contrast
    if (isPolice) {
      const whiteDoor = new THREE.Mesh(
        new THREE.BoxGeometry(spec.width - 0.05, bodyH * 0.92, spec.length * 0.42),
        new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.3, clearcoat: 0.8 })
      );
      whiteDoor.position.set(0, bodyY, 0.05);
      chassisGroup.add(whiteDoor);
    }

    // Cabin
    const cabinLen = isSuv ? spec.length * 0.62 : spec.length * 0.48;
    const cabinZ = isSuv ? -0.35 : -0.18;
    const cabinMat = isPolice
      ? new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.25, clearcoat: 0.8 })
      : paintMaterial;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.82, cabinH, cabinLen),
      cabinMat
    );
    cabin.position.set(0, bodyY + bodyH * 0.5 + cabinH * 0.45, cabinZ);
    cabin.castShadow = true;
    chassisGroup.add(cabin);

    // Windshield & rear glass
    const glassWrap = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.84, cabinH * 0.78, cabinLen + 0.06),
      glassMat
    );
    glassWrap.position.copy(cabin.position);
    chassisGroup.add(glassWrap);

    // Front splitter / bumper
    const frontBumper = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width, 0.22, 0.24),
      darkTrimMat
    );
    frontBumper.position.set(0, bodyY - bodyH * 0.32, spec.length * 0.48);
    chassisGroup.add(frontBumper);

    // Rear diffuser + twin exhausts
    const rearBumper = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width, 0.22, 0.22),
      darkTrimMat
    );
    rearBumper.position.set(0, bodyY - bodyH * 0.32, -spec.length * 0.48);
    chassisGroup.add(rearBumper);

    for (const ex of [-0.55, 0.55]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 8), chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(ex, bodyY - bodyH * 0.36, -spec.length * 0.5);
      chassisGroup.add(pipe);
    }

    // Rear Spoiler on Sports & Supercar
    if (category === 'sports' || isSuper) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.92, 0.07, 0.34), darkTrimMat);
      wing.position.set(0, bodyY + bodyH * 0.5 + (isSuper ? 0.28 : 0.18), -spec.length * 0.42);
      wing.castShadow = true;
      chassisGroup.add(wing);

      for (const sx of [-0.5, 0.5]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.14), darkTrimMat);
        strut.position.set(sx, bodyY + bodyH * 0.5 + 0.1, -spec.length * 0.42);
        chassisGroup.add(strut);
      }
    }

    // Police lightbar & pushbar
    if (isPolice) {
      const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.28), darkTrimMat);
      barBase.position.set(0, cabin.position.y + cabinH * 0.52, cabinZ + 0.15);
      chassisGroup.add(barBase);

      policeRedLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.12, 0.24),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.4 })
      );
      policeRedLight.position.set(-0.32, cabin.position.y + cabinH * 0.58, cabinZ + 0.15);
      chassisGroup.add(policeRedLight);

      policeBlueLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.12, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 0.4 })
      );
      policeBlueLight.position.set(0.32, cabin.position.y + cabinH * 0.58, cabinZ + 0.15);
      chassisGroup.add(policeBlueLight);

      const pushBar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.36, 0.14), darkTrimMat);
      pushBar.position.set(0, bodyY - 0.05, spec.length * 0.52);
      chassisGroup.add(pushBar);
    }

    // Headlights & Taillights
    for (const sx of [-spec.width * 0.34, spec.width * 0.34]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), headlightMat.clone());
      hl.position.set(sx, bodyY + 0.06, spec.length * 0.485);
      chassisGroup.add(hl);
      headlightMeshes.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.13, 0.08), taillightMat.clone());
      tl.position.set(sx, bodyY + 0.08, -spec.length * 0.485);
      chassisGroup.add(tl);
      taillightMeshes.push(tl);
    }

    const wheelRadius = isSuv ? 0.44 : 0.36;
    const wheelW = isSuv ? 0.3 : 0.26;
    const wx = spec.width * 0.48;
    const wz = spec.length * 0.32;
    addWheel(-wx, wheelRadius, wz, wheelRadius, wheelW, true);
    addWheel(wx, wheelRadius, wz, wheelRadius, wheelW, true);
    addWheel(-wx, wheelRadius, -wz, wheelRadius, wheelW, false);
    addWheel(wx, wheelRadius, -wz, wheelRadius, wheelW, false);
  }

  // Optional real SpotLights for player-driven vehicle at night
  if (enableSpotLights) {
    for (const sx of [-0.65, 0.65]) {
      const spot = new THREE.SpotLight(0xfff7d6, 0, 42, Math.PI / 5, 0.5, 1.4);
      spot.position.set(sx, 0.85, spec.length * 0.48);
      spot.target.position.set(sx * 1.1, 0.0, spec.length * 0.5 + 18);
      chassisGroup.add(spot);
      chassisGroup.add(spot.target);
      headlightSpots.push(spot);
    }
  }

  return {
    group,
    chassisGroup,
    wheels,
    frontWheelSteerPivots,
    headlightMeshes,
    taillightMeshes,
    headlightSpots,
    policeRedLight,
    policeBlueLight,
    paintMaterial,
  };
}

export function createMissionBeacon(colorHex: number): THREE.Group {
  const g = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.3, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  g.add(ring);

  const beamMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 12, 16, 1, true), beamMat);
  beam.position.y = 6.0;
  g.add(beam);

  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.6,
    })
  );
  diamond.position.y = 1.9;
  g.add(diamond);
  return g;
}

export function createCollectibleMesh(colorHex: number): THREE.Group {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.45, 0),
    new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.75,
      roughness: 0.15,
      metalness: 0.85,
    })
  );
  core.position.y = 1.05;
  g.add(core);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.65, 0.045, 8, 24),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.65 })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 1.05;
  g.add(halo);
  return g;
}
