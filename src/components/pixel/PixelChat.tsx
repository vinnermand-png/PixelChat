import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GRID,
  VIEW_H,
  VIEW_W,
  drawAvatar,
  drawCabin,
  drawOldInn,
  drawBench,
  drawFountain,
  drawLamp,
  drawCampfire,
  drawFireLight,
  drawGround,
  drawTorvetGround,
  drawItem,
  drawRock,
  drawSign,
  drawTree,
  drawBush,
  drawFlower,
  iso,
  unIso,
  type ItemKind,
  type Vec,
} from "./world";

type Mood = "WAVE" | "HAPPY" | "SAD" | "SLEEP" | "DANCE";

const MOOD_ICON: Record<Mood, string> = {
  WAVE: "o/",
  HAPPY: ":D",
  SAD: ":(",
  SLEEP: "zZ",
  DANCE: "^^",
};

type Actor = {
  id: string;
  name: string;
  body: string;
  hair: string;
  bio?: string;
  pos: Vec;
  target: Vec;
  bubble?: { text: string; until: number } | undefined;
  mood?: { m: Mood; until: number } | undefined;
  nextTalk: number;
};

type Channel = "ROOM" | "WHISPER" | "PLAYERS" | "FRIENDS";

type ChatLine = {
  id: number;
  name: string;
  text: string;
  body: string;
  scope: "ROOM" | "WHISPER" | "SYSTEM";
  room?: string;
  to?: string;
};

type RoomId = "torvet" | "PINE_WOODS" | "FROST_VILLAGE" | "MOONLAKE" | "EMBER_TAVERN";
type ExitDirection = "N" | "E" | "S" | "W";
type RoomExit = { direction: ExitDirection; target: RoomId };
type RoomDef = { id: RoomId; name: string; exits: RoomExit[] };

const ROOMS: Record<RoomId, RoomDef> = {
  torvet: {
    id: "torvet",
    name: "TORVET",
    exits: [
      { direction: "N", target: "PINE_WOODS" },
      { direction: "E", target: "FROST_VILLAGE" },
      { direction: "S", target: "MOONLAKE" },
      { direction: "W", target: "EMBER_TAVERN" },
    ],
  },
  PINE_WOODS: {
    id: "PINE_WOODS",
    name: "PINE WOODS",
    exits: [{ direction: "S", target: "torvet" }],
  },
  FROST_VILLAGE: {
    id: "FROST_VILLAGE",
    name: "FROST VILLAGE",
    exits: [{ direction: "W", target: "torvet" }],
  },
  MOONLAKE: {
    id: "MOONLAKE",
    name: "MOONLAKE",
    exits: [{ direction: "N", target: "torvet" }],
  },
  EMBER_TAVERN: {
    id: "EMBER_TAVERN",
    name: "EMBER TAVERN",
    exits: [{ direction: "E", target: "torvet" }],
  },
};

const EXIT_ZONES: Record<ExitDirection, { x1: number; y1: number; x2: number; y2: number }> = {
  N: { x1: 145, y1: 25, x2: 335, y2: 70 },
  E: { x1: 390, y1: 118, x2: 478, y2: 205 },
  S: { x1: 175, y1: 252, x2: 315, y2: 299 },
  W: { x1: 2, y1: 118, x2: 90, y2: 205 },
};

const OPPOSITE: Record<ExitDirection, ExitDirection> = { N: "S", E: "W", S: "N", W: "E" };

const ROOM_NAMES: Record<RoomId, string> = Object.fromEntries(
  Object.values(ROOMS).map((room) => [room.id, room.name]),
) as Record<RoomId, string>;


type WorldItem = { id: number; kind: ItemKind; pos: Vec };

const FIRE: Vec = { gx: 6.5, gy: 6.5 };
const SIGN: Vec = { gx: 8.5, gy: 10.5 };
const TREES: Vec[] = [
  { gx: 0.5, gy: 2.2 }, { gx: 1.2, gy: 4.1 }, { gx: 1.0, gy: 9.6 },
  { gx: 2.0, gy: 12.1 }, { gx: 4.4, gy: 12.8 }, { gx: 8.7, gy: 12.4 },
  { gx: 11.3, gy: 11.6 }, { gx: 12.8, gy: 8.8 }, { gx: 12.2, gy: 4.0 },
  { gx: 10.8, gy: 1.3 }, { gx: 8.2, gy: 0.7 }, { gx: 3.2, gy: 0.8 },
  { gx: 2.6, gy: 5.8 }, { gx: 10.9, gy: 6.2 },
];
const ROCKS: Vec[] = [{ gx: 2.7, gy: 8.5 }, { gx: 10.9, gy: 3.2 }];
const CABIN: Vec = { gx: 2.5, gy: 3.5 };

