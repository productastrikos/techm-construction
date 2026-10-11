// Heightfield terrain for the port scene: natural coast, beach, dunes, foothills and a Hajar-style mountain backdrop.
// One analytic function (terrainHeight) drives the mesh, the water depth mask and prop placement, so everything agrees.
// Coordinates: metres; x east, z south (landward), y up, water level y = 0, the sea is -z.
import { BufferGeometry, CanvasTexture, ClampToEdgeWrapping, Float32BufferAttribute, LinearFilter, PlaneGeometry, Texture } from 'three';

export const LAND_Y = 2.8;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function h2(ix: number, iz: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = h2(ix, iz);
  const b = h2(ix + 1, iz);
  const c = h2(ix, iz + 1);
  const d = h2(ix + 1, iz + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x: number, z: number, oct = 4): number {
  let a = 0.5;
  let f = 1;
  let s = 0;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f + i * 17.3, z * f - i * 9.1);
    n += a;
    f *= 2.03;
    a *= 0.5;
  }
  return s / n;
}
function ridged(x: number, z: number, oct = 4): number {
  let a = 0.5;
  let f = 1;
  let s = 0;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    const r = 1 - Math.abs(2 * vnoise(x * f + i * 5.7, z * f + i * 3.3) - 1);
    s += a * r * r;
    n += a;
    f *= 2.07;
    a *= 0.5;
  }
  return s / n;
}

function sdBox(x: number, z: number, x0: number, x1: number, z0: number, z1: number) {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const dx = Math.abs(x - cx) - (x1 - x0) / 2;
  const dz = Math.abs(z - cz) - (z1 - z0) / 2;
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
}

/** signed distance to the coast: negative = land. West + east headlands flank the port notch; everything south of z=500 is land. */
export function landSdf(x: number, z: number): number {
  return Math.min(sdBox(x, z, -6000, -420, -60, 6000), sdBox(x, z, 420, 6000, -60, 6000), sdBox(x, z, -6000, 6000, 500, 6000));
}

const seaFloor = (z: number) => -6.3 - 8 * smooth(-100, -700, z);

export function terrainHeight(x: number, z: number): number {
  const wob = (fbm(x * 0.005 + 11, z * 0.005 - 7, 3) - 0.5) * 34;
  const s = landSdf(x, z) + wob * 0.55;
  const f = smooth(-22, 34, s);
  const shore = LAND_Y + (seaFloor(z) - LAND_Y) * f;
  const inland = 1 - smooth(-70, -20, s);
  if (inland <= 0) return shore;
  // keep the working platform flat; relief only grows inland / far east-west
  const flatOff = Math.max(smooth(560, 940, z), smooth(950, 1500, Math.abs(x)));
  const dunes = (fbm(x * 0.011, z * 0.018, 4) - 0.38) * 15 + Math.sin(x * 0.03 + fbm(x * 0.01, z * 0.01, 2) * 9) * 1.1;
  const hills = fbm(x * 0.0028 + 3, z * 0.0034 - 2, 4) * 90 * smooth(780, 1500, z);
  const mtn = Math.pow(smooth(1050, 2300, z), 1.25) * (0.25 + 0.75 * ridged(x * 0.0014 + 2, z * 0.0019 - 5, 5)) * 640;
  const side = smooth(2000, 3400, Math.abs(x)) * smooth(0, 700, z) * ridged(x * 0.0017, z * 0.0021 + 9, 4) * 340;
  const rel = (dunes * smooth(560, 760, z) + hills + mtn + side) * flatOff;
  return shore + rel * inland;
}

// ------------------------------------------------------------------------------------------------ mesh
export const TERRAIN_X = 3800;
export const TERRAIN_Z0 = -140;
export const TERRAIN_Z1 = 2600;

const SAND_BEACH: [number, number, number] = [0.88, 0.78, 0.6];
const SAND: [number, number, number] = [0.8, 0.66, 0.45];
const SAND_WET: [number, number, number] = [0.55, 0.47, 0.35];
const SEA_SAND: [number, number, number] = [0.62, 0.56, 0.42];
const ROCKS: Array<[number, number, number]> = [
  [0.7, 0.55, 0.38],
  [0.6, 0.44, 0.33],
  [0.53, 0.46, 0.42],
  [0.74, 0.64, 0.5],
  [0.5, 0.38, 0.3],
];
const SCRUB: [number, number, number] = [0.5, 0.5, 0.34];

