import { useEffect, useMemo, useRef, useState } from "react";

const MAP_W = 1254;
const MAP_H = 1254;
const MAP_SRC = "/nature-test-map.png";
const SPRITE_W = 48;
const SPRITE_H = 64;
const PIVOT_X = 24;
const PIVOT_Y = 62;
const WALK_FPS = 8;
const WALK_FRAMES = 4;
const SPEED = 150;

type Direction =
  | "south"
  | "south_west"
  | "west"
  | "north_west"
  | "north"
  | "north_east"
  | "east"
  | "south_east";

type Vec2 = { x: number; y: number };

const START: Vec2 = { x: 627, y: 520 };

const DIR_FILES: Record<Direction, { folder: string; idle: string; walk: string }> = {
  south: { folder: "south", idle: "south", walk: "south" },
  south_west: { folder: "south_west", idle: "southwest", walk: "southwest" },
  west: { folder: "west", idle: "west", walk: "west" },
  north_west: { folder: "north_west", idle: "northwest", walk: "northwest" },
  north: { folder: "north", idle: "north", walk: "north" },
  north_east: { folder: "north_east", idle: "northeast", walk: "northeast" },
  east: { folder: "east", idle: "east", walk: "east" },
  south_east: { folder: "south_east", idle: "southeast", walk: "southeast" },
};

function spritePath(direction: Direction, moving: boolean, frame: number) {
  const meta = DIR_FILES[direction];
  if (!moving) return `/player01/sprites/idle/${meta.folder}/player01_idle_${meta.idle}_01.png`;
  return `/player01/sprites/walk/${meta.folder}/player01_walk_${meta.walk}_${String(frame).padStart(2, "0")}.png`;
}

function dirFromVector(dx: number, dy: number): Direction {
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle >= -22.5 && angle < 22.5) return "east";
  if (angle >= 22.5 && angle < 67.5) return "south_east";
  if (angle >= 67.5 && angle < 112.5) return "south";
  if (angle >= 112.5 && angle < 157.5) return "south_west";
  if (angle >= 157.5 || angle < -157.5) return "west";
  if (angle >= -157.5 && angle < -112.5) return "north_west";
  if (angle >= -112.5 && angle < -67.5) return "north";
  return "north_east";
}

function insideWorld(x: number, y: number) {
  const cx = MAP_W / 2;
  const cy = 628;
  const rx = 618;
  const ry = 575;
  if (Math.abs((x - cx) / rx) + Math.abs((y - cy) / ry) > 0.985) return false;

  const pondCx = 627;
  const pondCy = 824;
  const pondRx = 170;
  const pondRy = 118;
  const px = (x - pondCx) / pondRx;
  const py = (y - pondCy) / pondRy;
  return px * px + py * py >= 1;
}

