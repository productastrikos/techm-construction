import { BoxGeometry, BufferGeometry, CanvasTexture, EdgesGeometry, Float32BufferAttribute, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Texture } from 'three';
import { hash32, noise1 } from '../engine/dates';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** rubble-mound cross section: a trapezoid with jittered vertices (flat shaded) */
export function rubbleGeometry(w: number, h: number, d: number, seed: string): BufferGeometry {
  const g = new BoxGeometry(w, h, d, Math.max(6, Math.round(w / 3)), 5, Math.max(8, Math.round(d / 4)));
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const key = hash32(seed);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (y + h / 2) / h; // 0 bottom .. 1 top
    const nx = x * (1 - 0.5 * t);
    const j = 1.5 + 0.03 * w;
    pos.setXYZ(i, nx + noise1(key, i * 3) * j, y + noise1(key, i * 3 + 1) * h * 0.06, z + noise1(key, i * 3 + 2) * j);
    // armour rock: light/dark mottling, darker low down (wet)
    const v = 0.72 + 0.28 * ((noise1(key, i * 7 + 5) + 1) / 2) - 0.18 * (1 - t);
    col[i * 3] = v;
    col[i * 3 + 1] = v * 0.98;
    col[i * 3 + 2] = v * 0.95;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // origin at the bottom so scaleY grows the mound from the seabed
  g.translate(0, h / 2, 0);
  return g;
}

export function bottomBox(w: number, h: number, d: number): BoxGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}
/** pivot at the -x edge so scale.x wipes the box from left to right */
export function leftEdgeBox(w: number, h: number, d: number): BoxGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(w / 2, 0, 0);
  return g;
}
/** pivot at the -z edge (sea side) so scale.z wipes front to back */
export function frontEdgeBox(w: number, h: number, d: number): BoxGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(0, 0, d / 2);
  return g;
}

export function edgesOf(g: BufferGeometry): EdgesGeometry {
  return new EdgesGeometry(g, 30);
}

/** seabed height field: natural slope + dredged basin / channel blended in by dredging progress */
export function seabedDepth(x: number, z: number, dp: number): number {
  const natural = -6 - 6 * smooth(0, 640, -z) + 0.6 * Math.sin(x * 0.011) * Math.cos(z * 0.017);
  const basin = smooth(-520, -400, x) * (1 - smooth(400, 520, x)) * smooth(-380, -270, z) * (1 - smooth(-40, -5, z));
  const chan = smooth(-220, -110, x) * (1 - smooth(110, 220, x)) * (1 - smooth(-380, -270, z)) * smooth(-700, -600, z);
  const m = Math.max(basin, chan);
  const target = Math.min(natural, -15.5);
  return natural + (target - natural) * m * dp;
}

export function makeSeabed(): { geo: PlaneGeometry; update: (dp: number) => void } {
  const geo = new PlaneGeometry(1500, 700, 150, 70);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -330);
  const pos = geo.attributes.position;
  geo.setAttribute('color', new Float32BufferAttribute(new Float32Array(pos.count * 3), 3));
  const col = geo.attributes.color;
  const update = (dp: number) => {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = seabedDepth(x, z, dp);
      pos.setY(i, y);
      // shallow = sand, deep dredged = dark teal
      const t = Math.min(1, Math.max(0, (-y - 6) / 10));
      col.setXYZ(i, 0.74 - 0.38 * t, 0.66 - 0.26 * t, 0.46 - 0.08 * t);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
  };
  update(0);
  return { geo, update };
}

// ------------------------------------------------------------------ textures (generated, offline)
let winTex: Texture | null = null;
export function windowTexture(): Texture {
  if (winTex) return winTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d6dcdf';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#2b4a5c';
  for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) g.fillRect(8 + x * 40, 16 + y * 56, 30, 34);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) g.fillRect(8 + x * 40, 16 + y * 56, 30, 8);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  winTex = t;
  return t;
}

let hatchTex: Texture | null = null;
/** "under construction" stripes for scaffold/ghost faces */
export function concreteTexture(): Texture {
  if (hatchTex) return hatchTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#9aa3a8';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 420; i++) {
    const v = 140 + Math.floor(noise1(777, i) * 26);
    g.fillStyle = `rgb(${v},${v + 4},${v + 8})`;
    g.fillRect(Math.abs(noise1(31, i)) * 128, Math.abs(noise1(57, i)) * 128, 3, 3);
  }
  g.strokeStyle = 'rgba(30,40,45,0.35)';
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, 127, 127);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  hatchTex = t;
  return t;
}

/** distant arid mountain range (Hajar-style): displaced grid with sum-of-sines ridges, vertex-coloured by height */
export function makeMountains(): PlaneGeometry {
  const g = new PlaneGeometry(5200, 900, 160, 40);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, 1750);
  const pos = g.attributes.position;
  const col = new Float32BufferAttribute(new Float32Array(pos.count * 3), 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const u = (z - 1300) / 900; // 0 front .. 1 back
    const ridge =
      Math.abs(Math.sin(x * 0.0021 + 1.3)) * 0.9 + Math.abs(Math.sin(x * 0.0049 + u * 3.1)) * 0.55 + Math.abs(Math.sin(x * 0.0113 - u * 5.7)) * 0.28 + Math.sin(u * 4 + x * 0.003) * 0.18;
    const h = Math.max(0, ridge * (40 + 230 * Math.pow(u, 1.2)) - 20 * (1 - u));
    pos.setY(i, 2.6 + h);
    const t = Math.min(1, h / 420);
    col.setXYZ(i, 0.5 - 0.12 * t + 0.08 * (1 - t), 0.4 - 0.1 * t + 0.05 * (1 - t), 0.3 - 0.06 * t);
  }
  g.setAttribute('color', col);
  g.computeVertexNormals();
  return g;
}
