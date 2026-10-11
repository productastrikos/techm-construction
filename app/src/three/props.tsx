// Scenery + site dressing for the port twin: terrain, palms, rocks, scrub, fence, contractor camp, stockpiles, access road + traffic,
// bollards, pavement markings, buoys, clouds, vessel wakes. All procedural (offline); GLB palms/rocks are used when present.
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  Sprite,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash32 } from '../engine/dates';
import type { ElementState } from '../engine/twin';
import { InstancedGLB, ModelInstance, type GlbInst } from './common';
import { hasModel } from './assetManifest';
import { poseAt } from './motion';
import { prog, type SceneModel } from './sceneModel';
import type { ModelId } from './assetManifest';
import type { MotionSpec } from '../engine/types';
import { LAND_Y, fbm, landSdf, makeRidge, makeTerrain, terrainHeight } from './terrain';
import { asphaltTexture, cabinTexture, cloudTexture, fenceTexture, markingsTexture, rng, roadStripTexture, sandGrainTexture, wakeTexture } from './textures';

// ------------------------------------------------------------------------------------------------ generic instancing
export interface Inst {
  p: [number, number, number];
  ry?: number;
  s?: number | [number, number, number];
  c?: string;
}

export function Instanced({ geometry, material, items, cast = true, receive = false }: { geometry: BufferGeometry; material: Material; items: Inst[]; cast?: boolean; receive?: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    const col = new Color();
    items.forEach((it, i) => {
      o.position.set(it.p[0], it.p[1], it.p[2]);
      o.rotation.set(0, it.ry ?? 0, 0);
      const s = it.s ?? 1;
      if (typeof s === 'number') o.scale.setScalar(s);
      else o.scale.set(s[0], s[1], s[2]);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (it.c) {
        col.set(it.c);
        m.setColorAt(i, col);
      }
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={cast} receiveShadow={receive} frustumCulled={false} />;
}

/** deterministic scatter inside a rect, accepted by `ok(x,z)` */
function scatter(n: number, seed: number, x0: number, x1: number, z0: number, z1: number, ok: (x: number, z: number) => boolean, tries = 40): Array<[number, number]> {
  const r = rng(seed);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n * tries && out.length < n; i++) {
    const x = x0 + r() * (x1 - x0);
    const z = z0 + r() * (z1 - z0);
    if (ok(x, z)) out.push([x, z]);
  }
  return out;
}

/** the working platform + site infrastructure footprint: nothing natural grows here */
const inPlatform = (x: number, z: number) => x > -490 && x < 490 && z > -90 && z < 560;
const inCamp = (x: number, z: number) => x > -740 && x < -530 && z > 30 && z < 330;
const inStock = (x: number, z: number) => x > 600 && x < 860 && z > 30 && z < 330;
const inCastPad = (x: number, z: number) => x > 410 && x < 635 && z > 5 && z < 400;
const inRoad = (x: number, z: number) => Math.abs(x - roadX(z)) < 16 && z > 480;
const free = (x: number, z: number) => !inPlatform(x, z) && !inCamp(x, z) && !inStock(x, z) && !inCastPad(x, z) && !inRoad(x, z);
const onLand = (x: number, z: number, margin = 30) => landSdf(x, z) < -margin;

// ------------------------------------------------------------------------------------------------ terrain
export function Terrain() {
  const geo = useMemo(() => makeTerrain(), []);
  const map = useMemo(() => {
    const t = sandGrainTexture().clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(7600 / 26, 2740 / 26);
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(
    () => () => {
      geo.dispose();
      map.dispose();
    },
    [geo, map],
  );
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors map={map} roughness={1} metalness={0} />
    </mesh>
  );
}

// ------------------------------------------------------------------------------------------------ vegetation
function makePalmGeometry(): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const push = (x: number, y: number, z: number, c: [number, number, number]) => {
    pos.push(x, y, z);
    col.push(c[0], c[1], c[2]);
    return pos.length / 3 - 1;
  };
  const H = 9;
  const rings = 8;
  const sides = 6;
  const bend = 1.3;
  const ringIdx: number[][] = [];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const cx = bend * t * t;
    const rad = 0.4 - 0.17 * t;
    const ring: number[] = [];
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const shade = 0.34 + 0.1 * Math.sin(r * 2.1 + s);
      ring.push(push(cx + Math.cos(a) * rad, H * t, Math.sin(a) * rad, [shade + 0.1, shade * 0.78, shade * 0.52]));
    }
    ringIdx.push(ring);
  }
  for (let r = 0; r < rings; r++)
    for (let s = 0; s < sides; s++) {
      const a = ringIdx[r][s];
      const b = ringIdx[r][(s + 1) % sides];
      const c = ringIdx[r + 1][s];
      const d = ringIdx[r + 1][(s + 1) % sides];
      idx.push(a, c, b, b, c, d);
    }
  const fronds = 12;
  const segs = 5;
  const L = 4.8;
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + (f % 2) * 0.2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const lift = 0.8 + (f % 3) * 0.35;
    let prev: [number, number] | null = null;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const rr = L * t;
      const y = H + lift * t * 2.2 - 3.4 * t * t;
      const w = 0.95 * (Math.sin(Math.PI * Math.min(1, t * 1.05)) * 0.85 + 0.15);
      const px = bend + dx * rr;
      const pz = dz * rr;
      const g = 0.55 - 0.18 * t;
      const c: [number, number, number] = [0.2 + 0.08 * t, g, 0.14];
      const l = push(px - dz * w, y, pz + dx * w, c);
      const r2 = push(px + dz * w, y, pz - dx * w, c);
      const mid = push(px, y + 0.18, pz, [c[0] * 0.8, c[1] * 0.85, c[2]]);
      if (prev) {
        idx.push(prev[0], prev[1], l, prev[1], r2, l);
      }
      prev = [l, r2];
      void mid;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function rockGeometry(seed: number): BufferGeometry {
  const g = new IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = 0.72 + 0.5 * fbm(x * 1.7 + seed, z * 1.7 + y * 1.2 - seed, 3);
    p.setXYZ(i, x * n, y * n * 0.7, z * n);
  }
  g.computeVertexNormals();
  return g;
}

