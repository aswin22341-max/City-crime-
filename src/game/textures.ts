import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphaltRoad: THREE.CanvasTexture;
  intersectionRoad: THREE.CanvasTexture;
  sidewalk: THREE.CanvasTexture;
  grass: THREE.CanvasTexture;
  sand: THREE.CanvasTexture;
  runway: THREE.CanvasTexture;
  concreteGarage: THREE.CanvasTexture;
  buildingGlass: THREE.CanvasTexture;
  buildingGlassEmissive: THREE.CanvasTexture;
  buildingResidential: THREE.CanvasTexture;
  buildingResidentialEmissive: THREE.CanvasTexture;
  industrialMetal: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Asphalt Road with double yellow centerline & dashed white lane dividers
  const [roadC, roadCtx] = makeCanvas(512, 512);
  roadCtx.fillStyle = '#25282e';
  roadCtx.fillRect(0, 0, 512, 512);
  // Subtle aggregate grain
  for (let i = 0; i < 4500; i++) {
    const x = (i * 73) % 512;
    const y = (i * 197) % 512;
    const v = 30 + ((i * 13) % 24);
    roadCtx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    roadCtx.fillRect(x, y, 2, 2);
  }
  // White shoulder edges
  roadCtx.fillStyle = '#d4d4d8';
  roadCtx.fillRect(18, 0, 8, 512);
  roadCtx.fillRect(486, 0, 8, 512);
  // Double yellow center line
  roadCtx.fillStyle = '#eab308';
  roadCtx.fillRect(247, 0, 6, 512);
  roadCtx.fillRect(259, 0, 6, 512);
  // Dashed lane lines
  roadCtx.fillStyle = '#e4e4e7';
  for (let y = 16; y < 512; y += 64) {
    roadCtx.fillRect(132, y, 5, 32);
    roadCtx.fillRect(375, y, 5, 32);
  }
  const asphaltRoad = finalizeTexture(roadC, maxAnisotropy, 1, 1, true);

  // 2. Intersection Asphalt with crosswalk bars
  const [intC, intCtx] = makeCanvas(512, 512);
  intCtx.fillStyle = '#262930';
  intCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3000; i++) {
    const x = (i * 89) % 512;
    const y = (i * 151) % 512;
    const v = 32 + ((i * 17) % 20);
    intCtx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
    intCtx.fillRect(x, y, 2, 2);
  }
  // Crosswalks on 4 sides
  intCtx.fillStyle = '#e4e4e7';
  for (let k = 32; k < 480; k += 44) {
    intCtx.fillRect(k, 14, 24, 52);
    intCtx.fillRect(k, 446, 24, 52);
    intCtx.fillRect(14, k, 52, 24);
    intCtx.fillRect(446, k, 52, 24);
  }
  const intersectionRoad = finalizeTexture(intC, maxAnisotropy, 1, 1, true);

  // 3. Concrete Sidewalk Paving
  const [swC, swCtx] = makeCanvas(256, 256);
  swCtx.fillStyle = '#8b8e94';
  swCtx.fillRect(0, 0, 256, 256);
  swCtx.strokeStyle = '#6f7278';
  swCtx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) {
    swCtx.beginPath();
    swCtx.moveTo(i, 0);
    swCtx.lineTo(i, 256);
    swCtx.stroke();
    swCtx.beginPath();
    swCtx.moveTo(0, i);
    swCtx.lineTo(256, i);
    swCtx.stroke();
  }
  const sidewalk = finalizeTexture(swC, maxAnisotropy, 12, 12, true);

  // 4. Park Grass
  const [grC, grCtx] = makeCanvas(256, 256);
  grCtx.fillStyle = '#366932';
  grCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const x = (i * 53) % 256;
    const y = (i * 113) % 256;
    grCtx.fillStyle = i % 2 === 0 ? '#3f783b' : '#2d5929';
    grCtx.fillRect(x, y, 3, 3);
  }
  const grass = finalizeTexture(grC, maxAnisotropy, 8, 8, true);

  // 5. Beach Sand
  const [saC, saCtx] = makeCanvas(256, 256);
  saCtx.fillStyle = '#d9c293';
  saCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    const x = (i * 61) % 256;
    const y = (i * 131) % 256;
    saCtx.fillStyle = i % 2 === 0 ? '#e3ce9f' : '#cbb280';
    saCtx.fillRect(x, y, 2, 2);
  }
  const sand = finalizeTexture(saC, maxAnisotropy, 10, 10, true);

  // 6. Airport Runway
  const [rwC, rwCtx] = makeCanvas(512, 512);
  rwCtx.fillStyle = '#1f2228';
  rwCtx.fillRect(0, 0, 512, 512);
  rwCtx.fillStyle = '#f4f4f5';
  rwCtx.fillRect(20, 0, 10, 512);
  rwCtx.fillRect(482, 0, 10, 512);
  for (let y = 20; y < 512; y += 80) {
    rwCtx.fillRect(248, y, 16, 48);
  }
  const runway = finalizeTexture(rwC, maxAnisotropy, 1, 8, true);

  // 7. Underground Concrete Garage
  const [cgC, cgCtx] = makeCanvas(256, 256);
  cgCtx.fillStyle = '#474b52';
  cgCtx.fillRect(0, 0, 256, 256);
  cgCtx.strokeStyle = '#36393f';
  cgCtx.lineWidth = 2;
  cgCtx.strokeRect(2, 2, 252, 252);
  cgCtx.fillStyle = '#facc15';
  cgCtx.fillRect(24, 16, 6, 90);
  cgCtx.fillRect(128, 16, 6, 90);
  cgCtx.fillRect(230, 16, 6, 90);
  const concreteGarage = finalizeTexture(cgC, maxAnisotropy, 4, 4, true);

  // 8. Skyscraper Glass Facade (Day + Emissive Night)
  const [bgC, bgCtx] = makeCanvas(256, 512);
  const [bgEmC, bgEmCtx] = makeCanvas(256, 512);
  bgCtx.fillStyle = '#1c2533';
  bgCtx.fillRect(0, 0, 256, 512);
  bgEmCtx.fillStyle = '#000000';
  bgEmCtx.fillRect(0, 0, 256, 512);

  for (let row = 0; row < 24; row++) {
    for (let col = 0; col < 10; col++) {
      const wx = 8 + col * 24;
      const wy = 8 + row * 21;
      const hash = ((row * 31 + col * 17) % 100) / 100;
      // Day glass tone
      bgCtx.fillStyle = hash > 0.6 ? '#4f7ea8' : hash > 0.25 ? '#355c7d' : '#26435c';
      bgCtx.fillRect(wx, wy, 18, 14);
      // Night lit windows
      if (hash > 0.38) {
        bgEmCtx.fillStyle = hash > 0.78 ? '#fef08a' : hash > 0.55 ? '#fde68a' : '#bae6fd';
        bgEmCtx.fillRect(wx + 1, wy + 1, 16, 12);
      }
    }
  }
  const buildingGlass = finalizeTexture(bgC, maxAnisotropy, 1, 1, true);
  const buildingGlassEmissive = finalizeTexture(bgEmC, maxAnisotropy, 1, 1, true);

  // 9. Residential Brick/Concrete Facade (Day + Emissive Night)
  const [brC, brCtx] = makeCanvas(256, 256);
  const [brEmC, brEmCtx] = makeCanvas(256, 256);
  brCtx.fillStyle = '#9b7e6b';
  brCtx.fillRect(0, 0, 256, 256);
  brEmCtx.fillStyle = '#000000';
  brEmCtx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 6; col++) {
      const wx = 12 + col * 40;
      const wy = 10 + row * 31;
      const hash = ((row * 19 + col * 29) % 100) / 100;
      brCtx.fillStyle = '#2a333d';
      brCtx.fillRect(wx, wy, 22, 18);
      if (hash > 0.45) {
        brEmCtx.fillStyle = '#fed7aa';
        brEmCtx.fillRect(wx + 2, wy + 2, 18, 14);
      }
    }
  }
  const buildingResidential = finalizeTexture(brC, maxAnisotropy, 1, 1, true);
  const buildingResidentialEmissive = finalizeTexture(brEmC, maxAnisotropy, 1, 1, true);

  // 10. Industrial Corrugated Metal
  const [indC, indCtx] = makeCanvas(256, 256);
  indCtx.fillStyle = '#4e5661';
  indCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    indCtx.fillStyle = '#3f4650';
    indCtx.fillRect(x, 0, 6, 256);
    indCtx.fillStyle = '#606975';
    indCtx.fillRect(x + 6, 0, 4, 256);
  }
  const industrialMetal = finalizeTexture(indC, maxAnisotropy, 2, 2, true);

  // 11. Soft Radial Contact Shadow
  const [csC, csCtx] = makeCanvas(128, 128);
  const grad = csCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  csCtx.fillStyle = grad;
  csCtx.fillRect(0, 0, 128, 128);
  const contactShadow = finalizeTexture(csC, maxAnisotropy, 1, 1, true);

  return {
    asphaltRoad,
    intersectionRoad,
    sidewalk,
    grass,
    sand,
    runway,
    concreteGarage,
    buildingGlass,
    buildingGlassEmissive,
    buildingResidential,
    buildingResidentialEmissive,
    industrialMetal,
    contactShadow,
  };
}