const ITEM_LABEL: Record<ItemKind, string> = {
  log: "FIREWOOD",
  berry: "ICEBERRY",
  shard: "FROSTSHARD",
};
const ITEM_KINDS: ItemKind[] = ["log", "berry", "shard"];

const DEMO_LINES = [
  "brb feeding the fire",
  "snow's coming down hard",
  "anyone got spare firewood?",
  "trading 2 iceberry for a frostshard",
  "lag or is it just cold",
  "meet at the notice board",
  "gm travellers",
  "i heard wolves out east",
];
const DEMO_REPLIES = ["true", "haha same", "nice one", "wait what", "+1", "agreed", "lol"];
const DEMO_WHISPERS = [
  "psst... found a shard by the cabin",
  "don't tell anyone but the fire drops wood",
  "wanna team up at the board?",
];

function drawPixelArrow(ctx: CanvasRenderingContext2D, direction: ExitDirection, alpha = 1) {
  const centers: Record<ExitDirection, { x: number; y: number }> = {
    N: { x: 240, y: 42 },
    E: { x: 432, y: 160 },
    S: { x: 240, y: 277 },
    W: { x: 48, y: 160 },
  };
  const c = centers[direction];
  const step = 4;
  const pixels: Record<ExitDirection, [number, number][]> = {
    N: [[0,-5],[0,-3],[0,-1],[-1,-1],[1,-1],[-2,1],[2,1],[-3,3],[-2,3],[-1,3],[0,3],[1,3],[2,3],[3,3]],
    S: [[0,5],[0,3],[0,1],[-1,1],[1,1],[-2,-1],[2,-1],[-3,-3],[-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],[3,-3]],
    E: [[5,0],[3,0],[1,0],[1,-1],[1,1],[-1,-2],[-1,2],[-3,-3],[-3,-2],[-3,-1],[-3,0],[-3,1],[-3,2],[-3,3]],
    W: [[-5,0],[-3,0],[-1,0],[-1,-1],[-1,1],[1,-2],[1,2],[3,-3],[3,-2],[3,-1],[3,0],[3,1],[3,2],[3,3]],
  };
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ff39c8";
  for (const [dx, dy] of pixels[direction]) ctx.fillRect(Math.round(c.x + dx * step), Math.round(c.y + dy * step), step, step);
  ctx.fillStyle = "#ffd4f5";
  for (const [dx, dy] of pixels[direction].slice(0, 3)) ctx.fillRect(Math.round(c.x + dx * step - 1), Math.round(c.y + dy * step - 1), 2, 2);
  ctx.restore();
}

const NOTICE = [
  "NOTICE BOARD: warm up at the fire, gain karma by talking.",
  "NOTICE BOARD: collect firewood, iceberries and frostshards.",
  "NOTICE BOARD: whisper a traveller with /w name message.",
];

const makeDemo = (room: RoomId = "torvet"): Actor[] =>
  [
    { id: "d1", name: "Frostbyte", body: "#3f7cd6", hair: "#2b2135", bio: "quiet at first, loud by the fire", pos: { gx: 8.5, gy: 5.2 } },
    { id: "d2", name: "SnowGoose", body: "#c8543f", hair: "#5a3a1e", bio: "always one snowball ahead", pos: { gx: 5.2, gy: 8.4 } },
    { id: "d3", name: "pix_el", body: "#57b46a", hair: "#22212b", bio: "pixel tinkerer", pos: { gx: 9.4, gy: 8.6 } },
    { id: "d4", name: "OldTimer", body: "#8f6bc4", hair: "#c9d8ee", bio: "seen a few campfires", pos: { gx: 4.4, gy: 5.6 } },
    { id: "d5", name: "nyx", body: "#d8a13a", hair: "#1e1a26", bio: "night traveller", pos: { gx: 11, gy: 7.5 } },
  ].map((a, i) => {
    const offsets: Record<RoomId, Vec[]> = {
      torvet: [],
      PINE_WOODS: [{ gx: -2, gy: 1.5 }, { gx: -1, gy: -1 }, { gx: 1.5, gy: 0 }, { gx: 2, gy: 1 }, { gx: -1, gy: 2 }],
      FROST_VILLAGE: [{ gx: 1.5, gy: 0 }, { gx: 0, gy: 1.5 }, { gx: -1, gy: 0 }, { gx: 1, gy: 2 }, { gx: -1.5, gy: 2 }],
      MOONLAKE: [{ gx: 1, gy: 1 }, { gx: -1.5, gy: 1.2 }, { gx: 2, gy: -0.5 }, { gx: -2, gy: 0 }, { gx: 0, gy: -1.5 }],
      EMBER_TAVERN: [{ gx: 0, gy: 1.5 }, { gx: -1.5, gy: 0 }, { gx: 1.2, gy: 0 }, { gx: -2, gy: 1.5 }, { gx: 2, gy: -1 }],
    };
    const off = offsets[room][i] ?? { gx: 0, gy: 0 };
    const base = room === "torvet" ? a.pos : { gx: a.pos.gx + off.gx, gy: a.pos.gy + off.gy };
    const pos = { gx: clamp(base.gx), gy: clamp(base.gy) };
    return { ...a, pos, target: { ...pos }, nextTalk: 3000 + Math.random() * 12000 };
  });