export function Vegetation() {
  const palmGeo = useMemo(makePalmGeometry, []);
  const palmMat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.85 }), []);
  const rockGeo = useMemo(() => rockGeometry(3), []);
  const rockMat = useMemo(() => new MeshStandardMaterial({ roughness: 1, flatShading: true }), []);
  const scrubGeo = useMemo(() => new IcosahedronGeometry(1, 0), []);
  const scrubMat = useMemo(() => new MeshStandardMaterial({ roughness: 1, flatShading: true }), []);

  const [palms, heroPalms] = useMemo<[Inst[], GlbInst[]]>(() => {
    const out: Inst[] = [];
    const hero: GlbInst[] = [];
    const useGlb = hasModel('palm-tree');
    const add = (x: number, z: number, i: number, glb = false) => {
      const ry = (hash32(`p${i}`) % 628) / 100;
      const sc = 0.8 + (hash32(`s${i}`) % 60) / 100;
      if (glb && useGlb) hero.push({ p: [x, terrainHeight(x, z) - 0.1, z], ry, s: sc * 1.5 });
      else out.push({ p: [x, terrainHeight(x, z) - 0.1, z], ry, s: sc });
    };
    let i = 0;
    // avenue along the gate road (detailed GLB palms when available)
    for (let z = 560; z < 900; z += 22) {
      const hero = Math.round((z - 560) / 22) % 2 === 0;
      add(roadX(z) - 15, z, i++, hero);
      add(roadX(z) + 15, z + 8, i++, hero);
    }
    // groves on the headlands, behind the platform and around the camp
    scatter(40, 5, -1150, -540, 20, 560, (x, z) => free(x, z) && onLand(x, z, 40), 30).forEach(([x, z]) => add(x, z, i++));
    scatter(40, 6, 640, 1250, 20, 560, (x, z) => free(x, z) && onLand(x, z, 40), 30).forEach(([x, z]) => add(x, z, i++));
    scatter(46, 7, -520, 520, 580, 980, (x, z) => free(x, z), 30).forEach(([x, z]) => add(x, z, i++));
    scatter(16, 8, -760, -520, 20, 340, (x, z) => !inCamp(x, z) && onLand(x, z, 20), 30).forEach(([x, z]) => add(x, z, i++));
    return [out, hero];
  }, []);

  const rocks = useMemo<Inst[]>(() => {
    const cols = ['#8a7a66', '#7b6d5c', '#938574', '#6f655a', '#a1917b'];
    const out: Inst[] = [];
    const add = (x: number, z: number, i: number, big: number) => {
      const s = (0.7 + (hash32(`r${i}`) % 300) / 100) * big;
      out.push({ p: [x, terrainHeight(x, z) + s * 0.05, z], ry: (hash32(`q${i}`) % 628) / 100, s: [s * 1.3, s * (0.7 + (hash32(`t${i}`) % 50) / 100), s], c: cols[hash32(`c${i}`) % cols.length] });
    };
    let i = 0;
    scatter(130, 21, -1500, 1500, -40, 1200, (x, z) => free(x, z) && landSdf(x, z) < -6, 30).forEach(([x, z]) => add(x, z, i++, 1));
    scatter(90, 22, -1500, 1500, 700, 2200, (x, z) => free(x, z), 30).forEach(([x, z]) => add(x, z, i++, 2.6));
    return out;
  }, []);

  const shoreRocks = useMemo<GlbInst[]>(() => {
    if (!hasModel('rock-boulder-1')) return [];
    return scatter(8, 77, -1100, 1100, -50, 60, (x, z) => landSdf(x, z) < -4 && landSdf(x, z) > -40 && !inPlatform(x, z), 60).map(([x, z], i) => ({
      p: [x, terrainHeight(x, z) - 0.15, z],
      ry: i * 1.7,
      s: 0.8 + (hash32(`sr${i}`) % 120) / 100,
    }));
  }, []);

  const scrub = useMemo<Inst[]>(() => {
    const cols = ['#6f7447', '#7d7a4c', '#5f6a42', '#857c52'];
    const out: Inst[] = [];
    let i = 0;
    scatter(260, 31, -1400, 1400, 20, 1100, (x, z) => free(x, z) && landSdf(x, z) < -30 && fbm(x * 0.006 - 9, z * 0.006 + 4, 3) > 0.5, 20).forEach(([x, z]) => {
      const s = 0.9 + (hash32(`b${i}`) % 130) / 100;
      out.push({ p: [x, terrainHeight(x, z) + s * 0.25, z], ry: i, s: [s * 1.4, s * 0.7, s * 1.2], c: cols[hash32(`bc${i}`) % cols.length] });
      i++;
    });
    return out;
  }, []);

  useEffect(
    () => () => {
      [palmGeo, rockGeo, scrubGeo].forEach((g) => g.dispose());
      [palmMat, rockMat, scrubMat].forEach((m) => m.dispose());
    },
    [palmGeo, rockGeo, scrubGeo, palmMat, rockMat, scrubMat],
  );
  return (
    <>
      <Instanced geometry={palmGeo} material={palmMat} items={palms} cast={false} />
      <InstancedGLB id="palm-tree" items={heroPalms} cast={false} />
      <InstancedGLB id="rock-boulder-1" items={shoreRocks} receive />
      <Instanced geometry={rockGeo} material={rockMat} items={rocks} receive />
      <Instanced geometry={scrubGeo} material={scrubMat} items={scrub} cast={false} />
    </>
  );
}

