// The 3D/4D port twin. Civil works are procedural (cheap, animatable, driven by schedule progress); equipment comes from the
// manifest (GLB or procedural placeholder). Scene content is a pure function of the SceneModel (schedule at the view date).
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  RepeatWrapping,
  Vector3,
  type Mesh,
  type Texture,
} from 'three';
import type { ColorMode, Quality } from '../app/store';
import type { SceneElement } from '../engine/types';
import type { Id } from '../engine/types';
import type { ElementState } from '../engine/twin';
import { assetOnSite } from '../engine/twin';
import { hash32, noise1 } from '../engine/dates';
import { ModelInstance, SceneEnv } from './common';
import { bottomBox, edgesOf, frontEdgeBox, leftEdgeBox, makeSeabed, rubbleGeometry } from './geo';
import { asphaltTexture, caissonTexture, corrugatedTexture, facadeTexture, sandGrainTexture, slabTexture } from './textures';
import { Water } from './water';
import { AccessRoad, Bollards, Buoys, CastingYardDressing, Clouds, Fence, HighwayScenery, IncidentZone, JackUpBarge, Markings, Scenery, SiteCamp, Stockpiles, Terrain, Traffic, Vegetation, Wake } from './props';
import { poseAt } from './motion';
import { prog, type SceneModel } from './sceneModel';
import type { ModelId } from './assetManifest';
import { highwayCameraPresets } from '../packs/highway/data';

export type MatRisk = 'ok' | 'watch' | 'risk' | 'late' | 'none';

export interface PortSceneProps {
  model: SceneModel;
  colorMode: ColorMode;
  selection: Id | null;
  onSelect: (id: Id | null) => void;
  quality: Quality;
  outline: boolean;
  zones: boolean;
  fleet: boolean;
  labels: boolean;
  matRisk: Map<Id, MatRisk>;
  assetHealth: Map<Id, { health: number; status: 'good' | 'watch' | 'warning' | 'critical' }>;
  overlay: Record<Id, 'watch' | 'late'>;
  preset?: { name: string; nonce: number };
  onContextLost?: () => void;
  /** a machine the DOM overlay is pinned to (the demo's incident) + the camera that frames it; `anchorRef` is moved every frame */
  incident?: { pos: [number, number, number]; cam: { pos: [number, number, number]; target: [number, number, number] } } | null;
  anchorRef?: RefObject<HTMLDivElement | null>;
  /** e2e / perf hook */
  onStats?: (s: { calls: number; triangles: number }) => void;
}

const C = { good: '#3ee0b0', warn: '#f7b84b', bad: '#ff6b6b', dim: '#52707a', ghost: '#7fe0d0', sel: '#ffffff' };

function tintFor(el: SceneElement, st: ElementState | undefined, p: PortSceneProps): string | null {
  const ov = p.overlay[el.id];
  if (ov) return ov === 'late' ? C.bad : C.warn;
  switch (p.colorMode) {
    case 'progress':
      if (!st || st.status === 'planned') return C.dim;
      return st.health === 'late' ? C.bad : st.health === 'watch' ? C.warn : st.health === 'ok' ? C.good : C.dim;
    case 'material': {
      const r = p.matRisk.get(el.id) ?? 'none';
      return r === 'ok' ? C.good : r === 'watch' || r === 'risk' ? C.warn : r === 'late' ? C.bad : C.dim;
    }
    case 'health':
    case 'hse':
      return '#4b636c';
    default:
      return null;
  }
}

// ------------------------------------------------------------------------------------------------ water / sky / land
function Seabed({ dp }: { dp: number }) {
  const sb = useMemo(() => makeSeabed(), []);
  const last = useRef(-1);
  useLayoutEffect(() => {
    const q = Math.round(dp * 50) / 50;
    if (q !== last.current) {
      last.current = q;
      sb.update(q);
    }
  }, [dp, sb]);
  return (
    <group>
      <mesh geometry={sb.geo} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      {/* far seabed filler so the horizon never shows a void */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -14, 0]}>
        <planeGeometry args={[6000, 6000]} />
        <meshBasicMaterial color="#143846" />
      </mesh>
    </group>
  );
}

