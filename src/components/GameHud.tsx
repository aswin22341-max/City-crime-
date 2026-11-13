import { Backpack, Cloud, CloudLightning, CloudRain, CloudFog, ListChecks, Pause, Star, Sun, Zap } from 'lucide-react';
import type { HudState, WeaponGadgetId } from '../game/types';
import { Minimap } from './Minimap';

interface GameHudProps {
  hud: HudState;
  onOpenMissions: () => void;
  onOpenInventory: () => void;
  onPause: () => void;
  onEquipGadget: (id: WeaponGadgetId) => void;
  onUseGadget: () => void;
}

function formatClock(hourFloat: number): string {
  const totalMin = Math.floor(hourFloat * 60) % (24 * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const GADGET_LABELS: Record<WeaponGadgetId, string> = {
  fist: 'Unarmed',
  emp_stunner: 'EMP Stunner',
  signal_jammer: 'Signal Jammer',
  turbo_dash: 'Nitro Surge',
};

export function GameHud({
  hud,
  onOpenMissions,
  onOpenInventory,
  onPause,
  onEquipGadget,
  onUseGadget,
}: GameHudProps) {
  const WeatherIcon =
    hud.weather === 'sunny'
      ? Sun
      : hud.weather === 'rain'
        ? CloudRain
        : hud.weather === 'thunderstorm'
          ? CloudLightning
          : hud.weather === 'fog'
            ? CloudFog
            : Cloud;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
      {/* TOP ROW */}
      <div className="flex items-start justify-between gap-4">
        {/* TOP-LEFT: Active Mission / Prompts */}
        <div className="flex flex-col gap-2 max-w-xs sm:max-w-sm">
          {hud.activeMissionTitle ? (
            <div className="pointer-events-auto rounded-lg border border-amber-400/30 bg-zinc-950/90 px-3.5 py-2.5 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-xs font-bold tracking-wider text-amber-400 uppercase">
                  {hud.activeMissionTitle}
                </span>
                {hud.missionTimerSec !== null && (
                  <span className="font-mono-hud text-sm font-bold text-rose-400">
                    {formatTimer(hud.missionTimerSec)}
                  </span>
                )}
                {hud.missionProgressText && (
                  <span className="font-mono-hud text-xs font-semibold text-cyan-300">
                    {hud.missionProgressText}
                  </span>
                )}
              </div>
              {hud.activeObjectiveText && (
                <p className="mt-1 text-xs sm:text-sm font-medium text-zinc-100 leading-snug">
                  {hud.activeObjectiveText}
                </p>
              )}
              {hud.racePosition && hud.raceTotal && (
                <div className="mt-1.5 text-xs font-mono-hud text-amber-300">
                  Position: {hud.racePosition} / {hud.raceTotal}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-zinc-950/85 px-3 py-2 text-xs text-zinc-300">
              Free Roam · Press <span className="font-mono-hud text-amber-400 font-semibold">[M]</span> for Missions
            </div>
          )}

          {hud.interactPrompt && (
            <div className="rounded-lg border border-cyan-400/40 bg-zinc-950/95 px-3.5 py-2 text-xs sm:text-sm font-semibold text-cyan-200 shadow-lg">
              {hud.interactPrompt}
            </div>
          )}

          {hud.notificationText && (
            <div className="rounded-lg border border-white/15 bg-zinc-900/95 px-3.5 py-2 text-xs sm:text-sm font-medium text-white shadow-lg">
              {hud.notificationText}
            </div>
          )}
        </div>

        {/* TOP-RIGHT: Money, Wanted Stars, Health, Armor, Time/Weather, Quick Buttons */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              onClick={onOpenInventory}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-zinc-950/88 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors whitespace-nowrap"
              title="Inventory (I)"
            >
              <Backpack className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Gear [I]</span>
            </button>
            <button
              onClick={onOpenMissions}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-zinc-950/88 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors whitespace-nowrap"
              title="Missions (M)"
            >
              <ListChecks className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Missions [M]</span>
            </button>
            <button
              onClick={onPause}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-zinc-950/88 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors whitespace-nowrap"
              title="Pause (ESC)"
            >
              <Pause className="w-3.5 h-3.5 text-zinc-300" />
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>

          <div className="rounded-xl border border-white/15 bg-zinc-950/88 px-3.5 py-2.5 min-w-[205px] shadow-xl">
            {/* Money + Time/Weather */}
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono-hud text-lg sm:text-xl font-bold text-emerald-400">
                ${hud.money.toLocaleString()}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                <WeatherIcon className="w-3.5 h-3.5 text-amber-300" />
                <span className="font-mono-hud">{formatClock(hud.timeOfDay)}</span>
              </div>
            </div>

            {/* Health & Armor Bars */}
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-7 text-[10px] font-semibold text-emerald-400">HP</span>
                <div className="h-2 flex-1 rounded-sm bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-150"
                    style={{ width: `${Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100))}%` }}
                  />
                </div>
                <span className="w-7 text-right font-mono-hud text-[11px] text-zinc-300">{hud.health}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-7 text-[10px] font-semibold text-cyan-400">ARM</span>
                <div className="h-2 flex-1 rounded-sm bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-150"
                    style={{ width: `${Math.max(0, Math.min(100, (hud.armor / hud.maxArmor) * 100))}%` }}
                  />
                </div>
                <span className="w-7 text-right font-mono-hud text-[11px] text-zinc-300">{hud.armor}</span>
              </div>
            </div>

            {/* Wanted Stars */}
            <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= hud.wantedLevel;
                  return (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        active
                          ? hud.wantedSearching
                            ? 'text-sky-400 fill-sky-400'
                            : 'text-amber-400 fill-amber-400'
                          : 'text-zinc-700'
                      }`}
                    />
                  );
                })}
              </div>
              {hud.wantedLevel > 0 && (
                <span className="font-mono-hud text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  {hud.wantedSearching ? `Evading ${Math.round(hud.wantedCooldownPct * 100)}%` : 'Pursuit'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="flex items-end justify-between gap-4">
        {/* BOTTOM-LEFT: Mini-map */}
        <Minimap hud={hud} />

        {/* BOTTOM-RIGHT: Speedometer OR Gadget Selector */}
        <div className="flex flex-col items-end gap-2">
          {hud.inVehicle ? (
            <div className="rounded-xl border border-white/15 bg-zinc-950/90 px-4 py-3 min-w-[205px] shadow-xl">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono-hud text-3xl sm:text-4xl font-bold text-white leading-none">
                  {hud.speedKmh}
                </span>
                <span className="font-display text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  KM/H
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-300">
                <span className="truncate max-w-[130px] font-medium">{hud.vehicleName}</span>
                <span className="font-mono-hud text-[11px] text-zinc-400">
                  Lights: {hud.headlightsOn ? 'ON' : 'OFF'} [L]
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-semibold text-zinc-400">COND</span>
                <div className="h-1.5 flex-1 rounded-sm bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      hud.vehicleCondition > 60
                        ? 'bg-emerald-400'
                        : hud.vehicleCondition > 30
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                    }`}
                    style={{ width: `${hud.vehicleCondition}%` }}
                  />
                </div>
                <span className="font-mono-hud text-[11px] text-zinc-300">{hud.vehicleCondition}%</span>
              </div>
            </div>
          ) : (
            <div className="pointer-events-auto rounded-xl border border-white/15 bg-zinc-950/90 p-2.5 shadow-xl">
              <div className="flex items-center justify-between gap-3 mb-2 px-1">
                <span className="text-xs font-semibold text-zinc-200">{GADGET_LABELS[hud.equippedGadget]}</span>
                {hud.equippedGadget !== 'fist' && (
                  <button
                    onClick={onUseGadget}
                    className="flex items-center gap-1 rounded bg-cyan-500 px-2 py-0.5 text-[11px] font-bold text-zinc-950 hover:bg-cyan-400"
                  >
                    <Zap className="w-3 h-3" />
                    Use [R] ({hud.gadgetAmmo[hud.equippedGadget]})
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(['fist', 'emp_stunner', 'signal_jammer', 'turbo_dash'] as WeaponGadgetId[]).map((gId, idx) => {
                  const active = hud.equippedGadget === gId;
                  return (
                    <button
                      key={gId}
                      onClick={() => onEquipGadget(gId)}
                      className={`px-2 py-1.5 rounded text-[11px] font-medium border transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      [{idx + 1}] {gId === 'fist' ? 'Hand' : gId === 'emp_stunner' ? 'EMP' : gId === 'signal_jammer' ? 'Jam' : 'Nitro'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
