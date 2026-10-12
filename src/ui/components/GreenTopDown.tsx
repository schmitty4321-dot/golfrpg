import { useRef } from "react";
import type { PracticeStroke } from "../../engine/practiceHole";
import type { Circle, HoleLayout, Pt } from "../../engine/tracer";

/**
 * The photo of Waialae hole 1's green from above. The sand and water are in the photo, so the
 * layout only places the green, the pin and the ball on it.
 */
const PHOTO = {
  src: "art/greens/waialae-1-green.webp",
  width: 1536,
  height: 1024,
  /** The centre of the putting surface, in photo pixels. */
  centre: { x: 732, y: 430 },
  /** A point on the fairway the approach comes in from, in photo pixels: the way back to the tee. */
  back: { x: 200, y: 850 },
  /** The green's radius in photo pixels, matched to the course layout's green radius. */
  radiusPx: 383,
};

/** A pixel of the photo for a point on the course, from the way the photo is turned and scaled onto the green. */
export function photoPoint(green: Circle, p: Pt): Pt {
  const backAngle = (Math.atan2(PHOTO.back.y - PHOTO.centre.y, PHOTO.back.x - PHOTO.centre.x) * 180) / Math.PI;
  const turn = ((90 - backAngle) * Math.PI) / 180;
  const k = green.r / PHOTO.radiusPx;
  // Yards from the green centre, forward up the screen; then back through the turn and scale to photo pixels.
  const vx = p.x - green.x;
  const vy = -(p.y - green.y);
  const a = -turn;
  const ux = vx * Math.cos(a) - vy * Math.sin(a);
  const uy = vx * Math.sin(a) + vy * Math.cos(a);
  return { x: PHOTO.centre.x + ux / k, y: PHOTO.centre.y + uy / k };
}

export interface PhotoSand {
  w: number;
  h: number;
  /** 1 where the photo shows bunker sand, 0 elsewhere. */
  mask: Uint8Array;
}

/** Reads the photo once and marks its pale bunker sand. The grass is greener, with green above red. */
export function loadPhotoSand(src: string): Promise<PhotoSand> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const mask = new Uint8Array(canvas.width * canvas.height);
      for (let i = 0; i < mask.length; i++) {
        const r = data[i * 4]!;
        const g = data[i * 4 + 1]!;
        const b = data[i * 4 + 2]!;
        mask[i] = r > 170 && r >= g - 5 && g >= b && r - b < 90 ? 1 : 0;
      }
      resolve({ w: canvas.width, h: canvas.height, mask });
    };
    img.onerror = () => reject(new Error("photo did not load"));
    img.src = src;
  });
}

interface Props {
  layout: HoleLayout;
  ball: Pt;
  aim: Pt;
  strokes: PracticeStroke[];
  progress: number;
  showAim: boolean;
  onAim: (p: Pt) => void;
  /** The last stroke was a gimme: the word GIMME shows over the hole. */
  gimme: boolean;
}

/**
 * The green from above, in yards. The photo is turned so the way back to the tee points down the
 * screen, and scaled to the layout's green radius. Forward (away from the tee) is up the screen.
 */
