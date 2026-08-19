import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MAP_W = 1254;
const MAP_H = 1254;
const MAP_SRC = "/nature-test-map.png";
const SPRITE_W = 48;
const SPRITE_H = 64;
const PIVOT_X = 24;
const PIVOT_Y = 62;
const WALK_FPS = 10;
const SPEED = 150;

const DIRECTIONS = [
  "south",
  "south_west",
  "west",
  "north_west",
  "north",
  "north_east",
  "east",
  "south_east",
] as const;
type Direction = (typeof DIRECTIONS)[number];
type Vec2 = { x: number; y: number };

const START: Vec2 = { x: 627, y: 520 };

function dirFromVector(dx: number, dy: number): Direction {
  const a = Math.atan2(dy, dx) * 180 / Math.PI;
  if (a >= -22.5 && a < 22.5) return "east";
  if (a >= 22.5 && a < 67.5) return "south_east";
  if (a >= 67.5 && a < 112.5) return "south";
  if (a >= 112.5 && a < 157.5) return "south_west";
  if (a >= 157.5 || a < -157.5) return "west";
  if (a >= -157.5 && a < -112.5) return "north_west";
  if (a >= -112.5 && a < -67.5) return "north";
  return "north_east";
}

function insideWorld(x: number, y: number) {
  const cx = MAP_W / 2;
  const cy = 628;
  const rx = 618;
  const ry = 575;
  const diamond = Math.abs((x - cx) / rx) + Math.abs((y - cy) / ry) <= 0.985;
  if (!diamond) return false;

  // Main pond collision. This is an intentionally simple first-pass collision
  // against the fixed artwork; we can replace it with a proper collision mask later.
  const pondCx = 627;
  const pondCy = 824;
  const pondRx = 170;
  const pondRy = 118;
  const px = (x - pondCx) / pondRx;
  const py = (y - pondCy) / pondRy;
  if (px * px + py * py < 1) return false;

  return true;
}

function spritePath(direction: Direction, frame = 1) {
  if (frame === 1) return `/player01/sprites/idle/${direction}/player01_idle_${direction}_01.png`;
  return `/player01/sprites/walk/${direction}/player01_walk_${direction}_${String(frame).padStart(2, "0")}.png`;
}