export default function NatureMapPlay() {
  const keysRef = useRef(new Set<string>());
  const targetRef = useRef<Vec2 | null>(null);
  const lastRef = useRef<number | null>(null);
  const frameClockRef = useRef(0);

  const [position, setPosition] = useState<Vec2>(START);
  const [target, setTarget] = useState<Vec2 | null>(null);
  const [direction, setDirection] = useState<Direction>("south");
  const [moving, setMoving] = useState(false);
  const [frame, setFrame] = useState(1);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
        keysRef.current.add(key);
      }
      if (key === "escape") {
        keysRef.current.clear();
        targetRef.current = null;
        setTarget(null);
        setMoving(false);
        frameClockRef.current = 0;
        setFrame(1);
      }
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = (time: number) => {
      const previous = lastRef.current ?? time;
      const dt = Math.min(0.04, Math.max(0, (time - previous) / 1000));
      lastRef.current = time;

      const keys = keysRef.current;
      let dx = 0;
      let dy = 0;
      if (keys.has("w") || keys.has("arrowup")) dy -= 1;
      if (keys.has("s") || keys.has("arrowdown")) dy += 1;
      if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
      if (keys.has("d") || keys.has("arrowright")) dx += 1;

      let isMoving = false;
      if (dx || dy) {
        isMoving = true;
        setTarget(null);
        targetRef.current = null;
        setDirection(dirFromVector(dx, dy));
        setPosition((current) => {
          const length = Math.hypot(dx, dy) || 1;
          const next = {
            x: current.x + (dx / length) * SPEED * dt,
            y: current.y + (dy / length) * SPEED * dt,
          };
          return insideWorld(next.x, next.y) ? next : current;
        });
      } else if (targetRef.current) {
        const destination = targetRef.current;
        setPosition((current) => {
          const vx = destination.x - current.x;
          const vy = destination.y - current.y;
          const distance = Math.hypot(vx, vy);
          if (distance < 3) {
            targetRef.current = null;
            setTarget(null);
            return destination;
          }
          isMoving = true;
          setDirection(dirFromVector(vx, vy));
          const length = distance || 1;
          const step = Math.min(distance, SPEED * dt);
          const next = {
            x: current.x + (vx / length) * step,
            y: current.y + (vy / length) * step,
          };
          if (!insideWorld(next.x, next.y)) {
            targetRef.current = null;
            setTarget(null);
            return current;
          }
          return next;
        });
      }

      setMoving(isMoving);
      if (isMoving) {
        frameClockRef.current += dt;
        setFrame(1 + (Math.floor(frameClockRef.current * WALK_FPS) % WALK_FRAMES));
      } else {
        frameClockRef.current = 0;
        setFrame(1);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lastRef.current = null;
    };
  }, []);

  const spriteSrc = useMemo(() => spritePath(direction, moving, frame), [direction, moving, frame]);

  const positionPercent = useMemo(
    () => ({ left: `${(position.x / MAP_W) * 100}%`, top: `${(position.y / MAP_H) * 100}%` }),
    [position],
  );

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
    targetRef.current = point;
    setTarget(point);
  };

  return (
    <main className="min-h-screen bg-[#080d16] p-4 text-[#d7f5a0]" style={{ fontFamily: '"Courier New", monospace' }}>
      <div className="mx-auto max-w-[1320px]">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-2 border-[#a9df5a] bg-[#132019] px-3 py-2">
          <div>
            <div className="text-sm font-bold">PIXELCHAT NATURE WORLD // PLAYER TEST</div>
            <div className="text-xs text-[#6ee7d8]">PLAYER 01 // 48×64 // 8-DIRECTION WALK // 4-FRAME CYCLE</div>
          </div>
          <button onClick={() => { window.location.href = "/nature-test"; }} className="border-2 border-[#324159] bg-[#d7f5a0] px-3 py-2 text-xs text-[#0b111c]">EDIT MAP</button>
        </header>

        <section className="border-2 border-[#324159] bg-[#0b111c] p-2">
          <div className="relative mx-auto w-full max-w-[1254px] overflow-hidden" onPointerDown={walkTo}>
            <img src={MAP_SRC} alt="PixelChat Nature World" className="block h-auto w-full select-none" draggable={false} onLoad={() => setMapReady(true)} />
            <img
              src={spriteSrc}
              alt="Player 01"
              draggable={false}
              className="pointer-events-none absolute z-20"
              style={{
                left: positionPercent.left,
                top: positionPercent.top,
                width: SPRITE_W,
                height: SPRITE_H,
                maxWidth: "none",
                transform: `translate(${-PIVOT_X}px, ${-PIVOT_Y}px)`,
                imageRendering: "pixelated",
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#324159] pt-3 text-[10px] text-[#9eb0c8]">
            <div>WASD / ARROWS = walk · CLICK = move to point · ESC = stop</div>
            <div>{mapReady ? "MAP READY" : "LOADING MAP..."} · {moving ? `WALK ${frame}/4` : "IDLE"} · {target ? "MOVING TO TARGET" : ""}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
