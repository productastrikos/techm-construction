// Procedural, offline textures (canvas). Everything is generated once and cached; nothing is downloaded.
import { CanvasTexture, ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, Texture } from 'three';

/** deterministic [0,1) rng (mulberry32) so textures look the same on every load */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}

function finish(c: HTMLCanvasElement, repeat: boolean, aniso = 8): Texture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping;
  t.anisotropy = aniso;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}

/** speckle `n` dots of grey level lo..hi onto a context (wraps at the edges so the tile is seamless) */
function speckle(g: CanvasRenderingContext2D, size: number, n: number, lo: number, hi: number, r: () => number, dot = 2, tint: [number, number, number] = [0, 0, 0]) {
  for (let i = 0; i < n; i++) {
    const v = lo + r() * (hi - lo);
    g.fillStyle = `rgb(${v + tint[0]},${v + tint[1]},${v + tint[2]})`;
    const x = r() * size;
    const y = r() * size;
    const d = 1 + r() * dot;
    for (const ox of [0, -size, size]) for (const oy of [0, -size, size]) g.fillRect(x + ox, y + oy, d, d);
  }
}

const cache = new Map<string, Texture>();
const memo = (k: string, f: () => Texture) => {
  let t = cache.get(k);
  if (!t) {
    t = f();
    cache.set(k, t);
  }
  return t;
};

/** near-white sand grain: multiplied over vertex colours on the terrain */
export const sandGrainTexture = () =>
  memo('sand', () => {
    const { c, g } = canvas(512, 512);
    g.fillStyle = '#e9e9e9';
    g.fillRect(0, 0, 512, 512);
    const r = rng(11);
    speckle(g, 512, 9000, 190, 255, r, 2);
    speckle(g, 512, 1400, 150, 190, r, 3);
    // soft ripple streaks
    g.globalAlpha = 0.07;
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = r() > 0.5 ? '#ffffff' : '#7a6a50';
      g.lineWidth = 1 + r() * 3;
      const y = r() * 512;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.04 + i) * 6);
      g.stroke();
    }
    g.globalAlpha = 1;
    return finish(c, true, 8);
  });