const clamp = (v: number) => Math.max(0.4, Math.min(GRID - 1.4, v));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const dist = (a: Vec, b: Vec) => Math.hypot(a.gx - b.gx, a.gy - b.gy);


let itemSeq = 1;
const spawnItem = (): WorldItem => ({
  id: itemSeq++,
  kind: pick(ITEM_KINDS),
  pos: { gx: clamp(Math.random() * GRID), gy: clamp(Math.random() * GRID) },
});

export default function PixelChat({ username }: { username: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const player = useRef<Actor>({
    id: "me",
    name: username,
    body: "#e0e5f2",
    hair: "#8a3f2a",
    pos: { gx: 6.5, gy: 8.6 },
    target: { gx: 6.5, gy: 8.6 },
    nextTalk: Infinity,
  });
  const demos = useRef<Actor[]>(makeDemo("torvet"));
  const currentRoomRef = useRef<RoomId>("torvet");
  const hoveredExitRef = useRef<ExitDirection | null>(null);
  const items = useRef<WorldItem[]>([spawnItem(), spawnItem(), spawnItem(), spawnItem()]);

  const [labels, setLabels] = useState<
    {
      id: string;
      name: string;
      body: string;
      x: number;
      y: number;
      bubble?: string | undefined;
      mood?: string | undefined;
      status?: string | undefined;
    }[]
  >([]);
  const [radar, setRadar] = useState<{ id: string; gx: number; gy: number; body: string }[]>([]);
  const [roster, setRoster] = useState<
    { id: string; name: string; body: string; near: boolean; mood?: Mood | undefined }[]
  >([]);
  const [log, setLog] = useState<ChatLine[]>([
    {
      id: 0,
      name: "SYSTEM",
      text: "connected to torvet // 6 travellers online // room chat ready",
      body: "#57b46a",
      scope: "SYSTEM",
      room: "torvet",
    },
    { id: -1, name: "SYSTEM", text: "TORVET: meet by the fountain and find a room to explore.", body: "#57b46a", scope: "SYSTEM", room: "torvet" },
  ]);
  const [channel, setChannel] = useState<Channel>("ROOM");
  const [currentRoom, setCurrentRoom] = useState<RoomId>("torvet");
  const [hoveredExit, setHoveredExit] = useState<ExitDirection | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; x: number; y: number } | null>(null);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [friends, setFriends] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [isAfk, setIsAfk] = useState(false);
  const [mentions, setMentions] = useState(0);
  const lastActivity = useRef(performance.now());
  const afkRef = useRef(false);
  const [karma, setKarma] = useState(4);
  const [bag, setBag] = useState<Record<ItemKind, number>>({ log: 0, berry: 0, shard: 0 });
  const logRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const markActivity = useCallback(() => {
    lastActivity.current = performance.now();
    afkRef.current = false;
    setIsAfk(false);
  }, []);

  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  const push = useCallback((line: Omit<ChatLine, "id">) => {
    setLog((l) => [...l.slice(-60), { id: nextId.current++, ...line }]);
  }, []);

  const enterRoom = useCallback((nextRoom: RoomId) => {
    currentRoomRef.current = nextRoom;
    setCurrentRoom(nextRoom);
    setHoveredExit(null);
    hoveredExitRef.current = null;
    setSelectedPlayer(null);
    setProfilePlayerId(null);
    setChannel("ROOM");
    setDraft("");
    player.current.pos = { gx: 6.5, gy: 8.6 };
    player.current.target = { gx: 6.5, gy: 8.6 };
    demos.current = makeDemo(nextRoom);
    push({
      name: "SYSTEM",
      text: `entered ${ROOM_NAMES[nextRoom].toLowerCase()}`,
      body: "#57b46a",
      scope: "SYSTEM",
      room: nextRoom,
    });
  }, [push]);


  const say = useCallback(
    (actor: Actor, text: string, scope: ChatLine["scope"] = "ROOM", to?: string) => {
      if (actor.id === "me") markActivity();
      actor.bubble = { text: scope === "WHISPER" ? `(w) ${text}` : text, until: performance.now() + 4200 };
      push({
        name: actor.name,
        text,
        body: actor.body,
        scope,
        ...(scope === "ROOM" ? { room: currentRoomRef.current } : {}),
        ...(to ? { to } : {}),
      });
    },
    [markActivity, push],
  );

  const emote = useCallback(
    (actor: Actor, m: Mood) => {
      actor.mood = { m, until: performance.now() + 3600 };
      push({ name: actor.name, text: `*${m.toLowerCase()}s*`, body: actor.body, scope: "ROOM", room: currentRoomRef.current });
    },
    [push],
  );

  useEffect(() => {
    player.current.name = username;
  }, [username]);

  useEffect(() => {
    if (channel !== "PLAYERS") logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log, channel]);

  useEffect(() => {
    const onActivity = () => markActivity();
    window.addEventListener("pointermove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    const timer = window.setInterval(() => {
      const nextAfk = performance.now() - lastActivity.current > 30000;
      if (afkRef.current !== nextAfk) {
        afkRef.current = nextAfk;
        setIsAfk(nextAfk);
      }
    }, 1000);
    return () => {
      window.removeEventListener("pointermove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.clearInterval(timer);
    };
  }, [markActivity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    let last = performance.now();
    let sinceSync = 0;

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const me = player.current;
      const all = [me, ...demos.current];

      for (const a of all) {
        const dx = a.target.gx - a.pos.gx;
        const dy = a.target.gy - a.pos.gy;
        const d = Math.hypot(dx, dy);
        const speed = 2.2;
        if (d > 0.02) {
          const m = Math.min(d, speed * dt);
          a.pos.gx += (dx / d) * m;
          a.pos.gy += (dy / d) * m;
        }
        if (a.bubble && a.bubble.until < now) a.bubble = undefined;
        if (a.mood && a.mood.until < now) a.mood = undefined;
      }

      // pick up nearby world items
      for (const it of items.current.slice()) {
        if (dist(it.pos, me.pos) < 0.7) {
          items.current = items.current.filter((x) => x.id !== it.id);
          items.current.push(spawnItem());
          setBag((b) => ({ ...b, [it.kind]: b[it.kind] + 1 }));
          setKarma((k) => k + 3);
          push({
            name: "SYSTEM",
            text: `picked up 1x ${ITEM_LABEL[it.kind]} (+3 karma)`,
            body: "#57b46a",
            scope: "SYSTEM",
            room: currentRoomRef.current,
          });
        }
      }

      for (const d of demos.current) {
        d.nextTalk -= dt * 1000;
        if (d.nextTalk <= 0) {
          d.nextTalk = 9000 + Math.random() * 16000;
          const roll = Math.random();
          if (roll < 0.45) say(d, pick(DEMO_LINES));
          else if (roll < 0.6) emote(d, pick(Object.keys(MOOD_ICON) as Mood[]));
          else if (roll < 0.68) say(d, pick(DEMO_WHISPERS), "WHISPER", me.name);
          d.target = {
            gx: clamp(d.pos.gx + (Math.random() * 4 - 2)),
            gy: clamp(d.pos.gy + (Math.random() * 4 - 2)),
          };
        }
      }

      ctx.fillStyle = "#0e1322";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const isTorvet = currentRoomRef.current === "torvet";
      if (isTorvet) drawTorvetGround(ctx);
      else drawGround(ctx);
      if (!isTorvet) drawFireLight(ctx, FIRE, now);
      const roomDef = ROOMS[currentRoomRef.current];
      for (const exit of roomDef.exits) {
        if (hoveredExitRef.current === exit.direction) drawPixelArrow(ctx, exit.direction, 1);
      }

      type Item = { d: number; draw: () => void };
      const torvetDecor: Item[] = isTorvet
        ? [
            // Small north landmark.
            { d: 8.0, draw: () => drawOldInn(ctx, 5.4, 3.7) },
            // One iconic, compact social landmark.
            { d: 13.0, draw: () => drawFountain(ctx, 6.5, 6.7, now) },
            // Small social seating area in the south.
            { d: 15.0, draw: () => drawBench(ctx, 5.0, 9.6) },
            { d: 15.2, draw: () => drawBench(ctx, 7.9, 9.6, true) },
            { d: 16.0, draw: () => drawBench(ctx, 6.4, 10.4) },
            // Simple lighting around the centre, kept sparse.
            { d: 9.6, draw: () => drawLamp(ctx, 4.7, 5.8) },
            { d: 10.0, draw: () => drawLamp(ctx, 8.4, 5.9) },
            { d: 15.8, draw: () => drawLamp(ctx, 4.8, 9.0) },
            { d: 16.0, draw: () => drawLamp(ctx, 8.3, 9.0) },
            // Natural edge accents; intentionally small and asymmetrical.
            { d: 6.5, draw: () => drawBush(ctx, 2.6, 4.3, 0) },
            { d: 9.0, draw: () => drawBush(ctx, 9.9, 4.8, 1) },
            { d: 18.0, draw: () => drawBush(ctx, 3.0, 10.9, 1) },
            { d: 17.0, draw: () => drawBush(ctx, 10.2, 10.4, 0) },
            { d: 5.0, draw: () => drawFlower(ctx, 3.5, 5.2, '#f17ea8') },
            { d: 7.0, draw: () => drawFlower(ctx, 9.2, 5.0, '#f4d447') },
            { d: 18.5, draw: () => drawFlower(ctx, 4.0, 11.0, '#f6f1cf') },
            { d: 18.8, draw: () => drawFlower(ctx, 9.6, 10.9, '#f17ea8') },
          ]
        : [
            { d: CABIN.gx + CABIN.gy, draw: () => drawCabin(ctx, CABIN.gx, CABIN.gy) },
            { d: FIRE.gx + FIRE.gy, draw: () => drawCampfire(ctx, FIRE.gx, FIRE.gy, now) },
            { d: SIGN.gx + SIGN.gy, draw: () => drawSign(ctx, SIGN.gx, SIGN.gy) },
          ];

      const queue: Item[] = [
        ...torvetDecor,
        ...TREES.map((t) => ({ d: t.gx + t.gy, draw: () => drawTree(ctx, t.gx, t.gy) })),
        ...ROCKS.map((r) => ({ d: r.gx + r.gy, draw: () => drawRock(ctx, r.gx, r.gy) })),
        ...items.current.map((it) => ({
          d: it.pos.gx + it.pos.gy,
          draw: () => drawItem(ctx, it.pos.gx, it.pos.gy, it.kind, now),
        })),
        ...all.map((a) => ({
          d: a.pos.gx + a.pos.gy,
          draw: () =>
            drawAvatar(
              ctx,
              a.pos.gx,
              a.pos.gy,
              a.body,
              a.hair,
              Math.hypot(a.target.gx - a.pos.gx, a.target.gy - a.pos.gy) > 0.05,
              now,
            ),
        })),
      ];
      queue.sort((a, b) => a.d - b.d);
      for (const it of queue) it.draw();

      setLabels(
        all.map((a) => {
          const p = iso(a.pos.gx, a.pos.gy);
          return {
            id: a.id,
            name: a.name,
            body: a.body,
            x: (p.x / VIEW_W) * 100,
            y: (p.y / VIEW_H) * 100,
            bubble: a.bubble?.text,
            mood: a.mood ? MOOD_ICON[a.mood.m] : undefined,
            status: a.id === "me" && afkRef.current ? "AFK" : undefined,
          };
        }),
      );

      sinceSync += dt;
      if (sinceSync > 0.4) {
        sinceSync = 0;
        setRadar(all.map((a) => ({ id: a.id, gx: a.pos.gx, gy: a.pos.gy, body: a.body })));
        setRoster(
          demos.current.map((a) => ({
            id: a.id,
            name: a.name,
            body: a.body,
            near: true,
            mood: a.mood?.m,
          })),
        );
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [say, emote, push]);

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    const room = ROOMS[currentRoomRef.current];
    const hit = room.exits.find((exit) => {
      const z = EXIT_ZONES[exit.direction];
      return x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2;
    })?.direction ?? null;
    hoveredExitRef.current = hit;
    setHoveredExit(hit);
  };

  const onMouseLeave = () => {
    hoveredExitRef.current = null;
    setHoveredExit(null);
  };

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    markActivity();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;

    const hovered = hoveredExitRef.current;
    const exit = hovered
      ? ROOMS[currentRoomRef.current].exits.find((candidate) => candidate.direction === hovered)
      : undefined;
    if (exit) {
      enterRoom(exit.target);
      return;
    }

    const clicked = demos.current
      .map((actor) => ({
        actor,
        point: iso(actor.pos.gx, actor.pos.gy),
      }))
      .map(({ actor, point }) => ({
        actor,
        point,
        distance: Math.hypot(point.x - x, point.y - y),
      }))
      .filter(({ distance }) => distance < 28)
      .sort((a, b) => a.distance - b.distance)[0];

    if (clicked) {
      setSelectedPlayer({
        id: clicked.actor.id,
        x: (clicked.point.x / VIEW_W) * 100,
        y: (clicked.point.y / VIEW_H) * 100,
      });
      setProfilePlayerId(null);
      return;
    }

    setSelectedPlayer(null);
    const g = unIso(x, y);
    const target = { gx: clamp(g.gx), gy: clamp(g.gy) };
    player.current.target = target;
    if (dist(target, SIGN) < 1.6) {
      push({ name: "SYSTEM", text: pick(NOTICE), body: "#57b46a", scope: "SYSTEM", room: currentRoomRef.current });
    }
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = draft.trim().slice(0, 120);
    if (!raw) return;
    const me = player.current;
    markActivity();

    const mentionMatch = new RegExp(`@${me.name}\\b`, "i").test(raw);
    if (mentionMatch) setMentions((n) => n + 1);

    const whisper = /^\/w\s+(\S+)\s+(.+)$/i.exec(raw);
    if (whisper) {
      const [, to, text] = whisper;
      const target = demos.current.find((d) => d.name.toLowerCase() === to!.toLowerCase());
      if (!target) {
        push({ name: "SYSTEM", text: `no traveller named ${to}`, body: "#c8543f", scope: "SYSTEM", room: currentRoomRef.current });
      } else {
        say(me, text!, "WHISPER", target.name);
        setKarma((k) => k + 1);
        window.setTimeout(() => say(target, pick(DEMO_REPLIES), "WHISPER", me.name), 1600);
      }
      setDraft("");
      return;
    }

    const roomUsers = demos.current;
    say(me, raw, "ROOM");
    setKarma((k) => k + 1);
    if (roomUsers.length && Math.random() < 0.6) {
      const responder = pick(roomUsers);
      window.setTimeout(
        () => (Math.random() < 0.35 ? emote(responder, "HAPPY") : say(responder, pick(DEMO_REPLIES))),
        900 + Math.random() * 1400,
      );
    }
    setDraft("");
  };

  const toggleFriend = useCallback((name: string) => {
    const exists = friends.some((friend) => friend.toLowerCase() === name.toLowerCase());
    setFriends((current) =>
      exists
        ? current.filter((friend) => friend.toLowerCase() !== name.toLowerCase())
        : [...current, name],
    );
    push({
      name: "SYSTEM",
      text: exists ? `removed ${name} from friends` : `${name} added to friends`,
      body: "#57b46a",
      scope: "SYSTEM",
      room: currentRoomRef.current,
    });
  }, [friends, push]);

  const visible = useMemo(() => {
    if (channel === "WHISPER") return log.filter((l) => l.scope === "WHISPER");
    return log.filter((l) => (l.scope === "ROOM" && l.room === currentRoom) || (l.scope === "SYSTEM" && l.room === currentRoom));
  }, [log, channel, currentRoom]);

  const level = Math.floor(karma / 12) + 1;
  const whispers = log.filter((l) => l.scope === "WHISPER").length;

  return (
    <div className="mx-auto w-full max-w-[900px] px-3 pb-6">
      <div className="pixel-frame relative">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={VIEW_W}
            height={VIEW_H}
            onClick={onClick}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            className={`pixelated block w-full ${hoveredExit ? "cursor-pointer" : "cursor-crosshair"}`}
            style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
            aria-label="Isometric pixel social world. Click to walk, meet travellers and chat."
          />
          <div className="pointer-events-none absolute inset-0">
            {labels.map((l) => (
              <div
                key={l.id}
                className="absolute -translate-x-1/2"
                style={{ left: `${l.x}%`, top: `${l.y}%` }}
              >
                <div className="absolute bottom-[2.4em] left-1/2 -translate-x-1/2 whitespace-nowrap">
                  {l.bubble ? (
                    <div className="pixel-bubble mb-1 max-w-[22ch] whitespace-normal text-center">
                      {l.bubble}
                    </div>
                  ) : null}
                  {l.mood ? (
                    <div className="pixel-tag mb-1 text-center" style={{ color: l.body }}>
                      {l.mood}
                    </div>
                  ) : null}
                  {l.status ? (
                    <div className="pixel-tag mb-1 text-center text-primary">[AFK]</div>
                  ) : null}
                  <div className="pixel-tag text-center" style={{ color: l.body }}>
                    {l.name}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedPlayer ? (
            <div
              className="pointer-events-auto absolute z-20"
              style={{ left: `${selectedPlayer.x}%`, top: `${selectedPlayer.y}%`, transform: "translate(-50%, -8px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {profilePlayerId ? (
                <div className="w-[148px] border-4 border-border bg-card p-2 shadow-[4px_4px_0_var(--border)]">
                  {(() => {
                    const actor = demos.current.find((d) => d.id === profilePlayerId);
                    if (!actor) return null;
                    return (
                      <>
                        <div className="mb-2 text-center text-[11px]" style={{ color: actor.body }}>
                          {actor.name}
                        </div>
                        <div className="mb-2 text-center text-[8px] text-primary">● ONLINE</div>
                        <div className="mb-2 text-[8px] leading-[1.6] text-muted-foreground">
                          snowhollow traveller
                        </div>
                        <button
                          className="pixel-hud w-full"
                          onClick={() => setProfilePlayerId(null)}
                        >
                          BACK
                        </button>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="w-[148px] border-4 border-border bg-card p-1 shadow-[4px_4px_0_var(--border)]">
                  {(() => {
                    const actor = demos.current.find((d) => d.id === selectedPlayer.id);
                    if (!actor) return null;
                    return (
                      <>
                        <div className="border-b-4 border-border px-2 py-1 text-center text-[10px]" style={{ color: actor.body }}>
                          {actor.name}
                        </div>
                        <button
                          className="pixel-hud mt-1 w-full"
                          onClick={() => setProfilePlayerId(actor.id)}
                        >
                          PROFILE
                        </button>
                        <button
                          className="pixel-hud mt-1 w-full"
                          onClick={() => toggleFriend(actor.name)}
                        >
                          {friends.some((f) => f.toLowerCase() === actor.name.toLowerCase()) ? "UNFRIEND" : "ADD FRIEND"}
                        </button>
                        <button
                          className="pixel-hud mt-1 w-full"
                          onClick={() => {
                            markActivity();
                            setChannel("WHISPER");
                            setDraft(`/w ${actor.name} `);
                            setSelectedPlayer(null);
                          }}
                        >
                          WHISPER
                        </button>
                        <button
                          className="mt-1 w-full border-2 border-border px-2 py-1 text-[8px] text-muted-foreground"
                          onClick={() => setSelectedPlayer(null)}
                        >
                          CLOSE
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : null}

          <div className="pixel-hud absolute left-2 top-2">CLICK GROUND TO WALK</div>
          <div className="pixel-hud absolute right-2 top-2">{ROOM_NAMES[currentRoom]} &middot; 6/20</div>

          {/* karma + inventory */}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
            <span className="pixel-hud">LV{level}</span>
            <span className="pixel-hud">KARMA {karma}</span>
            <span className="pixel-hud">WOOD {bag.log}</span>
            <span className="pixel-hud">BERRY {bag.berry}</span>
            <span className="pixel-hud">SHARD {bag.shard}</span>
          </div>

          {/* radar minimap */}
          <div
            className="absolute bottom-2 right-2 border-2 border-border bg-background"
            style={{ width: 54, height: 54 }}
            aria-label="Minimap"
          >
            {radar.map((r) => (
              <span
                key={r.id}
                className="absolute"
                style={{
                  left: `${(r.gx / GRID) * 100}%`,
                  top: `${(r.gy / GRID) * 100}%`,
                  width: 4,
                  height: 4,
                  backgroundColor: r.body,
                }}
              />
            ))}
          </div>
        </div>

        <div className="border-t-4 border-border bg-card">
          <div className="flex flex-wrap items-center gap-1 border-b-4 border-border px-2 py-1">
            <span className="pixel-tag mr-1 text-[8px] text-primary">ROOM: {ROOM_NAMES[currentRoom]}</span>
            {(["ROOM", "WHISPER", "PLAYERS", "FRIENDS"] as Channel[]).map((c) => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                className="pixel-hud"
                style={
                  channel === c
                    ? { color: "var(--color-primary-foreground)", backgroundColor: "var(--color-primary)" }
                    : undefined
                }
              >
                {c}
                {c === "WHISPER" && whispers ? ` ${whispers}` : ""}
                {c === "ROOM" && mentions ? ` @${mentions}` : ""}
                {c === "FRIENDS" && friends.length ? ` ${friends.length}` : ""}
              </button>
            ))}
          </div>

          <div ref={logRef} className="pixel-scroll h-[124px] overflow-y-auto px-2 py-1">
            {channel === "PLAYERS" ? (
              <ul>
                <li className="mb-1 text-[9px] leading-[1.6] text-primary">
                  [{username}] you &middot; LV{level}{isAfk ? " &middot; AFK" : ""}
                </li>
                {roster.map((r) => (
                  <li key={r.id} className="mb-1 flex items-center gap-2 text-[9px] leading-[1.6]">
                    <span style={{ color: r.body }}>[{r.name}]</span>
                    <span className="text-muted-foreground">
                      {r.near ? "IN ROOM" : "OUTSIDE"}
                      {r.mood ? ` ${MOOD_ICON[r.mood]}` : ""}
                    </span>
                    <button className="pixel-hud" onClick={() => toggleFriend(r.name)}>
                      {friends.some((f) => f.toLowerCase() === r.name.toLowerCase()) ? "FRIEND" : "+FRIEND"}
                    </button>
                    <button
                      className="pixel-hud"
                      onClick={() => {
                        setChannel("WHISPER");
                        setDraft(`/w ${r.name} `);
                      }}
                    >
                      WHISPER
                    </button>
                  </li>
                ))}
              </ul>
            ) : channel === "FRIENDS" ? (
              <ul>
                {!friends.length ? (
                  <li className="text-[9px] leading-[1.6] text-muted-foreground">NO FRIENDS YET</li>
                ) : (
                  friends.map((name) => {
                    const r = roster.find((p) => p.name.toLowerCase() === name.toLowerCase());
                    return (
                      <li key={name} className="mb-1 flex items-center gap-2 text-[9px] leading-[1.6]">
                        <span style={{ color: r?.body ?? "var(--color-primary)" }}>[{name}]</span>
                        <span className="text-muted-foreground">{r?.near ? "IN ROOM" : "ONLINE"}</span>
                        <button
                          className="pixel-hud"
                          onClick={() => {
                            setChannel("WHISPER");
                            setDraft(`/w ${name} `);
                          }}
                        >
                          WHISPER
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            ) : (
              visible.map((l) => (
                <p key={l.id} className="mb-1 text-[9px] leading-[1.6]">
                  <span style={{ color: l.body }}>[{l.name}]</span>{" "}
                  {l.scope === "WHISPER" ? (
                    <span className="text-accent">(whisper{l.to ? ` to ${l.to}` : ""}) </span>
                  ) : null}
                  <span
                    className={
                      l.scope === "ROOM" ? "text-foreground" : "text-foreground"
                    }
                    style={
                      l.text.toLowerCase().includes(`@${username.toLowerCase()}`)
                        ? { color: "var(--color-primary)" }
                        : undefined
                    }
                  >
                    {l.text}
                  </span>
                </p>
              ))
            )}
          </div>

          <div className="flex flex-wrap gap-1 border-t-4 border-border px-2 py-1">
            {(Object.keys(MOOD_ICON) as Mood[]).map((m) => (
              <button
                key={m}
                className="pixel-hud"
                onClick={() => {
                  emote(player.current, m);
                  setKarma((k) => k + 1);
                }}
              >
                {MOOD_ICON[m]} {m}
              </button>
            ))}
          </div>

          <form onSubmit={send} className="flex gap-2 border-t-4 border-border p-2">
            <span className="self-center text-[9px] text-primary">&gt;</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={120}
              placeholder={channel === "WHISPER" ? "/w name message" : `chat in ${ROOM_NAMES[currentRoom].toLowerCase()}...`}
              className="pixel-input min-w-0 flex-1"
              aria-label="Chat message"
            />
            <button type="submit" className="pixel-btn">
              SEND
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