export default function NatureMapPlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLImageElement>(null);
  const spriteCache = useRef(new Map<string, HTMLImageElement>());
  const keysRef = useRef(new Set<string>());
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const walkClockRef = useRef(0);

  const [position, setPosition] = useState<Vec2>(START);
  const [target, setTarget] = useState<Vec2 | null>(null);
  const [moving, setMoving] = useState(false);
  const [direction, setDirection] = useState<Direction>("south");
  const [frame, setFrame] = useState(1);
  const [mapReady, setMapReady] = useState(false);

  const getSprite = useCallback((path: string) => {
    let image = spriteCache.current.get(path);
    if (!image) {
      image = new Image();
      image.decoding = "sync";
      image.src = path;
      spriteCache.current.set(path, image);
    }
    return image;
  }, []);

  const stop = useCallback(() => {
    setMoving(false);
    setTarget(null);
    walkClockRef.current = 0;
    setFrame(1);
  }, []);

  const tryMove = useCallback((current: Vec2, dx: number, dy: number, dt: number) => {
    const length = Math.hypot(dx, dy) || 1;
    const step = SPEED * dt;
    const nx = current.x + (dx / length) * step;
    const ny = current.y + (dy / length) * step;
    if (!insideWorld(nx, ny)) return current;
    return { x: nx, y: ny };
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
        keysRef.current.add(key);
      }
      if (key === "escape") stop();
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [stop]);

  useEffect(() => {
    const tick = (time: number) => {
      const prev = lastRef.current ?? time;
      const dt = Math.min(0.04, Math.max(0, (time - prev) / 1000));
      lastRef.current = time;

      const keys = keysRef.current;
      let dx = 0;
      let dy = 0;
      if (keys.has("w") || keys.has("arrowup")) dy -= 1;
      if (keys.has("s") || keys.has("arrowdown")) dy += 1;
      if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
      if (keys.has("d") || keys.has("arrowright")) dx += 1;

      if (dx || dy) {
        const nextDir = dirFromVector(dx, dy);
        setDirection(nextDir);
        setPosition((current) => tryMove(current, dx, dy, dt));
        setTarget(null);
        setMoving(true);
      } else if (target) {
        setPosition((current) => {
          const vx = target.x - current.x;
          const vy = target.y - current.y;
          const dist = Math.hypot(vx, vy);
          if (dist < 3) {
            setMoving(false);
            setTarget(null);
            walkClockRef.current = 0;
            setFrame(1);
            return target;
          }
          const nextDir = dirFromVector(vx, vy);
          setDirection(nextDir);
          const next = tryMove(current, vx, vy, dt);
          setMoving(true);
          if (next.x === current.x && next.y === current.y) {
            setMoving(false);
            setTarget(null);
            walkClockRef.current = 0;
            setFrame(1);
          }
          return next;
        });
      } else {
        setMoving(false);
      }

      if (moving || dx || dy || target) {
        walkClockRef.current += dt;
        const nextFrame = 1 + (Math.floor(walkClockRef.current * WALK_FPS) % 8);
        setFrame(nextFrame);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
    };
  }, [moving, target, tryMove]);

  const positionPercent = useMemo(() => ({
    left: `${(position.x / MAP_W) * 100}%`,
    top: `${(position.y / MAP_H) * 100}%`,
  }), [position]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, MAP_W, MAP_H);
    ctx.imageSmoothingEnabled = false;

    const path = moving ? spritePath(direction, frame) : spritePath(direction, 1);
    const sprite = getSprite(path);
    const draw = () => {
      ctx.clearRect(0, 0, MAP_W, MAP_H);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, Math.round(position.x - PIVOT_X), Math.round(position.y - PIVOT_Y), SPRITE_W, SPRITE_H);
    };
    if (sprite.complete && sprite.naturalWidth > 0) draw();
    else sprite.onload = draw;
  }, [position, direction, frame, moving, getSprite]);

  const mapPoint = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (MAP_W / rect.width),
      y: (event.clientY - rect.top) * (MAP_H / rect.height),
    };
  };

  const walkTo = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = mapPoint(event);
    if (!insideWorld(point.x, point.y)) return;
    setTarget(point);
  };

  return (
    <main className="min-h-screen bg-[#080d16] p-4 text-[#d7f5a0]" style={{ fontFamily: '"Courier New", monospace' }}>
      <div className="mx-auto max-w-[1320px]">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-2 border-[#a9df5a] bg-[#132019] px-3 py-2">
          <div>
            <div className="text-sm font-bold">PIXELCHAT NATURE WORLD // PLAYER TEST</div>
            <div className="text-xs text-[#6ee7d8]">PLAYER 01 // 48×64 // 8-DIRECTION WALK</div>
          </div>
          <button onClick={() => { window.location.href = "/nature-test"; }} className="border-2 border-[#324159] bg-[#d7f5a0] px-3 py-2 text-xs text-[#0b111c]">EDIT MAP</button>
        </header>

        <section className="border-2 border-[#324159] bg-[#0b111c] p-2">
          <div className="relative mx-auto w-full max-w-[1254px] overflow-hidden" onPointerDown={walkTo}>
            <img ref={mapRef} src={MAP_SRC} alt="PixelChat Nature World" className="block h-auto w-full select-none" draggable={false} onLoad={() => setMapReady(true)} />
            <canvas ref={canvasRef} width={MAP_W} height={MAP_H} className="pointer-events-none absolute inset-0 h-full w-full" style={{ imageRendering: "pixelated" }} />
            <div className="pointer-events-none absolute z-20" style={{ left: positionPercent.left, top: positionPercent.top }}>
              <div style={{ width: 0, height: 0 }} aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#324159] pt-3 text-[10px] text-[#9eb0c8]">
            <div>WASD / ARROWS = walk · CLICK = move to point · ESC = stop</div>
            <div>{mapReady ? "MAP READY" : "LOADING MAP..."} · {moving ? `WALK ${frame}/8` : "IDLE"}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