/** dark asphalt, one tile ~ 8 m */
export const asphaltTexture = () =>
  memo('asphalt', () => {
    const { c, g } = canvas(512, 512);
    g.fillStyle = '#5c6166';
    g.fillRect(0, 0, 512, 512);
    const r = rng(23);
    speckle(g, 512, 14000, 50, 110, r, 2);
    speckle(g, 512, 2200, 100, 150, r, 2);
    speckle(g, 512, 1200, 28, 48, r, 4);
    // hairline cracks + oil stains
    g.strokeStyle = 'rgba(15,17,19,0.5)';
    g.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      let x = r() * 512;
      let y = r() * 512;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        x += (r() - 0.5) * 70;
        y += (r() - 0.3) * 50;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      g.fillStyle = 'rgba(20,22,25,0.16)';
      g.beginPath();
      g.ellipse(r() * 512, r() * 512, 20 + r() * 40, 12 + r() * 22, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    return finish(c, true, 8);
  });

/** concrete pavement with expansion joints: one tile = 2x2 slabs, ~ 15 m */
export const slabTexture = () =>
  memo('slab', () => {
    const { c, g } = canvas(512, 512);
    g.fillStyle = '#a7aaa8';
    g.fillRect(0, 0, 512, 512);
    const r = rng(37);
    // each slab slightly different tone
    for (let sx = 0; sx < 2; sx++)
      for (let sy = 0; sy < 2; sy++) {
        const v = 162 + r() * 4;
        g.fillStyle = `rgb(${v},${v + 2},${v})`;
        g.fillRect(sx * 256, sy * 256, 256, 256);
      }
    speckle(g, 512, 9000, 120, 185, r, 2);
    g.strokeStyle = 'rgba(60,64,66,0.26)';
    g.lineWidth = 2;
    g.strokeRect(1.5, 1.5, 509, 509);
    g.beginPath();
    g.moveTo(256, 0);
    g.lineTo(256, 512);
    g.moveTo(0, 256);
    g.lineTo(512, 256);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.lineWidth = 1;
    g.strokeRect(5, 5, 502, 502);
    return finish(c, true, 8);
  });

/** reinforced concrete for caissons / buildings: board-marked + tie holes. One tile ~ 6 m */
export const caissonTexture = () =>
  memo('caisson', () => {
    const { c, g } = canvas(512, 512);
    g.fillStyle = '#9ca2a4';
    g.fillRect(0, 0, 512, 512);
    const r = rng(41);
    speckle(g, 512, 8000, 120, 175, r, 2);
    for (let y = 0; y < 512; y += 64) {
      const v = (r() - 0.5) * 16;
      g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 90})`;
      g.fillRect(0, y, 512, 64);
      g.fillStyle = 'rgba(30,34,36,0.28)';
      g.fillRect(0, y, 512, 2);
    }
    g.fillStyle = 'rgba(25,28,30,0.55)';
    for (let x = 64; x < 512; x += 128) for (let y = 32; y < 512; y += 128) g.fillRect(x - 3, y - 3, 6, 6);
    // water staining streaks
    g.fillStyle = 'rgba(30,40,40,0.1)';
    for (let i = 0; i < 24; i++) g.fillRect(r() * 512, 0, 2 + r() * 6, 120 + r() * 380);
    return finish(c, true, 8);
  });

/** facade: cladding panels + ribbon windows with a sky-reflection gradient. One tile ~ 9 m wide x 4.5 m high */
export const facadeTexture = () =>
  memo('facade', () => {
    const { c, g } = canvas(512, 256);
    g.fillStyle = '#d9dfe1';
    g.fillRect(0, 0, 512, 256);
    const r = rng(53);
    speckle(g, 256, 1500, 195, 235, r, 1);
    g.strokeStyle = 'rgba(70,80,86,0.35)';
    g.lineWidth = 1;
    for (let x = 0; x <= 512; x += 64) {
      g.beginPath();
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, 256);
      g.stroke();
    }
    for (let i = 0; i < 2; i++)
      for (let k = 0; k < 6; k++) {
        const x = 8 + k * 84;
        const y = 22 + i * 118;
        const grd = g.createLinearGradient(0, y, 0, y + 80);
        grd.addColorStop(0, '#6f97ad');
        grd.addColorStop(0.5, '#2f5367');
        grd.addColorStop(1, '#1d3442');
        g.fillStyle = grd;
        g.fillRect(x, y, 70, 80);
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.beginPath();
        g.moveTo(x, y + 80);
        g.lineTo(x + 34, y);
        g.lineTo(x + 52, y);
        g.lineTo(x + 18, y + 80);
        g.fill();
        g.strokeStyle = '#a9b2b6';
        g.lineWidth = 3;
        g.strokeRect(x, y, 70, 80);
      }
    // plinth
    g.fillStyle = 'rgba(40,46,50,0.25)';
    g.fillRect(0, 240, 512, 16);
    return finish(c, true, 8);
  });

/** corrugated metal sheet (workshop / sheds): vertical ribs */
export const corrugatedTexture = () =>
  memo('corr', () => {
    const { c, g } = canvas(256, 256);
    const r = rng(61);
    for (let x = 0; x < 256; x += 8) {
      const grd = g.createLinearGradient(x, 0, x + 8, 0);
      grd.addColorStop(0, '#9aa3a8');
      grd.addColorStop(0.5, '#e4e8ea');
      grd.addColorStop(1, '#8d979c');
      g.fillStyle = grd;
      g.fillRect(x, 0, 8, 256);
    }
    speckle(g, 256, 600, 120, 200, r, 1);
    g.fillStyle = 'rgba(70,40,20,0.08)';
    for (let i = 0; i < 10; i++) g.fillRect(r() * 256, 0, 3, 40 + r() * 200);
    return finish(c, true, 8);
  });

// ------------------------------------------------------------------------------------------------ road paint (alpha overlays)
/** painted markings for a pavement `w` x `d` metres (px = 4 per metre, capped). Canvas up = -z (sea side). */
export function markingsTexture(kind: 'yard' | 'apron' | 'road-x' | 'road-z' | 'gate', w: number, d: number): Texture {
  const key = `mk-${kind}-${w}-${d}`;
  return memo(key, () => {
    const ppm = Math.min(4, 2048 / Math.max(w, d));
    const W = Math.max(8, Math.round(w * ppm));
    const H = Math.max(8, Math.round(d * ppm));
    const { c, g } = canvas(W, H);
    g.clearRect(0, 0, W, H);
    const m = (v: number) => v * ppm;
    const line = (x0: number, y0: number, x1: number, y1: number, col: string, lw: number, dash?: [number, number]) => {
      g.strokeStyle = col;
      g.lineWidth = Math.max(1, m(lw));
      g.setLineDash(dash ? [m(dash[0]), m(dash[1])] : []);
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    };
    const white = 'rgba(240,242,240,0.9)';
    const yellow = 'rgba(244,196,48,0.95)';
    if (kind === 'yard') {
      // outer boundary + aisle lanes + stack-bay ticks
      g.strokeStyle = white;
      g.lineWidth = m(0.35);
      g.setLineDash([]);
      g.strokeRect(m(2.5), m(2.5), W - m(5), H - m(5));
      for (const f of [0.2, 0.4, 0.6, 0.8]) line(W * f, m(2.5), W * f, H - m(2.5), 'rgba(244,196,48,0.55)', 0.25, [3, 3]);
      for (let z = 8; z < d - 6; z += 3.4 * 3) line(m(3), m(z), W - m(3), m(z), 'rgba(240,242,240,0.18)', 0.12);
    } else if (kind === 'apron') {
      line(0, m(1.2), W, m(1.2), yellow, 0.5); // quay edge safety line
      line(0, m(3.2), W, m(3.2), white, 0.2, [2, 2]);
      line(0, H - m(1), W, H - m(1), white, 0.3);
      for (let x = 0; x < w; x += 23) line(m(x), m(8), m(x), H - m(8), 'rgba(240,242,240,0.28)', 0.15);
      // diagonal hatching on the crane-rail corridor
      g.save();
      g.beginPath();
      g.rect(0, m(4.5), W, m(7));
      g.clip();
      for (let x = -20; x < w + 20; x += 2) line(m(x), m(11.5), m(x + 7), m(4.5), 'rgba(244,196,48,0.5)', 0.35);
      g.restore();
    } else if (kind === 'road-x') {
      line(0, H / 2, W, H / 2, white, 0.25, [4, 8]);
      line(0, m(0.7), W, m(0.7), yellow, 0.2);
      line(0, H - m(0.7), W, H - m(0.7), yellow, 0.2);
    } else if (kind === 'road-z') {
      line(W / 2, 0, W / 2, H, white, 0.25, [4, 8]);
      line(m(0.7), 0, m(0.7), H, yellow, 0.2);
      line(W - m(0.7), 0, W - m(0.7), H, yellow, 0.2);
    } else {
      // gate plaza: stop bars + lane arrows
      line(0, m(22), W, m(22), white, 0.5);
      line(W / 2, 0, W / 2, H, white, 0.25, [4, 8]);
      line(m(0.7), 0, m(0.7), H, yellow, 0.2);
      line(W - m(0.7), 0, W - m(0.7), H, yellow, 0.2);
    }
    const t = finish(c, false, 8);
    return t;
  });
}

// ------------------------------------------------------------------------------------------------ small sprites
/** soft white wake (V-shaped streak) for moving vessels, one unit = 1 x 1 */
export const wakeTexture = () =>
  memo('wake', () => {
    const { c, g } = canvas(256, 256);
    const grd = g.createLinearGradient(0, 0, 256, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, 118);
    g.lineTo(256, 20);
    g.lineTo(256, 236);
    g.lineTo(0, 138);
    g.closePath();
    g.fill();
    const r = rng(7);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 220; i++) {
      g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.5})`;
      g.beginPath();
      g.arc(r() * 256, r() * 256, 2 + r() * 7, 0, 6.3);
      g.fill();
    }
    return finish(c, false, 4);
  });

