import { useEffect, useRef, useState } from "react";

export interface SwingStrike {
  /** Power on the meter when the power press was made, 0 to 110. */
  power: number;
  /** Strike timing in ms: negative early, positive late, against the centre of the strike sweep. */
  timingMs: number;
}

/**
 * The broadcast three-click swing: press to start, press to set power (the needle
 * sweeps 0 to 110%), press to strike (a second needle crosses a sweet spot in the
 * centre). Space or Enter also works. Timing and power come back through onStrike.
 */
export function SwingMeter({ powerSweepMs, strikeSweepMs, windowMs, targetPower, disabled, onStrike }: {
  powerSweepMs: number;
  strikeSweepMs: number;
  windowMs: number;
  targetPower: number;
  disabled?: boolean;
  onStrike: (strike: SwingStrike) => void;
}) {
  const [phase, setPhase] = useState<"ready" | "power" | "strike">("ready");
  const [needle, setNeedle] = useState(0);
  const [label, setLabel] = useState("Start swing");
  const phaseRef = useRef(phase);
  const startRef = useRef(0);
  const powerRef = useRef(0);
  const raf = useRef(0);
  phaseRef.current = phase;

  const tick = (now: number) => {
    if (phaseRef.current === "power") {
      const p = Math.min(110, ((now - startRef.current) / powerSweepMs) * 110);
      setNeedle((p / 110) * 100);
      if (p >= 110) {
        // The power meter ran out: the shot is struck at the top, badly timed.
        powerRef.current = 110;
        setPhase("strike");
        startRef.current = now;
      }
    } else if (phaseRef.current === "strike") {
      const elapsed = now - startRef.current;
      setNeedle(Math.min(100, (elapsed / strikeSweepMs) * 100));
      if (elapsed >= strikeSweepMs * 2) {
        setPhase("ready");
        setLabel("Missed the strike. Try again.");
        onStrike({ power: powerRef.current, timingMs: strikeSweepMs });
        return;
      }
    }
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const press = () => {
    if (disabled) return;
    const now = performance.now();
    if (phaseRef.current === "ready") {
      setPhase("power");
      setNeedle(0);
      setLabel("Set power");
      startRef.current = now;
      raf.current = requestAnimationFrame(tick);
    } else if (phaseRef.current === "power") {
      powerRef.current = Math.min(110, ((now - startRef.current) / powerSweepMs) * 110);
      setPhase("strike");
      setLabel("Strike in the middle");
      startRef.current = now;
    } else {
      // The strike sweep crosses the centre at strikeSweepMs; timing is measured from there.
      const timingMs = Math.round(now - startRef.current - strikeSweepMs);
      cancelAnimationFrame(raf.current);
      setPhase("ready");
      setLabel("Start swing");
      onStrike({ power: powerRef.current, timingMs });
    }
  };

  const zoneLeft = Math.max(0, 50 - (windowMs / strikeSweepMs) * 50);
  const zoneWidth = Math.min(100, (windowMs / strikeSweepMs) * 100);
  return (
    <div className="swing-meter" onKeyDown={(e) => { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); press(); } }} tabIndex={0}>
      <div className="swing-meter-labels"><strong>{label}</strong><span>Target {targetPower}%</span></div>
      <div className="swing-meter-bar" role="img" aria-label="Power and strike meter">
        <div className="swing-meter-fill" style={{ width: phase === "power" ? `${needle}%` : phase === "strike" ? "0%" : "0%" }} />
        {phase === "strike" && <div className="swing-meter-zone" style={{ left: `${zoneLeft}%`, width: `${zoneWidth}%` }} />}
        <div className="swing-meter-needle" style={{ left: `${phase === "strike" ? needle : 0}%`, display: phase === "ready" ? "none" : undefined }} />
      </div>
      <button type="button" className="btn btn-primary" onClick={press} disabled={disabled}>
        {phase === "ready" ? "Swing" : phase === "power" ? "Set power" : "Strike"}
      </button>
    </div>
  );
}