// ------------------------------------------------------------------------------------------------ access road + traffic
export function roadX(z: number): number {
  return 26 * Math.sin((z - 500) * 0.0045) + 60 * Math.sin((z - 500) * 0.0012);
}
const ROAD_Z0 = 470;
const ROAD_Z1 = 2150;

export function AccessRoad() {
  const geo = useMemo(() => {
    const w = 9;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let len = 0;
    let prev: [number, number] | null = null;
    const step = 8;
    let n = 0;
    for (let z = ROAD_Z0; z <= ROAD_Z1; z += step) {
      const x = roadX(z) * smoothStart(z);
      if (prev) len += Math.hypot(x - prev[0], step);
      prev = [x, z];
      const dx = (roadX(z + 1) - roadX(z - 1)) * smoothStart(z) * 0.5;
      const nx = 1 / Math.hypot(1, dx);
      const px = nx; // perpendicular x
      const pz = -dx * nx;
      const yL = terrainHeight(x - px * w * 0.5, z - pz * w * 0.5);
      const yR = terrainHeight(x + px * w * 0.5, z + pz * w * 0.5);
      const y = Math.max(LAND_Y + 0.5, Math.max(yL, yR) + 0.12);
      pos.push(x - px * w * 0.5, y, z - pz * w * 0.5, x + px * w * 0.5, y, z + pz * w * 0.5);
      uv.push(0, len / 24, 1, len / 24);
      if (n > 0) {
        const a = (n - 1) * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      n++;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  const tex = useMemo(() => {
    const t = roadStripTexture().clone();
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(
    () => () => {
      geo.dispose();
      tex.dispose();
    },
    [geo, tex],
  );
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial map={tex} roughness={0.95} side={DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}
function smoothStart(z: number) {
  // road is straight into the gate plaza, then meanders: blend the lateral offset in over 150 m
  const t = Math.min(1, Math.max(0, (z - 500) / 150));
  return t * t * (3 - 2 * t);
}

/** trucks that crawl along the access road in both directions */
export function Traffic({ model }: { model: SceneModel }) {
  const refs = useRef<Array<Group | null>>([]);
  const lanes = useMemo(
    () => [
      { s: 0.1, v: 9, dir: 1, id: 'dump-truck' as const },
      { s: 0.45, v: 11, dir: -1, id: 'concrete-mixer' as const },
      { s: 0.72, v: 8, dir: 1, id: 'dump-truck' as const },
      { s: 0.3, v: 12, dir: -1, id: 'dump-truck' as const },
    ],
    [],
  );
  const busy = prog(model, 'COM-06') >= 0 || true;
  useFrame((st) => {
    const span = ROAD_Z1 - ROAD_Z0 - 120;
    lanes.forEach((ln, i) => {
      const g = refs.current[i];
      if (!g) return;
      const d = (((ln.s * span + st.clock.elapsedTime * ln.v) % span) + span) % span;
      const z = ln.dir > 0 ? ROAD_Z0 + 60 + d : ROAD_Z1 - 60 - d;
      const x = roadX(z) * smoothStart(z) + (ln.dir > 0 ? 2.2 : -2.2);
      const dx = (roadX(z + 1) - roadX(z - 1)) * smoothStart(z) * 0.5;
      g.position.set(x, terrainHeight(x, z) + 0.15, z);
      g.rotation.y = Math.atan2(-ln.dir, ln.dir * dx);
    });
  });
  if (!busy) return null;
  return (
    <>
      {lanes.map((ln, i) => (
        <group
          key={i}
          ref={(g) => {
            refs.current[i] = g;
          }}
        >
          <ModelInstance id={ln.id} />
        </group>
      ))}
    </>
  );
}

// ------------------------------------------------------------------------------------------------ perimeter fence
export function Fence() {
  const segs: Array<[number, number, number, number]> = useMemo(
    () => [
      [-720, 548, -16, 548],
      [16, 548, 720, 548],
      [-720, -30, -720, 548],
      [720, -30, 720, 548],
    ],
    [],
  );
  const posts = useMemo<Inst[]>(() => {
    const out: Inst[] = [];
    segs.forEach(([x0, z0, x1, z1]) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.round(len / 8);
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const z = z0 + ((z1 - z0) * i) / n;
        out.push({ p: [x, terrainHeight(x, z) + 1.1, z] });
      }
    });
    return out;
  }, [segs]);
  const postGeo = useMemo(() => new BoxGeometry(0.14, 2.3, 0.14), []);
  const postMat = useMemo(() => new MeshStandardMaterial({ color: '#8a9298', roughness: 0.6, metalness: 0.5 }), []);
  const rails = useMemo(() => new MeshStandardMaterial({ color: '#cfd6d9', roughness: 0.5, metalness: 0.6 }), []);
  const mesh = useMemo(() => new MeshBasicMaterial({ color: '#c3ccd0', transparent: true, opacity: 0.22, side: DoubleSide, depthWrite: false }), []);
  return (
    <group>
      <Instanced geometry={postGeo} material={postMat} items={posts} />
      {segs.map(([x0, z0, x1, z1], i) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        const ang = Math.atan2(z1 - z0, x1 - x0);
        const y = terrainHeight(cx, cz);
        return (
          <group key={i} position={[cx, y, cz]} rotation={[0, -ang, 0]}>
            <mesh position={[0, 1.1, 0]} material={mesh} renderOrder={4}>
              <planeGeometry args={[len, 2.0]} />
            </mesh>
            {[0.35, 1.1, 2.05].map((h) => (
              <mesh key={h} position={[0, h, 0]} material={rails}>
                <boxGeometry args={[len, 0.06, 0.06]} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

// ------------------------------------------------------------------------------------------------ contractor camp, laydown, stockpiles
export function SiteCamp() {
  const cabins = useMemo<Inst[]>(() => {
    const out: Inst[] = [];
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 8; i++) {
        const x = -700 + i * 8.2;
        const z = 250 + row * 14;
        out.push({ p: [x, LAND_Y + 1.5, z] });
        if ((i + row) % 3 === 0) out.push({ p: [x, LAND_Y + 4.35, z] });
      }
    return out;
  }, []);
  const cabinGeo = useMemo(() => new BoxGeometry(7.4, 2.8, 3.2), []);
  const cabinMat = useMemo(() => new MeshStandardMaterial({ map: cabinTexture(), roughness: 0.7 }), []);
  const boxes = useMemo<Inst[]>(() => {
    const pal = ['#b23a2e', '#2f6da3', '#d08a1d', '#2e8b57', '#7d3c98', '#c9d3d8', '#d35400', '#16807a'];
    const out: Inst[] = [];
    for (let i = 0; i < 46; i++) {
      const r = hash32(`cb${i}`);
      const col = i % 8;
      const row = Math.floor(i / 8);
      const lv = 1 + (r % 3);
      for (let l = 0; l < lv; l++) out.push({ p: [-700 + col * 14, LAND_Y + 1.3 + l * 2.6, 70 + row * 4], ry: 0, c: pal[(r >> 3) % pal.length] });
    }
    return out;
  }, []);
  const boxGeo = useMemo(() => new BoxGeometry(12.2, 2.6, 2.44), []);
  const boxMat = useMemo(() => new MeshStandardMaterial({ roughness: 0.65, metalness: 0.25 }), []);
  const padTex = useMemo(() => {
    const t = asphaltTexture().clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(190 / 8, 280 / 8);
    t.needsUpdate = true;
    return t;
  }, []);
  return (
    <group>
      {/* graded pad under the camp + laydown */}
      <mesh position={[-640, LAND_Y + 0.04, 180]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[190, 280]} />
        <meshStandardMaterial map={padTex} roughness={1} color="#a8a49c" polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      <Instanced geometry={cabinGeo} material={cabinMat} items={cabins} receive />
      <Instanced geometry={boxGeo} material={boxMat} items={boxes} />
      {/* water tank + flag mast */}
      <mesh position={[-585, LAND_Y + 4.5, 292]} castShadow>
        <cylinderGeometry args={[3.2, 3.2, 9, 20]} />
        <meshStandardMaterial color="#c9d4d8" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[-620, LAND_Y + 7, 160]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 14, 8]} />
        <meshStandardMaterial color="#cfd5d8" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function Stockpiles() {
  const piles = useMemo(() => {
    const defs: Array<{ x: number; z: number; r: number; h: number; c: string; seed: number }> = [
      { x: 650, z: 70, r: 26, h: 12, c: '#d4b886', seed: 1 }, // sand
      { x: 705, z: 95, r: 22, h: 10, c: '#a8a9a6', seed: 2 }, // aggregate
      { x: 760, z: 70, r: 28, h: 13, c: '#6b6d70', seed: 3 }, // rock grading
      { x: 665, z: 160, r: 20, h: 9, c: '#bfa77a', seed: 4 },
      { x: 735, z: 175, r: 30, h: 14, c: '#7b7e80', seed: 5 }, // armour rock
      { x: 800, z: 150, r: 18, h: 8, c: '#9c9f9e', seed: 6 },
      { x: 680, z: 245, r: 24, h: 11, c: '#cdb487', seed: 7 },
      { x: 770, z: 255, r: 20, h: 9, c: '#8e9091', seed: 8 },
    ];
    return defs.map((d) => {
      const g = new ConeGeometry(d.r, d.h, 24, 6, true);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const k = 0.88 + 0.28 * fbm(x * 0.2 + d.seed * 11, z * 0.2 - d.seed * 3, 3);
        const rise = (y + d.h / 2) / d.h;
        p.setXYZ(i, x * k, y + (fbm(x * 0.35, z * 0.35, 2) - 0.5) * 1.2 * (1 - rise), z * k);
      }
      g.computeVertexNormals();
      return { ...d, g };
    });
  }, []);
  return (
    <group>
      {piles.map((d) => (
        <mesh key={d.seed} geometry={d.g} position={[d.x, LAND_Y + d.h / 2 - 0.2, d.z]} castShadow receiveShadow>
          <meshStandardMaterial color={d.c} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------------------------------------ quay bollards + navigation buoys
export function Bollards({ model }: { model: SceneModel }) {
  const xs = useMemo(() => {
    const out: number[] = [];
    for (let k = 1; k <= 10; k++) {
      const kk = String(k).padStart(2, '0');
      const st: ElementState | undefined = model.states.get(`CAP-${kk}`);
      if ((st?.pf ?? 0) < 0.99) continue;
      const cx = -350 + 70 * (k - 0.5);
      for (const o of [-26, 0, 26]) out.push(cx + o);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.states, model.t]);
  const key = xs.join(',');
  const items = useMemo<Inst[]>(() => xs.map((x) => ({ p: [x, 4.4 + 0.55, -16.7] })), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const geo = useMemo(() => new CylinderGeometry(0.55, 0.8, 1.1, 10), []);
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#2b2f33', roughness: 0.5, metalness: 0.6 }), []);
  return <Instanced geometry={geo} material={mat} items={items} />;
}

export function Buoys({ show }: { show: boolean }) {
  const red = useMemo<Inst[]>(() => Array.from({ length: 7 }, (_, i) => ({ p: [-150 - (i % 2) * 6, 0.6, -640 + i * 54], s: 1 })), []);
  const green = useMemo<Inst[]>(() => Array.from({ length: 7 }, (_, i) => ({ p: [150 + (i % 2) * 6, 0.6, -640 + i * 54], s: 1 })), []);
  const geo = useMemo(() => new CylinderGeometry(0.2, 1.1, 3.2, 10), []);
  const mr = useMemo(() => new MeshStandardMaterial({ color: '#d63a2f', emissive: '#d63a2f', emissiveIntensity: 0.35, roughness: 0.5 }), []);
  const mg = useMemo(() => new MeshStandardMaterial({ color: '#2fa35b', emissive: '#2fa35b', emissiveIntensity: 0.35, roughness: 0.5 }), []);
  const bob = useRef<Group>(null);
  useFrame((s) => {
    if (bob.current) bob.current.position.y = Math.sin(s.clock.elapsedTime * 1.3) * 0.12;
  });
  if (!show) return null;
  return (
    <group ref={bob}>
      <Instanced geometry={geo} material={mr} items={red} />
      <Instanced geometry={geo} material={mg} items={green} />
    </group>
  );
}

// ------------------------------------------------------------------------------------------------ pavement markings
const PAVE: Record<string, 'yard' | 'apron' | 'road-x' | 'road-z' | 'gate'> = { yard: 'yard', apron: 'apron' };
export function Markings({ model }: { model: SceneModel }) {
  const items = model.pack.elements.filter((e) => (e.kind === 'yard' || e.kind === 'apron' || e.kind === 'road') && (model.states.get(e.id)?.pf ?? 0) > 0.985);
  return (
    <>
      {items.map((e) => {
        const kind = e.kind === 'road' ? (e.id === 'RD-1' ? 'gate' : e.size[0] > e.size[2] ? 'road-x' : 'road-z') : PAVE[e.kind];
        const tex = markingsTexture(kind, e.size[0], e.size[2]);
        return (
          <mesh key={e.id} position={[e.pos[0], e.pos[1] + e.size[1] / 2 + 0.05, e.pos[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
            <planeGeometry args={[e.size[0], e.size[2]]} />
            <meshBasicMaterial map={tex} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} toneMapped={false} opacity={0.9} />
          </mesh>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------------------------------------ sky dressing + wakes
export function Clouds() {
  const tex = useMemo(() => cloudTexture(), []);
  const refs = useRef<Array<Sprite | null>>([]);
  const defs = useMemo(() => {
    const r = rng(404);
    return Array.from({ length: 16 }, (_, i) => ({
      x: -3200 + r() * 6400,
      y: 700 + r() * 500,
      z: -600 + r() * 3600,
      w: 900 + r() * 1100,
      v: 2 + r() * 3,
      o: 0.5 + r() * 0.3,
      i,
    }));
  }, []);
  useFrame((_, dt) => {
    defs.forEach((d, i) => {
      const s = refs.current[i];
      if (!s) return;
      s.position.x += d.v * dt;
      if (s.position.x > 3600) s.position.x = -3600;
    });
  });
  return (
    <group>
      {defs.map((d) => (
        <sprite
          key={d.i}
          ref={(s) => {
            refs.current[d.i] = s;
          }}
          position={[d.x, d.y, d.z]}
          scale={[d.w, d.w * 0.5, 1]}
          renderOrder={-1}
        >
          <spriteMaterial map={tex} transparent opacity={d.o} depthWrite={false} fog={false} />
        </sprite>
      ))}
    </group>
  );
}

/** V-shaped wake behind a moving vessel (child of the vessel group, model faces +X) */
export function Wake({ length }: { length: number }) {
  const tex = useMemo(() => wakeTexture(), []);
  return (
    <group rotation={[0, Math.PI, 0]} position={[-length * 0.42, 0.12, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <planeGeometry args={[length * 3.2, length * 1.1]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} opacity={0.75} toneMapped={false} />
      </mesh>
    </group>
  );
}


// ------------------------------------------------------------------------------------------------ casting yard dressing + incident zone
export function CastingYardDressing() {
  const Y = 3.1;
  const rebar = useMemo<Inst[]>(() => {
    const out: Inst[] = [];
    for (let row = 0; row < 4; row++) for (let i = 0; i < 4; i++) out.push({ p: [440 + i * 14, Y + 0.4 + (i % 2) * 0.5, 292 + row * 7], ry: 0, s: [1, 1, 1] });
    return out;
  }, []);
  const rebarGeo = useMemo(() => new BoxGeometry(12, 0.8, 1.6), []);
  const rebarMat = useMemo(() => new MeshStandardMaterial({ color: '#6f4a35', roughness: 0.8, metalness: 0.6 }), []);
  const forms = useMemo<Inst[]>(() => {
    const out: Inst[] = [];
    for (let i = 0; i < 10; i++) out.push({ p: [510 + (i % 5) * 7, Y + 0.7 + Math.floor(i / 5) * 1.4, 300 + (i % 3) * 3], ry: 0.1 * i });
    return out;
  }, []);
  const formGeo = useMemo(() => new BoxGeometry(6, 1.2, 2.4), []);
  const formMat = useMemo(() => new MeshStandardMaterial({ color: '#c7a56a', roughness: 0.9 }), []);
  const stores = useMemo<Inst[]>(() => [
    { p: [584, Y + 1.3, 352], c: '#2e6da3' },
    { p: [584, Y + 3.9, 352], c: '#2e6da3' },
    { p: [584, Y + 1.3, 358], c: '#b23a2e' },
    { p: [584, Y + 1.3, 364], c: '#d08a1d' },
    { p: [598, Y + 1.3, 352], c: '#e8ebea' },
    { p: [598, Y + 1.3, 358], c: '#e8ebea' },
  ], []);
  const storeGeo = useMemo(() => new BoxGeometry(12.2, 2.6, 2.44), []);
  const storeMat = useMemo(() => new MeshStandardMaterial({ roughness: 0.6, metalness: 0.3 }), []);
  const barriers = useMemo<Inst[]>(() => {
    const out: Inst[] = [];
    for (let i = 0; i < 22; i++) out.push({ p: [424 + i * 4.2, Y + 0.45, 30], ry: 0, c: i % 2 ? '#e8e8e4' : '#c9372c' });
    return out;
  }, []);
  const barGeo = useMemo(() => new BoxGeometry(3.8, 0.9, 0.6), []);
  const barMat = useMemo(() => new MeshStandardMaterial({ roughness: 0.7 }), []);
  return (
    <group>
      <Instanced geometry={rebarGeo} material={rebarMat} items={rebar} />
      <Instanced geometry={formGeo} material={formMat} items={forms} />
      <Instanced geometry={storeGeo} material={storeMat} items={stores} />
      <Instanced geometry={barGeo} material={barMat} items={barriers} />
    </group>
  );
}

/** red/white exclusion ring of cones + a translucent disc around the machine the incident is about */
export function IncidentZone({ at, radius = 17 }: { at: [number, number, number]; radius?: number }) {
  const cones = useMemo<Inst[]>(() => Array.from({ length: 20 }, (_, i) => ({ p: [at[0] + Math.cos((i / 20) * Math.PI * 2) * radius, at[1] + 0.55, at[2] + Math.sin((i / 20) * Math.PI * 2) * radius], c: i % 2 ? '#ff6a1a' : '#ffd23f' })), [at, radius]);
  const geo = useMemo(() => new ConeGeometry(0.4, 1.1, 8), []);
  const mat = useMemo(() => new MeshStandardMaterial({ roughness: 0.6, emissive: '#ff5a10', emissiveIntensity: 0.25 }), []);
  const disc = useRef<Group>(null);
  useFrame((s) => {
    if (disc.current) disc.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 2.2) * 0.025);
  });
  return (
    <group>
      <Instanced geometry={geo} material={mat} items={cones} />
      <group ref={disc} position={[at[0], at[1] + 0.12, at[2]]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
          <circleGeometry args={[radius, 48]} />
          <meshBasicMaterial color="#ff3b30" transparent opacity={0.16} depthWrite={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
          <ringGeometry args={[radius - 0.5, radius, 64]} />
          <meshBasicMaterial color="#ff3b30" transparent opacity={0.8} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------------------------------------ jack-up barge (composite)
function latticeLeg(h = 26, w = 1.7): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, rz = 0, rx = 0) => {
    const g = new BoxGeometry(sx, sy, sz);
    g.rotateZ(rz);
    g.rotateX(rx);
    g.translate(x, y, z);
    parts.push(g);
  };
  const c = w / 2;
  for (const [x, z] of [[-c, -c], [c, -c], [-c, c], [c, c]]) box(0.2, h, 0.2, x, h / 2, z);
  const step = 2.6;
  for (let y = 0; y < h; y += step) {
    box(w, 0.1, 0.1, 0, y, -c);
    box(w, 0.1, 0.1, 0, y, c);
    box(0.1, 0.1, w, -c, y, 0);
    box(0.1, 0.1, w, c, y, 0);
    const d = Math.hypot(w, step);
    const a = Math.atan2(step, w);
    box(d, 0.09, 0.09, 0, y + step / 2, -c, a);
    box(d, 0.09, 0.09, 0, y + step / 2, c, -a);
    box(0.09, 0.09, d, -c, y + step / 2, 0, 0, a);
    box(0.09, 0.09, d, c, y + step / 2, 0, 0, -a);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return merged ?? new BoxGeometry(w, h, w);
}

/** pontoon + four lattice spud legs + the crawler-crane model on deck + accommodation block (model faces +x) */
export function JackUpBarge() {
  const leg = useMemo(() => latticeLeg(), []);
  const legMat = useMemo(() => new MeshStandardMaterial({ color: '#3a4046', roughness: 0.6, metalness: 0.6 }), []);
  const legs = useMemo<Inst[]>(() => [[-15, -5.2], [-15, 5.2], [15, -5.2], [15, 5.2]].map(([x, z]) => ({ p: [x, 2, z] as [number, number, number] })), []);
  const win = useMemo(() => cabinTexture(), []);
  return (
    <group>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[46, 3.4, 15]} />
        <meshStandardMaterial color="#15305a" roughness={0.65} metalness={0.2} />
      </mesh>
      <mesh position={[0, 2.45, 0]} receiveShadow>
        <boxGeometry args={[45.4, 0.25, 14.4]} />
        <meshStandardMaterial color="#8e959a" roughness={0.9} />
      </mesh>
      {/* red anti-fouling band + black fenders */}
      <mesh position={[0, -0.6, 0]}>
        <boxGeometry args={[46.1, 0.9, 15.1]} />
        <meshStandardMaterial color="#7a2a22" roughness={0.8} />
      </mesh>
      {[-18, -6, 6, 18].map((x) => (
        <mesh key={x} position={[x, 1.2, 7.7]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.45, 0.45, 2.2, 10]} />
          <meshStandardMaterial color="#14171a" roughness={0.9} />
        </mesh>
      ))}
      <Instanced geometry={leg} material={legMat} items={legs} />
      {[[-15, -5.2], [-15, 5.2], [15, -5.2], [15, 5.2]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 2.9, z]}>
          <boxGeometry args={[3.2, 1.2, 3.2]} />
          <meshStandardMaterial color="#e2a21b" roughness={0.7} metalness={0.3} />
        </mesh>
      ))}
      {/* crane */}
      <group position={[-3, 2.6, 0]} rotation={[0, 0.5, 0]} scale={0.95}>
        <ModelInstance id="crawler-crane" />
      </group>
      {/* accommodation + wheelhouse */}
      <mesh position={[17.8, 5.0, 0]} castShadow>
        <boxGeometry args={[7, 5, 8]} />
        <meshStandardMaterial color="#e5e8e8" roughness={0.6} map={win} />
      </mesh>
      <mesh position={[18.4, 8.1, 0]} castShadow>
        <boxGeometry args={[4, 2.2, 6]} />
        <meshStandardMaterial color="#d6dadb" roughness={0.6} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------------------------------------ scenery models (Sketchfab, CC-BY)
function MovingModel({ id, motion, wake, scale = 1 }: { id: ModelId; motion: MotionSpec; wake?: number; scale?: number }) {
  const ref = useRef<Group>(null);
  useFrame((st) => {
    const g = ref.current;
    if (!g) return;
    const ps = poseAt(motion, st.clock.elapsedTime);
    g.position.set(ps.x, ps.y, ps.z);
    g.rotation.y = ps.yaw;
  });
  return (
    <group ref={ref} scale={scale}>
      <ModelInstance id={id} />
      {wake ? <Wake length={wake} /> : null}
    </group>
  );
}

const loopRect = (x0: number, z0: number, x1: number, z1: number): Array<[number, number]> => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

/** static + moving site life drawn from the downloaded models; each item waits for the element it stands on */
export function Scenery({ model }: { model: SceneModel }) {
  const built = (id: string, min = 0.98) => (model.states.get(id)?.pf ?? 0) >= min;
  const items: Array<{ id: ModelId; pos: [number, number, number]; yaw: number; scale?: number; need?: string }> = [
    // yard gantries
    { id: 'rtg-gantry-crane', pos: [-240, 3.1, 140], yaw: 0, need: 'YRD-1' },
    { id: 'rtg-gantry-crane', pos: [0, 3.1, 140], yaw: 0, need: 'YRD-2' },
    { id: 'rtg-gantry-crane', pos: [-240, 3.1, 260], yaw: 0, need: 'YRD-4' },
    { id: 'rtg-gantry-crane', pos: [240, 3.1, 260], yaw: 0, need: 'YRD-6' },
    // site vehicles + plant
    { id: 'forklift', pos: [150, 3.5, 354], yaw: 0.6, need: 'BLD-WH' },
    { id: 'forklift', pos: [-250, 3.5, 446], yaw: -0.8, need: 'BLD-WORK' },
    { id: 'pickup-truck', pos: [-120, 3.5, 446], yaw: 0.2, need: 'BLD-ADMIN' },
    { id: 'pickup-truck', pos: [-98, 3.5, 447], yaw: 0.25, need: 'BLD-ADMIN' },
    { id: 'pickup-truck', pos: [26, 3.5, 452], yaw: 1.3, need: 'BLD-GATE' },
    { id: 'pickup-truck', pos: [-604, 2.9, 208], yaw: 0.1 },
    { id: 'pickup-truck', pos: [-598, 2.9, 222], yaw: 3.0 },
    { id: 'wheel-loader', pos: [712, 2.9, 118], yaw: 2.4 },
    { id: 'bulldozer', pos: [690, 2.9, 205], yaw: -0.7 },
    { id: 'bulldozer', pos: [-560, 2.9, 120], yaw: 0.4 },
    { id: 'road-roller', pos: [200, 3.5, 78], yaw: 0.3, need: 'APR-4' },
    // fuel farm, lighting, camp buildings
    { id: 'storage-tank', pos: [-392, 2.9, 494], yaw: 0, scale: 1 },
    { id: 'storage-tank', pos: [-362, 2.9, 504], yaw: 1, scale: 1 },
    { id: 'storage-tank', pos: [-332, 2.9, 496], yaw: 2, scale: 1 },
    { id: 'warehouse-gable', pos: [-590, 2.9, 372], yaw: 0 },
    { id: 'site-office-unit', pos: [-662, 2.9, 128], yaw: 0 },
    { id: 'site-office-unit', pos: [-662, 2.9, 138], yaw: 0 },
    { id: 'lighthouse-redwhite', pos: [80, 5.2, -440], yaw: 0, need: 'BW-3' },
  ];
  const masts: Array<[number, number]> = [[-704, 54], [-704, 304], [-566, 54], [-566, 304], [640, 52], [830, 52], [830, 300], [640, 300]];
  const tripods: Array<[number, number]> = [[462, 176], [494, 256], [440, 232], [520, 120], [455, 372], [-640, 118]];
  const key = items.map((it) => (it.need && !built(it.need, it.id === 'road-roller' ? 0.2 : 0.98) ? 0 : 1)).join('');
  const groups = useMemo(() => {
    const g = new Map<ModelId, GlbInst[]>();
    items.forEach((it, i) => {
      if (key[i] === '0') return;
      const arr = g.get(it.id) ?? [];
      arr.push({ p: it.pos, ry: it.yaw, s: it.scale ?? 1 });
      g.set(it.id, arr);
    });
    g.set('light-mast', masts.map(([x, z]) => ({ p: [x, terrainHeight(x, z), z] as [number, number, number] })));
    g.set('flood-light-tripod', tripods.map(([x, z], i) => ({ p: [x, i < 5 ? 3.1 : 2.9, z] as [number, number, number], ry: i })));
    return [...g.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <group>
      {groups.map(([id, list]) => (
        <InstancedGLB key={id} id={id} items={list} />
      ))}
      {/* terminal tractors circulating on the ring road once it is paved */}
      {built('RD-2') && (
        <>
          <MovingModel id="semi-truck-trailer" motion={{ kind: 'loop', pts: loopRect(-330, 324, 330, 336), y: 3.5, speed: 7, phase: 0.1 }} />
          <MovingModel id="semi-truck-trailer" motion={{ kind: 'loop', pts: loopRect(-330, 324, 330, 336), y: 3.5, speed: 7, phase: 0.55 }} />
        </>
      )}
      {/* harbour work boats in the basin */}
      <MovingModel id="workboat" wake={16} motion={{ kind: 'loop', pts: [[-120, -160], [60, -200], [90, -120], [-80, -90]], y: 0.2, speed: 6, phase: 0 }} />
      <MovingModel id="workboat" wake={16} motion={{ kind: 'loop', pts: [[200, -150], [330, -100], [280, -180]], y: 0.2, speed: 5, phase: 0.4 }} />
    </group>
  );
}

// ------------------------------------------------------------------------------------------------ highway pack surroundings
/** sand plain with scattered rocks, scrub and palms plus ridge backdrops (the highway runs along x at z = 0) */
export function HighwayScenery() {
  const ridgeS = useMemo(() => makeRidge(1500, 1, 2), []);
  const ridgeN = useMemo(() => makeRidge(-1500, -1, 7), []);
  const map = useMemo(() => {
    const t = sandGrainTexture().clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(9000 / 26, 3200 / 26);
    t.needsUpdate = true;
    return t;
  }, []);
  const palmGeo = useMemo(makePalmGeometry, []);
  const palmMat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.85 }), []);
  const rockGeo = useMemo(() => rockGeometry(5), []);
  const rockMat = useMemo(() => new MeshStandardMaterial({ roughness: 1, flatShading: true }), []);
  const scrubGeo = useMemo(() => new IcosahedronGeometry(1, 0), []);
  const scrubMat = useMemo(() => new MeshStandardMaterial({ roughness: 1, flatShading: true }), []);
  const clear = (x: number, z: number) => !(Math.abs(z) < 90) && !(Math.abs(x) < 320 && Math.abs(z) < 190);
  const palms = useMemo<Inst[]>(() => {
    const out: Inst[] = [];
    scatter(60, 51, -1200, 1200, -420, 420, clear, 30).forEach(([x, z], i) => out.push({ p: [x, 0, z], ry: i, s: 0.9 + ((hash32(`hp${i}`) % 60) / 100) }));
    for (let x = -860; x < 860; x += 34) {
      out.push({ p: [x, 0, 34], ry: x, s: 1 });
      out.push({ p: [x + 12, 0, -34], ry: x * 2, s: 1 });
    }
    return out;
  }, []);
  const rocks = useMemo<Inst[]>(() => {
    const cols = ['#8a7a66', '#7b6d5c', '#938574', '#6f655a'];
    return scatter(150, 52, -1600, 1600, -900, 900, clear, 30).map(([x, z], i) => {
      const k = 0.8 + (hash32(`hr${i}`) % 300) / 100;
      return { p: [x, k * 0.1, z] as [number, number, number], ry: i, s: [k * 1.3, k * 0.8, k] as [number, number, number], c: cols[i % cols.length] };
    });
  }, []);
  const scrub = useMemo<Inst[]>(() => {
    const cols = ['#6f7447', '#7d7a4c', '#5f6a42', '#857c52'];
    return scatter(260, 53, -1500, 1500, -800, 800, (x, z) => clear(x, z) && fbm(x * 0.006, z * 0.006, 3) > 0.45, 20).map(([x, z], i) => {
      const k = 0.9 + (hash32(`hs${i}`) % 130) / 100;
      return { p: [x, k * 0.25, z] as [number, number, number], ry: i, s: [k * 1.4, k * 0.7, k * 1.2] as [number, number, number], c: cols[i % cols.length] };
    });
  }, []);
  useEffect(
    () => () => {
      [ridgeS, ridgeN, palmGeo, rockGeo, scrubGeo].forEach((g) => g.dispose());
      [palmMat, rockMat, scrubMat].forEach((m) => m.dispose());
      map.dispose();
    },
    [ridgeS, ridgeN, palmGeo, rockGeo, scrubGeo, palmMat, rockMat, scrubMat, map],
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
        <planeGeometry args={[9000, 3200]} />
        <meshStandardMaterial color="#c9b189" map={map} roughness={1} />
      </mesh>
      <mesh geometry={ridgeS} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <mesh geometry={ridgeN} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <Instanced geometry={palmGeo} material={palmMat} items={palms} />
      <Instanced geometry={rockGeo} material={rockMat} items={rocks} receive />
      <Instanced geometry={scrubGeo} material={scrubMat} items={scrub} />
    </group>
  );
}