function Land() {
  // casting yard pad (on the east headland) - the terrain mesh itself provides the rest of the land
  const tex = useMemo(() => {
    const t = slabTexture().clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(200 / 15, 370 / 15);
    t.needsUpdate = true;
    return t;
  }, []);
  return (
    <group>
      <Terrain />
      <mesh position={[520, 2.95, 205]} receiveShadow>
        <boxGeometry args={[200, 0.4, 370]} />
        <meshStandardMaterial map={tex} color="#bfbaac" roughness={0.95} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------------------------------------ elements
interface ElProps {
  el: SceneElement;
  st: ElementState | undefined;
  tint: string | null;
  selected: boolean;
  sceneP: PortSceneProps;
}

function pick(p: PortSceneProps, id: Id) {
  return (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    p.onSelect(id);
  };
}
const hov = {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
  },
  onPointerOut: () => {
    document.body.style.cursor = '';
  },
};

function Ghost({ el, show, selected }: { el: SceneElement; show: boolean; selected: boolean }) {
  const geo = useMemo(() => edgesOf(new BoxGeometry(el.size[0], el.size[1], el.size[2])), [el]);
  if (!show && !selected) return null;
  return (
    <lineSegments geometry={geo} position={el.pos} rotation={[0, el.rotY ?? 0, 0]} renderOrder={5}>
      <lineBasicMaterial color={selected ? C.sel : C.ghost} transparent opacity={selected ? 1 : 0.32} depthWrite={false} />
    </lineSegments>
  );
}

function ElMat({ color, tint, emissive = 0, map, rough = 0.85, metal = 0.05, flat = false, vcol = false }: { color: string; tint: string | null; emissive?: number; map?: Texture; rough?: number; metal?: number; flat?: boolean; vcol?: boolean }) {
  return <meshStandardMaterial color={tint ?? color} emissive={tint ?? color} emissiveIntensity={emissive} roughness={rough} metalness={metal} map={map ?? null} flatShading={flat} vertexColors={vcol} />;
}

/** surface texture per element kind: tiled by real-world size so pavements/facades keep their scale */
function surfaceTexture(el: SceneElement, w: number, h: number, d: number): Texture | undefined {
  const make = (base: Texture, rx: number, ry: number) => {
    const t = base.clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(Math.max(1, rx), Math.max(1, ry));
    t.needsUpdate = true;
    return t;
  };
  switch (el.kind) {
    case 'building':
      return /WORK|WH|REEF|FUEL/.test(el.id) ? make(corrugatedTexture(), Math.max(w, d) / 3, 1) : make(facadeTexture(), Math.max(w, d) / 9, Math.max(1, Math.round(h / 4.5)));
    case 'apron':
      return make(slabTexture(), w / 15, d / 15);
    case 'yard':
    case 'road':
      return make(asphaltTexture(), w / 8, d / 8);
    case 'reclamation':
      return make(sandGrainTexture(), w / 26, d / 26);
    case 'quay':
      return make(caissonTexture(), w / 6, Math.max(1, h / 6));
    default:
      return undefined;
  }
}

function GrowBox({ el, st, tint, selected, sceneP, textured }: ElProps & { textured?: boolean }) {
  const p = st?.pf ?? 0;
  const [w, h, d] = el.size;
  const geo = useMemo(() => {
    if (el.kind === 'revetment' || el.kind === 'breakwater') return rubbleGeometry(w, h, d, el.id);
    if (el.grow === 'x') return leftEdgeBox(w, h, d);
    if (el.grow === 'z') return frontEdgeBox(w, h, d);
    return bottomBox(w, h, d);
  }, [el, w, h, d]);
  const tex = useMemo(() => surfaceTexture(el, w, h, d), [el, w, h, d]);
  void textured;
  if (p <= 0.002) return <Ghost el={el} show={sceneP.outline} selected={selected} />;
  const sc: [number, number, number] = el.grow === 'x' ? [Math.max(0.001, p), 1, 1] : el.grow === 'z' ? [1, 1, Math.max(0.001, p)] : [1, Math.max(0.001, p), 1];
  const pos: [number, number, number] =
    el.grow === 'x' ? [el.pos[0] - w / 2, el.pos[1], el.pos[2]] : el.grow === 'z' ? [el.pos[0], el.pos[1], el.pos[2] - d / 2] : [el.pos[0], el.pos[1] - h / 2, el.pos[2]];
  const pave = el.kind === 'apron' || el.kind === 'yard' || el.kind === 'road';
  // pavement layers: soil -> base -> final surfacing as progress increases
  const base = pave ? (p < 0.35 ? '#7d6e52' : p < 0.7 ? '#8a8a84' : '#ffffff') : el.kind === 'building' || el.kind === 'quay' ? '#f2f2f2' : el.kind === 'reclamation' ? '#b0a68f' : el.color;
  const rubble = el.kind === 'revetment' || el.kind === 'breakwater';
  const useMap = pave ? p >= 0.7 : true;
  return (
    <>
      <mesh geometry={geo} position={pos} scale={sc} rotation={[0, el.rotY ?? 0, 0]} castShadow={!pave} receiveShadow onClick={pick(sceneP, el.id)} {...hov} userData={{ elementId: el.id }}>
        <ElMat color={rubble ? el.color : base} tint={tint} emissive={selected ? 0.35 : 0} map={useMap ? tex : undefined} rough={el.kind === 'building' ? 0.7 : 0.92} flat={rubble} vcol={rubble} />
      </mesh>
      {p < 0.999 && <Ghost el={el} show={sceneP.outline} selected={selected} />}
      {selected && p >= 0.999 && <Ghost el={el} show={false} selected />}
      {el.kind === 'building' && p > 0.97 && <RoofPlant el={el} />}
      {el.kind === 'building' && p > 0.01 && (
        <mesh position={[el.pos[0], el.pos[1] - h / 2 + h * p + 0.25, el.pos[2]]} castShadow>
          <boxGeometry args={[w + 1.2, 0.5, d + 1.2]} />
          <meshStandardMaterial color="#6d767b" roughness={0.8} />
        </mesh>
      )}
    </>
  );
}

/** rooftop plant (AC units, vents) so flat roofs read as real buildings */
function RoofPlant({ el }: { el: SceneElement }) {
  const [w, h, d] = el.size;
  const n = Math.max(2, Math.round((w * d) / 700));
  const units = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const k = hash32(`${el.id}-${i}`);
        return { x: ((k % 100) / 100 - 0.5) * (w - 10), z: (((k >> 7) % 100) / 100 - 0.5) * (d - 8), sx: 3 + (k % 4), sz: 2.4 + ((k >> 3) % 3), sy: 1.4 + ((k >> 5) % 3) * 0.4 };
      }),
    [el.id, n, w, d],
  );
  const top = el.pos[1] - h / 2 + h + 0.5;
  return (
    <group position={[el.pos[0], top, el.pos[2]]} rotation={[0, el.rotY ?? 0, 0]}>
      {units.map((u, i) => (
        <mesh key={i} position={[u.x, u.sy / 2, u.z]} castShadow>
          <boxGeometry args={[u.sx, u.sy, u.sz]} />
          <meshStandardMaterial color={i % 2 ? '#aab2b6' : '#c8cdd0'} roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[w + 1.2, 0.3, d + 1.2]} />
        <meshStandardMaterial color="#4a5257" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Rails({ el, st, tint, selected, sceneP }: ElProps) {
  const p = st?.pf ?? 0;
  const [w] = el.size;
  if (p <= 0.002) return <Ghost el={el} show={sceneP.outline} selected={selected} />;
  const geo = useMemo(() => leftEdgeBox(w, 0.35, 0.6), [w]);
  return (
    <group onClick={pick(sceneP, el.id)} {...hov}>
      {[-9, 17].map((z) => (
        <mesh key={z} geometry={geo} position={[el.pos[0] - w / 2, el.pos[1], z]} scale={[Math.max(0.001, p), 1, 1]} receiveShadow>
          <ElMat color="#c9ced2" tint={tint} emissive={selected ? 0.4 : 0} rough={0.4} metal={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Fenders({ el, st, tint, selected, sceneP }: ElProps) {
  const p = st?.pf ?? 0;
  const n = el.count ?? 6;
  if (p <= 0.002) return <Ghost el={el} show={sceneP.outline} selected={selected} />;
  const step = el.size[0] / n;
  return (
    <group onClick={pick(sceneP, el.id)} {...hov}>
      {Array.from({ length: n }).map((_, i) => {
        const s = Math.min(1, Math.max(0, p * n - i));
        if (s <= 0.01) return null;
        return (
          <mesh key={i} position={[el.pos[0] - el.size[0] / 2 + step * (i + 0.5), el.pos[1], el.pos[2]]} rotation={[Math.PI / 2, 0, 0]} scale={[s, s, s]} castShadow>
            <cylinderGeometry args={[1.5, 1.8, 1.8, 14]} />
            <ElMat color="#1d2226" tint={tint} emissive={selected ? 0.5 : 0} rough={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

function Masts({ el, st, tint, selected, sceneP }: ElProps) {
  const p = st?.pf ?? 0;
  const n = el.count ?? 5;
  if (p <= 0.002) return <Ghost el={el} show={sceneP.outline} selected={selected} />;
  const step = el.size[0] / (n - 1);
  const h = el.size[1];
  return (
    <group onClick={pick(sceneP, el.id)} {...hov}>
      {Array.from({ length: n }).map((_, i) => {
        const s = Math.min(1, Math.max(0.001, p * 1.4 - (i / n) * 0.4));
        const x = el.pos[0] - el.size[0] / 2 + step * i;
        return (
          <group key={i} position={[x, el.pos[1], el.pos[2]]}>
            <mesh position={[0, (h * s) / 2, 0]} castShadow>
              <cylinderGeometry args={[0.45, 0.8, h * s, 8]} />
              <ElMat color="#8d969c" tint={tint} emissive={selected ? 0.5 : 0} rough={0.5} metal={0.5} />
            </mesh>
            <mesh position={[0, h * s + 0.6, 0]}>
              <boxGeometry args={[4.5, 1.2, 4.5]} />
              <meshStandardMaterial color="#2b2f33" emissive={p > 0.95 ? '#ffe9a8' : '#000000'} emissiveIntensity={p > 0.95 ? 0.6 : 0} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function StsCrane({ el, st, tint, selected, sceneP }: ElProps) {
  const p = st?.pf ?? 0;
  const g = useRef<Group>(null);
  if (p <= 0.01) return <Ghost el={el} show={sceneP.outline} selected={selected} />;
  return (
    <group ref={g} position={[el.pos[0], el.pos[1] + 0.1, el.pos[2]]} scale={[1, Math.max(0.05, p), 1]} onClick={pick(sceneP, el.id)} {...hov}>
      <ModelInstance id="sts-crane" rotationY={Math.PI / 2} />
      {tint && (
        <mesh position={[0, 30, 0]}>
          <boxGeometry args={[34, 62, 82]} />
          <meshBasicMaterial color={tint} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
      {selected && <Ghost el={{ ...el, pos: [0, 28, 0], size: [34, 56, 82] }} show={false} selected />}
    </group>
  );
}

function Element(props: ElProps) {
  switch (props.el.kind) {
    case 'rail':
      return <Rails {...props} />;
    case 'fender':
      return <Fenders {...props} />;
    case 'mast':
      return <Masts {...props} />;
    case 'sts':
      return <StsCrane {...props} />;
    case 'building':
      return <GrowBox {...props} textured />;
    default:
      return <GrowBox {...props} />;
  }
}

// ------------------------------------------------------------------------------------------------ caissons (cast in the yard, towed, placed)
function Caissons({ model, tintOf, selection, onSelect, outline }: { model: SceneModel; tintOf: (id: Id) => string | null; selection: Id | null; onSelect: (id: Id) => void; outline: boolean }) {
  const tex = useMemo(() => {
    const t = caissonTexture().clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(11, 3);
    t.needsUpdate = true;
    return t;
  }, []);
  const items = [];
  for (let k = 1; k <= 10; k++) {
    const kk = String(k).padStart(2, '0');
    const id = `QW-${kk}`;
    const c = prog(model, `QW-C${kk}`);
    const p = prog(model, `QW-P${kk}`);
    const f = prog(model, `QW-F${kk}`);
    const quayX = -350 + 70 * (k - 0.5);
    const col = (k - 1) % 2;
    const row = Math.floor((k - 1) / 2);
    const yardX = 560 + 40 * col;
    const yardZ = 40 + 72 * row + 34;
    const tint = tintOf(id);
    const sel = selection === id;
    if (c < 0.01 && p < 0.01) {
      if (outline) items.push(<GhostSlot key={id} x={yardX} z={yardZ} />);
      continue;
    }
    let node;
    if (p < 0.01) {
      // in the casting yard, growing with the cast
      const s = Math.max(0.02, c);
      node = (
        <mesh position={[yardX, 2.4 + 9 * s, yardZ]} scale={[1, s, 1]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow onClick={(e) => (e.stopPropagation(), onSelect(id))} {...hov}>
          <boxGeometry args={[68, 18, 18]} />
          <meshStandardMaterial color={tint ?? '#a3abaf'} map={tint ? null : tex} emissive={sel ? '#ffffff' : '#000000'} emissiveIntensity={sel ? 0.3 : 0} roughness={0.9} />
        </mesh>
      );
    } else {
      const u = Math.min(1, p);
      // tow path: yard -> (east of the quay, afloat) -> berth position, then settle on the bed
      const x = yardX + (quayX - yardX) * u;
      const z = yardZ + (-9 - yardZ) * Math.pow(u, 0.6) - 40 * Math.sin(Math.PI * u);
      const y = u < 0.999 ? -3 + 2 * Math.sin(Math.PI * u) * 0 : -6;
      node = (
        <mesh position={[x, p >= 0.999 ? -6 : y, p >= 0.999 ? -9 : z]} castShadow receiveShadow onClick={(e) => (e.stopPropagation(), onSelect(id))} {...hov}>
          <boxGeometry args={[68, 18, 18]} />
          <meshStandardMaterial color={tint ?? (f > 0.5 ? '#8f989d' : '#a3abaf')} map={tint ? null : tex} emissive={sel ? '#ffffff' : '#000000'} emissiveIntensity={sel ? 0.3 : 0} roughness={0.9} />
        </mesh>
      );
    }
    items.push(<group key={id}>{node}</group>);
  }
  return <>{items}</>;
}

function GhostSlot({ x, z }: { x: number; z: number }) {
  const g = useMemo(() => edgesOf(new BoxGeometry(18, 0.2, 68)), []);
  return (
    <lineSegments geometry={g} position={[x, 2.6, z]}>
      <lineBasicMaterial color={C.ghost} transparent opacity={0.2} />
    </lineSegments>
  );
}

// ------------------------------------------------------------------------------------------------ fleet
function Plant() {
  return (
    <group>
      {[-6, 0, 6].map((x) => (
        <mesh key={x} position={[x, 11, 0]} castShadow>
          <cylinderGeometry args={[2.6, 2.6, 18, 14]} />
          <meshStandardMaterial color="#c7ccd0" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 3, 0]} castShadow>
        <boxGeometry args={[22, 6, 10]} />
        <meshStandardMaterial color="#6a7379" />
      </mesh>
    </group>
  );
}
function Barge() {
  return (
    <group>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[46, 2.4, 14]} />
        <meshStandardMaterial color="#8a4b32" roughness={0.8} />
      </mesh>
      <mesh position={[-10, 2.4, 0]}>
        <boxGeometry args={[10, 2.2, 8]} />
        <meshStandardMaterial color="#c9ced2" />
      </mesh>
    </group>
  );
}
function GenSet() {
  return (
    <mesh position={[0, 1.6, 0]} castShadow>
      <boxGeometry args={[9, 3.2, 3.2]} />
      <meshStandardMaterial color="#3b6ea5" />
    </mesh>
  );
}

function FleetItem({ id, p, vis, health }: { id: Id; p: PortSceneProps; vis: NonNullable<ReturnType<typeof getVis>>; health?: { health: number; status: string } }) {
  const ref = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const m = p.model;
  const on = assetOnSite(m.pack, m.fc, id, m.t) && (!vis.needs || (m.states.get(vis.needs)?.pf ?? 0) >= (vis.needsMin ?? 0.9));
  const seed = useMemo(() => (hash32(id) % 1000) / 10, [id]);
  useFrame((s) => {
    if (!ref.current) return;
    const ps = poseAt(vis.motion, s.clock.elapsedTime + seed * 0);
    ref.current.position.set(ps.x, ps.y, ps.z);
    ref.current.rotation.y = ps.yaw;
  });
  if (!on) return null;
  const critical = health && (health.status === 'critical' || health.status === 'warning');
  const showRing = p.colorMode === 'health' || critical;
  const hc = health ? (health.status === 'good' ? C.good : health.status === 'watch' ? C.warn : C.bad) : C.dim;
  const proc = vis.model.startsWith('proc:');
  return (
    <group ref={ref} scale={vis.scale ?? 1} onClick={pick(p, id)} {...hov} userData={{ assetId: id }}>
      {(vis.model === 'tug' || vis.model === 'dredger') && vis.motion.kind !== 'static' && <Wake length={vis.model === 'tug' ? 32 : 110} />}
      {proc ? vis.model === 'proc:plant' ? <Plant /> : vis.model === 'proc:barge' ? <JackUpBarge /> : <GenSet /> : <ModelInstance id={vis.model as ModelId} />}
      {showRing && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.35, 0]} renderOrder={6}>
          <ringGeometry args={[7, 9, 40]} />
          <meshBasicMaterial color={hc} transparent opacity={0.85} side={DoubleSide} depthWrite={false} blending={AdditiveBlending} />
        </mesh>
      )}
      {p.selection === id && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.45, 0]} renderOrder={7}>
          <ringGeometry args={[9.5, 10.5, 40]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.95} side={DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
function getVis(p: PortSceneProps, id: Id) {
  return p.model.pack.fleetVis[id];
}

function Fleet({ p }: { p: PortSceneProps }) {
  const ids = Object.keys(p.model.pack.fleetVis);
  return (
    <>
      {ids.map((id) => (
        <FleetItem key={id} id={id} p={p} vis={p.model.pack.fleetVis[id]} health={p.assetHealth.get(id)} />
      ))}
    </>
  );
}

/** vessels: heavy-lift ship while the STS cranes are discharged, container ship for the mock operation / trial period */
function Ships({ model }: { model: SceneModel }) {
  const hla = prog(model, 'EQP-HLA');
  const hlb = prog(model, 'EQP-HLB');
  const trial = prog(model, 'COM-06') > 0.01 && prog(model, 'COM-13') < 0.999;
  const showHeavy = (hla > 0.01 && hla < 0.999) || (hlb > 0.01 && hlb < 0.999);
  const hbx = hlb > 0.01 && hlb < 0.999 ? 150 : -160;
  const ops = prog(model, 'COM-12') > 0.5;
  return (
    <>
      {/* ships waiting at anchor offshore */}
      <ModelInstance id="tanker-ship" position={[-820, 0, -1180]} rotationY={0.35} />
      <ModelInstance id="bulk-carrier" position={[980, 0, -1420]} rotationY={-0.2} />
      <ModelInstance id="coastal-cargo-ship" position={[-640, 0, -700]} rotationY={0.9} />
      <ModelInstance id="tug" position={[-690, 0, -1040]} rotationY={1.2} />
      {showHeavy && <ModelInstance id="container-ship" position={[hbx, 0, -44]} rotationY={0} />}
      {trial && <ModelInstance id="container-ship" position={[-130, 0, -44]} rotationY={0} />}
      {ops && <ModelInstance id="container-ship" position={[130, 0, -44]} rotationY={0} />}
    </>
  );
}

/** container stacks that fill the yards once trial operations start */
function Containers({ model }: { model: SceneModel }) {
  const ref = useRef<InstancedMesh>(null);
  const ribTex = useMemo(() => {
    const t = corrugatedTexture().clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(5, 1);
    t.needsUpdate = true;
    return t;
  }, []);
  const frac = Math.min(1, prog(model, 'COM-13') * 1.2 + prog(model, 'COM-06') * 0.1);
  const yards = model.pack.elements.filter((e) => e.kind === 'yard');
  const data = useMemo(() => {
    const out: Array<{ m: Matrix4; c: Color; order: number }> = [];
    const palette = ['#c0392b', '#2e86c1', '#d68910', '#27ae60', '#7d3c98', '#cfd8dc', '#e67e22', '#117a65'];
    yards.forEach((y, yi) => {
      const nx = Math.floor((y.size[0] - 16) / 14);
      const nz = Math.floor((y.size[2] - 16) / 3.4);
      for (let ix = 0; ix < nx; ix++) {
        for (let iz = 0; iz < nz; iz++) {
          if (ix % 5 === 4) continue; // aisle every 4 stacks
          const key = hash32(`${yi}-${ix}-${iz}`);
          const lv = 1 + (key % 4);
          const col = new Color(palette[(key >> 3) % palette.length]);
          const x = y.pos[0] - y.size[0] / 2 + 10 + ix * 14;
          const z = y.pos[2] - y.size[2] / 2 + 10 + iz * 3.4;
          for (let l = 0; l < lv; l++) {
            const m = new Matrix4().makeTranslation(x, y.pos[1] + 0.25 + 1.3 + l * 2.6, z);
            out.push({ m, c: col, order: (noise1(key, l) + 1) / 2 });
          }
        }
      }
    });
    return out;
  }, [yards.length]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const sorted = [...data].sort((a, b) => a.order - b.order);
    sorted.forEach((d, i) => {
      mesh.setMatrixAt(i, d.m);
      mesh.setColorAt(i, d.c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [data]);
  useLayoutEffect(() => {
    if (ref.current) ref.current.count = Math.floor(data.length * frac);
  }, [frac, data.length]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, data.length]} castShadow visible={frac > 0.001} frustumCulled={false}>
      <boxGeometry args={[12.2, 2.5, 2.44]} />
      <meshStandardMaterial roughness={0.6} metalness={0.3} map={ribTex} />
    </instancedMesh>
  );
}

// ------------------------------------------------------------------------------------------------ HSE zones
function Zones({ show }: { show: boolean }) {
  if (!show) return null;
  const sts = [-240, -80, 80, 240];
  return (
    <group>
      {sts.map((x) => (
        <mesh key={x} position={[x, 4.2, -2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
          <planeGeometry args={[34, 90]} />
          <meshBasicMaterial color="#ff4b4b" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.8, -46]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
        <planeGeometry args={[700, 50]} />
        <meshBasicMaterial color="#f7b84b" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh position={[0, 4.1, 80]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
        <planeGeometry args={[700, 8]} />
        <meshBasicMaterial color="#3ee0b0" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------------------------------------ root
function StatsProbe({ onStats }: { onStats?: PortSceneProps['onStats'] }) {
  const { gl } = useThree();
  const n = useRef(0);
  useFrame(() => {
    n.current++;
    if (onStats && (n.current % 3 === 0 || n.current < 6)) onStats({ calls: gl.info.render.calls, triangles: gl.info.render.triangles });
  });
  return null;
}

export const CAMERA_PRESETS: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [420, 250, -740], target: [0, 6, 140] },
  quay: { pos: [-40, 55, -190], target: [-40, 6, 10] },
  castingYard: { pos: [330, 120, 40], target: [520, 6, 200] },
  yard: { pos: [-330, 130, 600], target: [0, 5, 300] },
  offshore: { pos: [-180, 110, -820], target: [-100, 0, -380] },
};

/** projects a world point to canvas pixels every frame and moves a DOM element there (no React state, no extra root) */
function ScreenAnchor({ point, el }: { point: [number, number, number]; el: RefObject<HTMLDivElement | null> }) {
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const node = el.current;
    if (!node) return;
    v.set(point[0], point[1], point[2]).project(camera);
    const behind = v.z > 1 || v.z < -1;
    node.style.visibility = behind ? 'hidden' : 'visible';
    node.style.transform = `translate3d(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px, 0)`;
  });
  return null;
}

function CameraRig({ preset, hwy, incidentCam }: { preset?: { name: string; nonce: number }; hwy?: boolean; incidentCam?: { pos: [number, number, number]; target: [number, number, number] } }) {
  const { camera, controls } = useThree();
  const anim = useRef<{ t: number; fp: Vector3; ft: Vector3; tp: Vector3; tt: Vector3 } | null>(null);
  const seen = useRef(-1);
  useFrame((_, dt) => {
    if (preset && preset.nonce !== seen.current && controls) {
      seen.current = preset.nonce;
      const c = preset.name === 'incident' ? incidentCam : preset.name === 'custom' ? (window as unknown as { __customCam?: { pos: [number, number, number]; target: [number, number, number] } }).__customCam : (hwy ? highwayCameraPresets : CAMERA_PRESETS)[preset.name];
      if (c) {
        const ctl = controls as unknown as OrbitControlsImpl;
        anim.current = { t: 0, fp: camera.position.clone(), ft: ctl.target.clone(), tp: new Vector3(...c.pos), tt: new Vector3(...c.target) };
      }
    }
    const a = anim.current;
    if (a && controls) {
      a.t = Math.min(1, a.t + dt / 1.1);
      const e = a.t * a.t * (3 - 2 * a.t);
      camera.position.lerpVectors(a.fp, a.tp, e);
      (controls as unknown as OrbitControlsImpl).target.lerpVectors(a.ft, a.tt, e);
      (controls as unknown as OrbitControlsImpl).update();
      if (a.t >= 1) anim.current = null;
    }
  });
  return null;
}

function SceneContent(p: PortSceneProps) {
  const m = p.model;
  const dredge = m.states.get('SEABED')?.pf ?? 0;
  const hwy = m.pack.config.sceneKind === 'highway';
  const tintOf = (id: Id) => {
    const el = m.pack.elements.find((e) => e.id === id);
    return el ? tintFor(el, m.states.get(id), p) : null;
  };
  const lightQ = p.quality === 'low';
  const shadowSize = 2048;
  return (
    <>
      <color attach="background" args={['#a9c4cf']} />
      <fog attach="fog" args={['#a9c4cf', 1400, 5200]} />
      <Sky distance={450000} sunPosition={[500, 380, -600]} turbidity={5} rayleigh={1.1} mieCoefficient={0.004} mieDirectionalG={0.8} />
      <SceneEnv intensity={0.4} />
      <hemisphereLight args={['#cfe6f2', '#8a7a5c', 0.7]} />
      <directionalLight position={[420, 520, -380]} intensity={1.9} color="#ffe9cc" castShadow={!lightQ} shadow-mapSize={[shadowSize, shadowSize]} shadow-camera-left={-760} shadow-camera-right={760} shadow-camera-top={760} shadow-camera-bottom={-760} shadow-camera-near={50} shadow-camera-far={1600} shadow-bias={-0.0004} />
      {hwy ? (
        <HighwayScenery />
      ) : (
        <>
          <Water />
          <Seabed dp={dredge} />
          <Land />
          <Vegetation />
          <AccessRoad />
          {!lightQ && <Traffic model={m} />}
          <Fence />
          <SiteCamp />
          <Stockpiles />
          <Bollards model={m} />
          <Markings model={m} />
          <Buoys show />
          <CastingYardDressing />
          {!lightQ && <Scenery model={m} />}
        </>
      )}
      {!lightQ && <Clouds />}
      {p.incident && <IncidentZone at={[p.incident.pos[0], p.incident.pos[1] + 0.3, p.incident.pos[2]]} />}
      {m.pack.elements
        .filter((e) => e.kind !== 'seabed' && !e.id.startsWith('QW-'))
        .map((e) => (
          <Element key={e.id} el={e} st={m.states.get(e.id)} tint={tintFor(e, m.states.get(e.id), p)} selected={p.selection === e.id} sceneP={p} />
        ))}
      {!hwy && <Caissons model={m} tintOf={tintOf} selection={p.selection} onSelect={p.onSelect} outline={p.outline} />}
      {!hwy && <Containers model={m} />}
      {!hwy && <Ships model={m} />}
      {p.fleet && <Fleet p={p} />}
      {!hwy && <Zones show={p.zones || p.colorMode === 'hse'} />}
      <StatsProbe onStats={p.onStats} />
      <CameraRig preset={p.preset} hwy={hwy} incidentCam={p.incident?.cam} />
      {p.incident && p.anchorRef && <ScreenAnchor point={[p.incident.pos[0], p.incident.pos[1] + 9, p.incident.pos[2]]} el={p.anchorRef} />}
      <OrbitControls makeDefault target={hwy ? [0, 6, 0] : [0, 6, 140]} maxPolarAngle={Math.PI / 2.04} minDistance={25} maxDistance={2200} enableDamping dampingFactor={0.08} />
    </>
  );
}

export function PortScene(p: PortSceneProps) {
  const dpr: [number, number] = p.quality === 'high' ? [1, 2] : p.quality === 'balanced' ? [1, 1.25] : [0.75, 1];
  return (
    <Canvas
      shadows="soft"
      dpr={dpr}
      camera={{ position: p.model.pack.config.sceneKind === 'highway' ? highwayCameraPresets.overview.pos : [420, 250, -740], fov: 42, near: 2, far: 9000 }}
      gl={{ antialias: p.quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      onPointerMissed={() => p.onSelect(null)}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          p.onContextLost?.();
        });
      }}
      data-testid="twin-canvas"
    >
      <SceneContent {...p} />
    </Canvas>
  );
}

