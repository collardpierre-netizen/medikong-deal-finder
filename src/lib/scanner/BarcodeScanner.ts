/**
 * Interface scanner indépendante du moteur. Implémentation par défaut : zxing-wasm.
 * EAN-13, DataMatrix (GS1) et Code 128 ; lecture continue, caméra arrière,
 * anti-doublon 2 s, bip + vibration 40 ms.
 */
import { readBarcodes, type ReadResult } from "zxing-wasm/reader";

export type ScanSymbology = "ean13" | "datamatrix" | "other";

export interface Detection {
  text: string;
  symbology: ScanSymbology;
  decodeMs: number;
}

export interface BarcodeScanner {
  start(video: HTMLVideoElement): Promise<void>;
  stop(): void;
  onDetect(cb: (d: Detection) => void): void;
  setTorch(on: boolean): Promise<boolean>;
  hasTorch(): boolean;
}

function mapFormat(f: string): ScanSymbology {
  if (/ean-?13/i.test(f)) return "ean13";
  if (/datamatrix/i.test(f)) return "datamatrix";
  return "other";
}

function beep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 1760;
    g.gain.value = 0.08;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.08);
    o.onended = () => ctx.close();
  } catch { /* silencieux */ }
}

export function createZxingScanner(): BarcodeScanner {
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;
  let running = false;
  let cb: ((d: Detection) => void) | null = null;
  let last = { text: "", at: 0 };
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const loop = async () => {
    if (!running || !video) return;
    if (video.readyState >= 2 && video.videoWidth) {
      // Zone centrale, réduite pour accélérer le décodage
      const w = video.videoWidth, h = video.videoHeight;
      const cw = Math.min(w, 960), ch = Math.round((cw * h) / w);
      canvas.width = cw; canvas.height = ch;
      ctx.drawImage(video, 0, 0, cw, ch);
      const t0 = performance.now();
      let results: ReadResult[] = [];
      try {
        results = await readBarcodes(ctx.getImageData(0, 0, cw, ch), {
          formats: ["EAN-13", "DataMatrix", "Code128"],
          tryHarder: true,
          maxNumberOfSymbols: 1,
        });
      } catch { /* frame ignorée */ }
      const decodeMs = Math.round(performance.now() - t0);
      const r = results.find((x) => x.isValid && x.text);
      if (r) {
        const now = Date.now();
        if (r.text !== last.text || now - last.at > 2000) {
          last = { text: r.text, at: now };
          beep();
          try { navigator.vibrate?.(40); } catch { /* noop */ }
          cb?.({ text: r.text, symbology: mapFormat(r.format), decodeMs });
        }
      }
    }
    if (running) requestAnimationFrame(() => void loop());
  };

  return {
    async start(v) {
      video = v;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      v.srcObject = stream;
      v.setAttribute("playsinline", "true");
      v.muted = true;
      await v.play();
      running = true;
      void loop();
    },
    stop() {
      running = false;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      if (video) video.srcObject = null;
    },
    onDetect(fn) { cb = fn; },
    hasTorch() {
      const track = stream?.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as any;
      return !!caps.torch;
    },
    async setTorch(on) {
      const track = stream?.getVideoTracks()[0];
      if (!track) return false;
      try {
        await track.applyConstraints({ advanced: [{ torch: on } as any] });
        return true;
      } catch { return false; }
    },
  };
}