export function GreenTopDown({ layout, ball, aim, strokes, progress, showAim, onAim, gimme }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const g = layout.green;
  // Yards from the green centre to a point on the course, with forward pointing up the screen.
  const toView = (p: Pt) => ({ x: p.x - g.x, y: -(p.y - g.y) });
  // The view is centred between the ball and the pin, sized to show both with room around them.
  const mid = toView({ x: (ball.x + layout.pin.x) / 2, y: (ball.y + layout.pin.y) / 2 });
  const span = Math.max(Math.hypot(ball.x - layout.pin.x, ball.y - layout.pin.y) / 2 + 12, 18);

  // Turn the photo so the way back to the tee points down (the screen's y runs down), and scale it to the green.
  const backAngle = (Math.atan2(PHOTO.back.y - PHOTO.centre.y, PHOTO.back.x - PHOTO.centre.x) * 180) / Math.PI;
  const turn = 90 - backAngle;
  const scale = g.r / PHOTO.radiusPx;
  const photoTransform = `rotate(${turn}) scale(${scale}) translate(${-PHOTO.centre.x} ${-PHOTO.centre.y})`;

  const dragAim = (e: React.PointerEvent) => {
    if (!showAim) return;
    e.preventDefault();
    const place = (clientX: number, clientY: number) => {
      const rect = svg.current?.getBoundingClientRect();
      if (!rect) return;
      const fx = (clientX - rect.left) / rect.width;
      const fy = (clientY - rect.top) / rect.height;
      // Back from the view to the course: x as is, screen y flipped (up is forward).
      onAim({ x: g.x + mid.x - span + fx * 2 * span, y: g.y - (mid.y - span + fy * 2 * span) });
    };
    const move = (ev: PointerEvent) => place(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    place(e.clientX, e.clientY);
  };

  const pin = toView(layout.pin);
  const ballAt = toView(ball);
  const aimAt = toView(aim);
  const feetToPin = Math.round(Math.hypot(ball.x - layout.pin.x, ball.y - layout.pin.y) * 3);
  const last = strokes.length - 1;
  const lastShot = strokes[last];
  const rollAt = lastShot && progress < 1
    ? { x: toView(lastShot.from).x + (toView(lastShot.to).x - toView(lastShot.from).x) * progress, y: toView(lastShot.from).y + (toView(lastShot.to).y - toView(lastShot.from).y) * progress }
    : ballAt;

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: "#4f8a2f", borderRadius: 8, overflow: "hidden" }}>
      <svg
        ref={svg}
        viewBox={`${mid.x - span} ${mid.y - span} ${2 * span} ${2 * span}`}
        onPointerDown={dragAim}
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: showAim ? "crosshair" : "default" }}
        aria-label="Top-down view of the green"
      >
        <rect x={mid.x - span} y={mid.y - span} width={2 * span} height={2 * span} fill="#4f8a2f" />
        {/* The photo of the green, turned and scaled onto the layout. */}
        <image href={`${import.meta.env.BASE_URL}${PHOTO.src}`} x={0} y={0} width={PHOTO.width} height={PHOTO.height} transform={photoTransform} />
        {/* The pin. */}
        <line x1={pin.x} y1={pin.y} x2={pin.x} y2={pin.y - 3.5} stroke="#f4f5ef" strokeWidth={0.3} />
        <path d={`M ${pin.x} ${pin.y - 3.5} l 1.6 0.6 l -1.6 0.6 Z`} fill="#e53935" />
        <circle cx={pin.x} cy={pin.y} r={0.35} fill="#101010" />
        {gimme && progress >= 1 && <text x={pin.x} y={pin.y - 2.2} textAnchor="middle" fontSize={3.2} fontWeight={700} fill="#ffffff" stroke="#000" strokeWidth={0.4} paintOrder="stroke">GIMME</text>}
        {/* The ball. */}
        {/* The ball rolls from where it was struck to where it comes to rest. No tracer line. */}
        <circle cx={rollAt.x} cy={rollAt.y} r={0.6} fill="#ffffff" stroke="#000" strokeWidth={0.25} />
        {/* The aim marker: a yellow ring the player drags. */}
        {showAim && <circle cx={aimAt.x} cy={aimAt.y} r={1.1} fill="rgba(255, 214, 10, 0.3)" stroke="#ffd60a" strokeWidth={0.3} />}
      </svg>
      <div style={{ position: "absolute", top: 8, left: 8, padding: "4px 10px", borderRadius: 6, background: "rgba(10, 20, 15, 0.8)", color: "#fff", fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}>
        {feetToPin} ft to the pin
      </div>
    </div>
  );
}
