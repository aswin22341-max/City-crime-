import { useEffect, useRef } from 'react';
import { ROAD_COORDS } from '../game/cityBuilder';
import type { HudState } from '../game/types';

interface MinimapProps {
  hud: HudState;
}

export function Minimap({ hud }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const half = size / 2;
    const scale = 0.78; // pixels per world meter

    ctx.clearRect(0, 0, size, size);

    // Clip circular/rounded radar viewport
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 12);
    ctx.clip();

    // Base city land
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, size, size);

    const toMapX = (wx: number) => half + (wx - hud.playerX) * scale;
    const toMapY = (wz: number) => half + (wz - hud.playerZ) * scale;

    // Ocean East & South
    ctx.fillStyle = '#0c4a6e';
    const eastEdge = toMapX(210);
    if (eastEdge < size) ctx.fillRect(eastEdge, 0, size - eastEdge, size);
    const southEdge = toMapY(208);
    if (southEdge < size) ctx.fillRect(0, southEdge, size, size - southEdge);

    // Central Park
    ctx.fillStyle = '#14532d';
    ctx.fillRect(toMapX(8), toMapY(8), 44 * scale, 44 * scale);

    // Airport Tarmac
    ctx.fillStyle = '#334155';
    ctx.fillRect(toMapX(80), toMapY(-204), 124 * scale, 70 * scale);

    // Mountain Ridge NW
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(toMapX(-250), toMapY(-250), 62 * scale, 105 * scale);

    // City Road Grid
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 7 * scale;
    for (const rc of ROAD_COORDS) {
      const mx = toMapX(rc);
      ctx.beginPath();
      ctx.moveTo(mx, toMapY(-185));
      ctx.lineTo(mx, toMapY(185));
      ctx.stroke();

      const mz = toMapY(rc);
      ctx.beginPath();
      ctx.moveTo(toMapX(-185), mz);
      ctx.lineTo(toMapX(185), mz);
      ctx.stroke();
    }

    // Blips
    for (const b of hud.minimapBlips) {
      const bx = toMapX(b.x);
      const by = toMapY(b.z);
      if (bx < -10 || bx > size + 10 || by < -10 || by > size + 10) continue;

      if (b.type === 'mission') {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.type === 'police') {
        ctx.fillStyle = Math.floor(Date.now() / 180) % 2 === 0 ? '#ef4444' : '#3b82f6';
        ctx.beginPath();
        ctx.arc(bx, by, 3.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.type === 'landmark') {
        ctx.fillStyle = b.color;
        ctx.fillRect(bx - 2.5, by - 2.5, 5, 5);
      } else if (b.type === 'racer') {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#d4d4d8';
        ctx.fillRect(bx - 1.5, by - 1.5, 3, 3);
      }
    }

    // Player Arrow at center
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(-hud.playerYaw + Math.PI);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }, [hud]);

  return (
    <div className="pointer-events-none select-none flex flex-col gap-1.5">
      <div className="relative rounded-xl border border-white/15 bg-zinc-950/90 p-1 shadow-xl">
        <canvas ref={canvasRef} width={168} height={168} className="block w-[136px] h-[136px] sm:w-[168px] sm:h-[168px] rounded-lg" />
        <div className="mt-1 flex items-center justify-between px-1.5 pb-0.5 text-[11px] font-medium text-zinc-300">
          <span className="truncate max-w-[120px]">{hud.districtName}</span>
          <span className="font-mono-hud text-zinc-400">N</span>
        </div>
      </div>
    </div>
  );
}
