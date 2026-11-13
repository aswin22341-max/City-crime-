import { useRef, useState, type PointerEvent } from 'react';
import { Car, ArrowUp, Zap, Hand } from 'lucide-react';
import type { MobileInputState } from '../game/types';

interface MobileControlsProps {
  inVehicle: boolean;
  onInput: (partial: Partial<MobileInputState>) => void;
  onEnterExit: () => void;
  onInteract: () => void;
  onGadget: () => void;
}

export function MobileControls({
  inVehicle,
  onInput,
  onEnterExit,
  onInteract,
  onGadget,
}: MobileControlsProps) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const joyRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);
  const lookPointerId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  const handleJoyDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerId.current = e.pointerId;
    updateJoy(e.clientX, e.clientY);
  };

  const handleJoyMove = (e: PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    updateJoy(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    joyPointerId.current = null;
    setKnob({ x: 0, y: 0 });
    onInput({ moveX: 0, moveY: 0 });
  };

  const updateJoy = (clientX: number, clientY: number) => {
    const el = joyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnob({ x: dx, y: dy });
    onInput({ moveX: dx / maxR, moveY: -dy / maxR });
  };

  const handleLookDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    lookPointerId.current = e.pointerId;
    lastLookPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookMove = (e: PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    const dx = e.clientX - lastLookPos.current.x;
    const dy = e.clientY - lastLookPos.current.y;
    lastLookPos.current = { x: e.clientX, y: e.clientY };
    onInput({ lookDeltaX: dx * 1.4, lookDeltaY: dy * 1.4 });
  };

  const handleLookUp = (e: PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    lookPointerId.current = null;
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-end justify-between p-4 pb-44 sm:pb-48">
      {/* Virtual Movement / Steering Joystick */}
      <div
        ref={joyRef}
        onPointerDown={handleJoyDown}
        onPointerMove={handleJoyMove}
        onPointerUp={handleJoyUp}
        onPointerCancel={handleJoyUp}
        className="pointer-events-auto relative w-28 h-28 rounded-full border-2 border-white/25 bg-zinc-950/60 flex items-center justify-center touch-none"
      >
        <div
          className="w-11 h-11 rounded-full bg-amber-400/90 border border-white/50 shadow-lg"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>

      {/* Camera Look Drag Zone (Right Side) */}
      <div
        onPointerDown={handleLookDown}
        onPointerMove={handleLookMove}
        onPointerUp={handleLookUp}
        onPointerCancel={handleLookUp}
        className="pointer-events-auto absolute right-0 top-24 bottom-48 w-1/2 touch-none"
      />

      {/* Action Buttons */}
      <div className="pointer-events-auto grid grid-cols-2 gap-2.5">
        <button
          onPointerDown={() => onInput({ sprint: true })}
          onPointerUp={() => onInput({ sprint: false })}
          onPointerCancel={() => onInput({ sprint: false })}
          className="w-12 h-12 rounded-full border border-white/25 bg-zinc-950/80 text-[11px] font-bold text-zinc-100 active:bg-amber-500 active:text-zinc-950"
        >
          {inVehicle ? 'GAS' : 'RUN'}
        </button>

        <button
          onPointerDown={() => onInput(inVehicle ? { handbrake: true } : { jump: true })}
          onPointerUp={() => onInput(inVehicle ? { handbrake: false } : { jump: false })}
          onPointerCancel={() => onInput(inVehicle ? { handbrake: false } : { jump: false })}
          className="w-12 h-12 rounded-full border border-white/25 bg-zinc-950/80 flex items-center justify-center text-zinc-100 active:bg-amber-500 active:text-zinc-950"
          aria-label={inVehicle ? 'Handbrake' : 'Jump'}
        >
          <ArrowUp className="w-5 h-5" />
        </button>

        <button
          onClick={onEnterExit}
          className="w-12 h-12 rounded-full border border-amber-400/50 bg-zinc-950/85 flex items-center justify-center text-amber-400 active:bg-amber-400 active:text-zinc-950"
          aria-label="Enter or exit vehicle"
        >
          <Car className="w-5 h-5" />
        </button>

        <button
          onClick={inVehicle ? onGadget : onInteract}
          className="w-12 h-12 rounded-full border border-cyan-400/50 bg-zinc-950/85 flex items-center justify-center text-cyan-300 active:bg-cyan-400 active:text-zinc-950"
          aria-label="Interact"
        >
          {inVehicle ? <Zap className="w-5 h-5" /> : <Hand className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
