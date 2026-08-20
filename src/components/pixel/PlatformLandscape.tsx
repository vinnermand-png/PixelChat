import { useEffect, useRef } from "react";
import GameMaker from "@/components/pixel/GameMaker";

const BG = { r: 9, g: 19, b: 32 };

function closeToBackground(r: number, g: number, b: number, a: number) {
  if (a < 8) return true;
  return Math.abs(r - BG.r) + Math.abs(g - BG.g) + Math.abs(b - BG.b) < 28;
}

function edgeShade(r: number, g: number, b: number, step: number) {
  const shade = step === 0 ? 0.72 : step < 4 ? 0.58 : 0.43;
  return [Math.max(0, Math.round(r * shade)), Math.max(0, Math.round(g * shade)), Math.max(0, Math.round(b * shade))] as const;
}

export default function PlatformLandscape() {
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let raf = 0;
    let source: HTMLCanvasElement | null = null;
    let overlay: HTMLCanvasElement | null = null;

    const sync = () => {
      if (!source || !source.isConnected) {
        const canvases = Array.from(document.querySelectorAll("canvas")) as HTMLCanvasElement[];
        source = canvases.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] || null;
      }
      if (!source) { raf = requestAnimationFrame(sync); return; }

      overlay = overlayRef.current;
      if (!overlay) { raf = requestAnimationFrame(sync); return; }

      const rect = source.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) { raf = requestAnimationFrame(sync); return; }

      overlay.width = source.width;
      overlay.height = source.height + 18;
      overlay.style.position = "fixed";
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height + 18}px`;
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "999";
      overlay.style.imageRendering = "pixelated";

      source.style.opacity = "0";
      source.style.position = "relative";
      source.style.zIndex = "1";

      const ctx = overlay.getContext("2d", { willReadFrequently: true });
      if (!ctx) { raf = requestAnimationFrame(sync); return; }
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.drawImage(source, 0, 0);

      const img = ctx.getImageData(0, 0, source.width, source.height);
      const data = img.data;
      const depth = Math.max(8, Math.round(source.height / 30));
      const left = Math.floor(source.width * 0.02);
      const right = Math.ceil(source.width * 0.98);

      for (let x = left; x < right; x++) {
        let y = -1;
        let baseR = 0, baseG = 0, baseB = 0;
        for (let py = source.height - 1; py >= Math.floor(source.height * 0.12); py--) {
          const i = (py * source.width + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (!closeToBackground(r, g, b, a)) { y = py; baseR = r; baseG = g; baseB = b; break; }
        }
        if (y < 0) continue;

        for (let d = 1; d <= depth; d++) {
          const ny = y + d;
          if (ny >= overlay.height) break;
          const [r, g, b] = edgeShade(baseR, baseG, baseB, d);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x, ny, 1, 1);
          if (((x + d) & 3) === 0 && d > 2) {
            ctx.fillStyle = `rgb(${Math.max(0, r - 10)},${Math.max(0, g - 10)},${Math.max(0, b - 10)})`;
            ctx.fillRect(x, ny, 1, 1);
          }
        }
      }

      raf = requestAnimationFrame(sync);
    };

    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <div style={{ position: "relative", minHeight: "100vh" }}><GameMaker /><canvas ref={overlayRef} /></div>;
}