/** round soft blob used for dust / stockpile shadows / light glows */
export const glowTexture = () =>
  memo('glow', () => {
    const { c, g } = canvas(128, 128);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return finish(c, false, 1);
  });

/** a tiling chain-link / mesh fence with transparent holes */
export const fenceTexture = () =>
  memo('fence', () => {
    const { c, g } = canvas(64, 64);
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(150,158,162,0.9)';
    g.lineWidth = 1.5;
    for (let i = -64; i < 128; i += 8) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 64, 64);
      g.moveTo(i + 64, 0);
      g.lineTo(i, 64);
      g.stroke();
    }
    return finish(c, true, 4);
  });

/** site cabin: white cladding, a green band, door + windows. One tile = one cabin face (~7 x 2.8 m) */
export const cabinTexture = () =>
  memo('cabin', () => {
    const { c, g } = canvas(256, 128);
    g.fillStyle = '#e8ebea';
    g.fillRect(0, 0, 256, 128);
    const r = rng(71);
    speckle(g, 128, 400, 205, 240, r, 1);
    g.fillStyle = '#2f7d5b';
    g.fillRect(0, 100, 256, 12);
    g.fillStyle = '#5b6770';
    g.fillRect(0, 118, 256, 10);
    // door + two windows
    g.fillStyle = '#8a9298';
    g.fillRect(18, 22, 34, 78);
    for (const x of [86, 160, 214]) {
      const grd = g.createLinearGradient(0, 30, 0, 70);
      grd.addColorStop(0, '#7ba3b8');
      grd.addColorStop(1, '#2b4858');
      g.fillStyle = grd;
      g.fillRect(x, 30, 36, 40);
      g.strokeStyle = '#d4d9db';
      g.lineWidth = 2;
      g.strokeRect(x, 30, 36, 40);
    }
    return finish(c, false, 8);
  });