export function makeTerrain(): BufferGeometry {
  const nx = 400;
  const nz = 210;
  const g = new PlaneGeometry(TERRAIN_X * 2, TERRAIN_Z1 - TERRAIN_Z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, (TERRAIN_Z0 + TERRAIN_Z1) / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const ny = nrm.getY(i);
    const nA = fbm(x * 0.02, z * 0.02, 3);
    const nB = fbm(x * 0.0035 + 40, z * 0.0035, 3);
    const rel = Math.max(0, y - LAND_Y);
    let c: [number, number, number];
    if (y < 0.15) c = y < -1.2 ? SEA_SAND : (lerp3(SEA_SAND, SAND_WET, smooth(-1.2, 0.15, y)) as [number, number, number]);
    else if (y < 1.6) c = lerp3(SAND_WET, SAND_BEACH, smooth(0.15, 1.6, y));
    else c = lerp3(SAND_BEACH, SAND, smooth(LAND_Y - 0.5, LAND_Y + 6, y) * 0.8 + nA * 0.35);
    // inland: scrub patches + rock strata with height
    if (rel > 4) {
      const band = Math.sin(y * 0.085 + nB * 7) * 0.5 + 0.5;
      const idx = Math.floor(nB * 4.99);
      const rock = lerp3(ROCKS[idx], ROCKS[(idx + 1) % ROCKS.length], band);
      c = lerp3(c, rock, smooth(4, 70, rel));
      const lowScrub = (1 - smooth(10, 160, rel)) * smooth(0.52, 0.7, fbm(x * 0.006 - 9, z * 0.006 + 4, 3));
      c = lerp3(c, SCRUB, lowScrub * 0.55);
    }
    // steep faces are darker rock
    const steep = smooth(0.92, 0.62, ny);
    c = lerp3(c, [0.4, 0.33, 0.29], steep * smooth(2, 25, rel) * 0.8);
    const v = 0.9 + (nA - 0.5) * 0.28;
    col[i * 3] = c[0] * v;
    col[i * 3 + 1] = c[1] * v;
    col[i * 3 + 2] = c[2] * v;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}

function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const k = Math.min(1, Math.max(0, t));
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}

// ------------------------------------------------------------------------------------------------ water depth mask
export const MASK = { x0: -1800, z0: -1100, sx: 3600, sz: 1600 };

/** R = water depth / 12 m (0 on land), sampled from the same height field; used by the water shader for shallows + foam */
export function makeWaterMask(): Texture {
  const W = 768;
  const H = 384;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = MASK.x0 + ((i + 0.5) / W) * MASK.sx;
      const z = MASK.z0 + ((j + 0.5) / H) * MASK.sz;
      const depth = Math.max(0, -terrainHeight(x, z));
      const o = (j * W + i) * 4;
      img.data[o] = Math.min(255, (depth / 12) * 255);
      img.data[o + 1] = 0;
      img.data[o + 2] = 0;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  t.minFilter = t.magFilter = LinearFilter;
  t.generateMipmaps = false;
  t.flipY = false; // row 0 = z0
  return t;
}

/** distant ridge line for scenes without the coastal terrain (highway pack): z0 = near edge, `dir` = +1 / -1 away from the site */
export function makeRidge(z0: number, dir: 1 | -1, seed = 0): BufferGeometry {
  const g = new PlaneGeometry(7600, 900, 220, 40);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, z0 + (dir * 900) / 2);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const u = Math.min(1, Math.abs(z - z0) / 900);
    const h = (0.2 + 0.8 * ridged(x * 0.0016 + seed, u * 1.7 + seed * 3, 5)) * (30 + 520 * Math.pow(u, 1.15)) * smooth(0, 0.12, u + 0.02);
    pos.setY(i, 2.6 + h - 6 * (1 - u));
    const band = Math.sin(h * 0.09 + fbm(x * 0.004, z * 0.004, 2) * 6) * 0.5 + 0.5;
    const c = lerp3(lerp3(SAND, ROCKS[1], 0.5), lerp3(ROCKS[0], ROCKS[3], band), smooth(0, 0.35, u));
    const v = 0.9 + (fbm(x * 0.02, z * 0.02, 3) - 0.5) * 0.3;
    col[i * 3] = c[0] * v;
    col[i * 3 + 1] = c[1] * v;
    col[i * 3 + 2] = c[2] * v;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