/** soft cumulus billboard */
export const cloudTexture = () =>
  memo('cloud', () => {
    const { c, g } = canvas(512, 256);
    const r = rng(99);
    g.clearRect(0, 0, 512, 256);
    for (let i = 0; i < 46; i++) {
      const cx = 90 + r() * 330;
      const cy = 150 - Math.pow(r(), 1.6) * 70 + (r() - 0.5) * 20;
      const rad = 28 + r() * 54;
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const shade = 232 + Math.floor(r() * 23) - (cy > 150 ? 22 : 0);
      grd.addColorStop(0, `rgba(${shade},${shade},${shade + 3},0.5)`);
      grd.addColorStop(1, `rgba(${shade},${shade},${shade + 3},0)`);
      g.fillStyle = grd;
      g.beginPath();
      g.arc(cx, cy, rad, 0, 6.3);
      g.fill();
    }
    return finish(c, false, 1);
  });

/** tileable asphalt road strip for the access road: vertical tile ~ 24 m, centre dashes + edge lines */
export const roadStripTexture = () =>
  memo('roadstrip', () => {
    const { c, g } = canvas(128, 256);
    g.drawImage(asphaltTexture().image as HTMLCanvasElement, 0, 0, 128, 256);
    g.fillStyle = 'rgba(240,242,240,0.92)';
    g.fillRect(62, 20, 4, 90); // dashed centre
    g.fillRect(62, 150, 4, 90);
    g.fillStyle = 'rgba(244,244,240,0.85)';
    g.fillRect(6, 0, 3, 256);
    g.fillRect(119, 0, 3, 256);
    const t = finish(c, true, 8);
    t.wrapS = ClampToEdgeWrapping;
    return t;
  });
