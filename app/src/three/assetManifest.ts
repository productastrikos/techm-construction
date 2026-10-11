// Manifest-driven 3D equipment loader. Every model is OPTIONAL: if the .glb exists (import.meta.glob) it is loaded,
// Meshopt-decoded locally (no CDN) and normalised (pivot at bottom-centre, length axis on +X, scaled to
// targetLengthMeters); otherwise a procedural placeholder with the same footprint is used so nothing ever blocks.
import { Box3, Color, Group, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { makePlaceholder, type PlaceholderKind } from './placeholders';

const glbUrls = import.meta.glob('../assets/models/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export type ModelId =
  | 'sts-crane'
  | 'crawler-crane'
  | 'container-ship'
  | 'dredger'
  | 'dump-truck'
  | 'excavator'
  | 'tower-crane'
  | 'tug'
  | 'reach-stacker'
  | 'concrete-mixer'
  | 'piling-rig'
  | 'worker'
  | 'harbour-crane'
  | 'straddle-carrier'
  | 'palm-tree'
  | 'rock-boulder-1'
  | 'rock-boulder-2'
  | 'batching-plant'
  | 'bulk-carrier'
  | 'tanker-ship'
  | 'coastal-cargo-ship'
  | 'workboat'
  | 'bulldozer'
  | 'wheel-loader'
  | 'road-roller'
  | 'forklift'
  | 'pickup-truck'
  | 'semi-truck-trailer'
  | 'rtg-gantry-crane'
  | 'storage-tank'
  | 'lighthouse-redwhite'
  | 'light-mast'
  | 'flood-light-tripod'
  | 'portacabin'
  | 'site-office-unit'
  | 'shipping-container-40ft'
  | 'warehouse-gable'
  | 'concrete-barriers';

export interface Credit {
  title: string;
  author: string;
  licence: string;
  url?: string;
  note?: string;
}

export interface ModelSpec {
  id: ModelId;
  file: string;
  label: string;
  /** real-world length of the model's longest horizontal side, metres */
  targetLengthMeters: number;
  /** extra yaw (radians) applied after the length axis is aligned to +X so that the model faces +X */
  yawOffset: number;
  placeholder: PlaceholderKind;
  /** the raw model is untextured white: multiply a colour onto every material */
  tint?: string;
  credit: Credit;
}

const CC = 'CC BY 4.0';
const SK = (title: string, author: string, id: string): Credit => ({ title, author, licence: CC, url: `https://sketchfab.com/3d-models/${id}` });
const MESHY = (subject: string): Credit => ({ title: subject, author: 'Generated: ChatGPT reference image + Meshy (Image-to-3D)', licence: CC, note: 'AI-generated generic object' });

export const MODELS: Record<ModelId, ModelSpec> = {
  'sts-crane': { id: 'sts-crane', file: 'sts-crane.glb', label: 'STS gantry crane', targetLengthMeters: 70, yawOffset: Math.PI, placeholder: 'sts', credit: MESHY('Ship-to-shore container gantry crane') },
  'crawler-crane': { id: 'crawler-crane', file: 'crawler-crane.glb', label: 'Crawler crane 350 t', targetLengthMeters: 24, yawOffset: 0, placeholder: 'crawler', tint: '#e8a31c', credit: SK('Crawler Crane XCMG XGC75', '8bit (@8_bit)', '935fab212d504279af8b63b0b6d78030') },
  'container-ship': { id: 'container-ship', file: 'container-ship.glb', label: 'Container vessel', targetLengthMeters: 300, yawOffset: 0, placeholder: 'ship', credit: SK('Container Ship', 'RM02 (@RM02)', 'aaa41cca946b4a08bc08cf692b7757be') },
  dredger: { id: 'dredger', file: 'dredger.glb', label: 'Trailing suction hopper dredger', targetLengthMeters: 110, yawOffset: Math.PI, placeholder: 'dredger', credit: MESHY('Trailing suction hopper dredger') },
  'dump-truck': { id: 'dump-truck', file: 'dump-truck.glb', label: 'Articulated dump truck', targetLengthMeters: 11, yawOffset: 0, placeholder: 'truck', credit: SK('Dump Truck', 'ElectroNick (@ElectroNick)', '781c616da8f44982a59cb3fc3fa67f98') },
  excavator: { id: 'excavator', file: 'excavator.glb', label: 'Excavator', targetLengthMeters: 11, yawOffset: 0, placeholder: 'excavator', credit: SK('Excavator (CAT)', 'sarvesh777 (@sarvesh903)', '5f195244108c46e495a1e78040f02f7e') },
  'tower-crane': { id: 'tower-crane', file: 'tower-crane.glb', label: 'Tower crane', targetLengthMeters: 50, yawOffset: 0, placeholder: 'tower', credit: SK('Tower Crane', 'Chamod1999 (@Chamodp)', '49851dc7a51b43bda6aea06856c26a85') },
  tug: { id: 'tug', file: 'tug.glb', label: 'Harbour tug', targetLengthMeters: 32, yawOffset: 0, placeholder: 'tug', credit: SK('Rastar 3200 tugboat', 'Brout (@davidbroutian)', '1bbadbe4ab0a4b2599cd3f450942e6fe') },
  'reach-stacker': { id: 'reach-stacker', file: 'reach-stacker.glb', label: 'Reach stacker', targetLengthMeters: 11, yawOffset: Math.PI, placeholder: 'stacker', credit: MESHY('Container reach stacker') },
  'concrete-mixer': { id: 'concrete-mixer', file: 'concrete-mixer.glb', label: 'Concrete mixer truck', targetLengthMeters: 10, yawOffset: Math.PI, placeholder: 'mixer', credit: MESHY('Concrete mixer truck') },
  'piling-rig': { id: 'piling-rig', file: 'piling-rig.glb', label: 'Piling rig', targetLengthMeters: 16, yawOffset: 0, placeholder: 'piling', tint: '#d9692a', credit: SK('Pile Driver', 'doty_aecom (@doty_aecom)', '997e8984809540e5b3e5ea693eb96983') },
  worker: { id: 'worker', file: 'worker.glb', label: 'Site worker', targetLengthMeters: 1.9, yawOffset: 0, placeholder: 'worker', credit: SK('Low-Poly Construction workers (animated)', 'Jungle Jim (@jungle_jim)', '7b62e6e1b58c476f8b421dd007a4ff90') },
  'harbour-crane': { id: 'harbour-crane', file: 'harbour-crane.glb', label: 'Port crane', targetLengthMeters: 40, yawOffset: 0, placeholder: 'harbour', credit: SK('Port crane "Sokol"', 'Vitaliy Kovalchuk (@Domender)', '4964eaa7634e47c9bac4c2a74fa91c20') },
  'straddle-carrier': { id: 'straddle-carrier', file: 'straddle-carrier.glb', label: 'Straddle carrier', targetLengthMeters: 9, yawOffset: 0, placeholder: 'straddle', credit: SK('Straddle Carrier', 'JakeBradley (@JakeBradley)', '63f733b8d7784ad095849cb60d4df374') },
  'palm-tree': { id: 'palm-tree', file: 'palm-tree.glb', label: 'Date palm', targetLengthMeters: 5.6, yawOffset: 0, placeholder: 'worker', credit: SK('Date Palm', 'evolveduk (@evolveduk)', '11acf710e6c149daa8d6fb8cdc5d087f') },
  'rock-boulder-1': { id: 'rock-boulder-1', file: 'rock-boulder-1.glb', label: 'Boulder A', targetLengthMeters: 2.4, yawOffset: 0, placeholder: 'worker', credit: SK('Rock boulder (game ready asset)', 'Aparicio Silva 3D (@apariciosilva3D)', '0079cb0e717c4aeebe6bca21ec21b0d9') },
  'rock-boulder-2': { id: 'rock-boulder-2', file: 'rock-boulder-2.glb', label: 'Boulder B', targetLengthMeters: 2.2, yawOffset: 0, placeholder: 'worker', credit: SK('Rock Boulder 2 (game ready asset)', 'Aparicio Silva 3D (@apariciosilva3D)', '70fd18ec2a4a4d378d9d8c1ba878dcbc') },
  'batching-plant': { id: 'batching-plant', file: 'batching-plant.glb', label: 'Concrete batching plant', targetLengthMeters: 26, yawOffset: 0, placeholder: 'mixer', credit: { title: 'Mobile concrete batching plant', author: 'Generated: GPT Image 2 + Meshy 7.1 (Image-to-3D)', licence: CC, note: 'Geometry decimated to 60k triangles; colours painted in-app' } },
  'bulk-carrier': { id: 'bulk-carrier', file: 'bulk-carrier.glb', label: 'Bulk carrier', targetLengthMeters: 190, yawOffset: 0, placeholder: 'mixer', credit: SK('Alassia M/V Cymona Eagle (2024)', 'FHA_studios (@FHA_ships)', 'ed358cd364ea4b5380d00b6957d12718') },
  'tanker-ship': { id: 'tanker-ship', file: 'tanker-ship.glb', label: 'Tanker', targetLengthMeters: 180, yawOffset: 0, placeholder: 'mixer', credit: SK('Tanker Ship', 'Art Blender (@ArtBlender)', '96ebf61af42b4062ae98a6ad848e1a25') },
  'coastal-cargo-ship': { id: 'coastal-cargo-ship', file: 'coastal-cargo-ship.glb', label: 'Coastal cargo ship', targetLengthMeters: 90, yawOffset: 0, placeholder: 'mixer', credit: SK('Small Cargo Ship', 'Styx (@588276)', '6362d3e9b11e4396aaafa854c3aa6f06') },
  'workboat': { id: 'workboat', file: 'workboat.glb', label: 'Work / pilot boat', targetLengthMeters: 16, yawOffset: 0, placeholder: 'mixer', credit: SK('Speedboat (cabin work/pilot boat)', 'ПГГПУ (@vrpspu)', '9916bd4433024202ab84e43426fc2139') },
  'bulldozer': { id: 'bulldozer', file: 'bulldozer.glb', label: 'Bulldozer', targetLengthMeters: 7.5, yawOffset: 0, placeholder: 'mixer', credit: SK('Bulldozer', 'semyon.kan (@semyon.kan)', 'b06a715d23a7450babac383b8bb7fb0a') },
  'wheel-loader': { id: 'wheel-loader', file: 'wheel-loader.glb', label: 'Wheel loader', targetLengthMeters: 9, yawOffset: 0, placeholder: 'mixer', credit: SK('Bulldozer (actually a wheel loader)', 'RobbyHollister (@RobbyHollister)', '2137d93b5a804161bc65b44d583aa68e') },
  'road-roller': { id: 'road-roller', file: 'road-roller.glb', label: 'Road roller', targetLengthMeters: 6, yawOffset: 0, placeholder: 'mixer', credit: SK('Road Roller', 'Lassi Kaukonen (@thesidekick)', '02c2ffa7c88f40fca1718e568adebda6') },
  'forklift': { id: 'forklift', file: 'forklift.glb', label: 'Forklift', targetLengthMeters: 4.8, yawOffset: 0, placeholder: 'mixer', credit: SK('Forklift Truck', 'kray3d (@kray3d)', '1567f5f71c1a40eebe487b1b8f570250') },
  'pickup-truck': { id: 'pickup-truck', file: 'pickup-truck.glb', label: 'Pickup truck', targetLengthMeters: 5.4, yawOffset: 0, placeholder: 'mixer', credit: SK('Pickup Truck (Commercial Vehicle)', 'Fasih.Ahmed (@Fasih.Ahmed)', 'dafd6d37e8ea49599ae0f58ced214326') },
  'semi-truck-trailer': { id: 'semi-truck-trailer', file: 'semi-truck-trailer.glb', label: 'Prime mover + trailer', targetLengthMeters: 16.5, yawOffset: 0, placeholder: 'mixer', credit: SK('Yellow semi-truck with trailer', 'Chenzoss (@Chenzoss)', 'ee0a8763bd8941f1bc546b43332d4001') },
  'rtg-gantry-crane': { id: 'rtg-gantry-crane', file: 'rtg-gantry-crane.glb', label: 'RTG yard crane', targetLengthMeters: 24, yawOffset: 0, placeholder: 'mixer', credit: SK('Gantry crane', 'Randonavt (@Randonavt)', 'de8c4164d41742b395f78c20231d18b8') },
  'storage-tank': { id: 'storage-tank', file: 'storage-tank.glb', label: 'Storage tank', targetLengthMeters: 18, yawOffset: 0, placeholder: 'mixer', credit: SK('Old oil tank', 'Mouad Hsaine (@ittoKubashi7)', 'd8e9ced5cc11428280ffad57f96d8686') },
  'lighthouse-redwhite': { id: 'lighthouse-redwhite', file: 'lighthouse-redwhite.glb', label: 'Lighthouse', targetLengthMeters: 9, yawOffset: 0, placeholder: 'mixer', credit: SK('Lowpoly lighthouse', 'lavakongen (@lavakongen)', 'a13aa472c9e649a8a5313727220d16c6') },
  'light-mast': { id: 'light-mast', file: 'light-mast.glb', label: 'Light mast', targetLengthMeters: 2.4, yawOffset: 0, placeholder: 'mixer', credit: SK('Lighting Mast (Single Model From Asset Pack)', 'Cherk (@alex20010804)', '0594bfb94a2c43ecbef30fe28a3831b8') },
  'flood-light-tripod': { id: 'flood-light-tripod', file: 'flood-light-tripod.glb', label: 'Work light', targetLengthMeters: 1.2, yawOffset: 0, placeholder: 'mixer', credit: SK('Flood light 02', 'Chamod1999 (@Chamodp)', '95ad365a60434015a8700efbdaa90893') },
  'portacabin': { id: 'portacabin', file: 'portacabin.glb', label: 'Site cabin', targetLengthMeters: 8, yawOffset: 0, placeholder: 'mixer', credit: SK('Portacabin', 'NG (@XRTL)', '8d3bac9c63cf471caeddbf124b7337ef') },
  'site-office-unit': { id: 'site-office-unit', file: 'site-office-unit.glb', label: 'Site office unit', targetLengthMeters: 8.5, yawOffset: 0, placeholder: 'mixer', credit: SK('Single office End door unit', 'marc.digiaimo (@marc.digiaimo)', '7c7191524f8549239ecab26c8ed37339') },
  'shipping-container-40ft': { id: 'shipping-container-40ft', file: 'shipping-container-40ft.glb', label: '40 ft container', targetLengthMeters: 12.2, yawOffset: 0, placeholder: 'mixer', credit: SK('Shipping Container', 'RMaull2002 (@RMaull2002)', '7671b3e8ec374e2db75823f35384c275') },
  'warehouse-gable': { id: 'warehouse-gable', file: 'warehouse-gable.glb', label: 'Warehouse', targetLengthMeters: 60, yawOffset: 0, placeholder: 'mixer', credit: SK('Industrial Warehouse', 'VertexForge (@prankscare99)', 'e6049139a2dd412a88d127541808e1e2') },
  'concrete-barriers': { id: 'concrete-barriers', file: 'concrete-barriers.glb', label: 'Concrete barriers', targetLengthMeters: 12, yawOffset: 0, placeholder: 'mixer', credit: SK('Concrete Barriers', 'Tsawodi (@Tsawodi)', '68bf7a93925a4a0482fce195f5a770b9') },
};

export const MODEL_IDS = Object.keys(MODELS) as ModelId[];

export function modelUrl(id: ModelId): string | null {
  const f = MODELS[id].file;
  const key = Object.keys(glbUrls).find((k) => k.endsWith('/' + f));
  return key ? glbUrls[key] : null;
}
export function hasModel(id: ModelId): boolean {
  return modelUrl(id) !== null;
}

// -------------------------------------------------------------------------------- loading
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const cache = new Map<ModelId, Promise<Object3D>>();
const status = new Map<ModelId, 'glb' | 'placeholder' | 'failed'>();

/** orient + scale + re-pivot a raw scene: length axis -> +X, bottom-centre pivot, scaled to targetLengthMeters */
function normalise(raw: Object3D, spec: ModelSpec): Group {
  const inner = new Group();
  inner.add(raw);
  inner.updateMatrixWorld(true);
  let box = new Box3().setFromObject(inner);
  const size = box.getSize(new Vector3());
  // longest horizontal axis -> X
  if (size.z > size.x) inner.rotation.y = Math.PI / 2;
  inner.updateMatrixWorld(true);
  box = new Box3().setFromObject(inner);
  const sz = box.getSize(new Vector3());
  const c = box.getCenter(new Vector3());
  const s = spec.targetLengthMeters / Math.max(1e-6, sz.x);
  const pivot = new Group();
  pivot.add(inner);
  inner.position.set(-c.x, -box.min.y, -c.z);
  // rotation applied above is about the origin; re-centre after it
  pivot.scale.setScalar(s);
  pivot.updateMatrixWorld(true);
  const outer = new Group();
  outer.add(pivot);
  outer.rotation.y = spec.yawOffset;
  outer.name = spec.id;
  if (spec.tint) {
    const tint = new Color(spec.tint);
    outer.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const tintOne = (mm: MeshStandardMaterial) => {
        const c2 = mm.clone();
        if (c2.color) c2.color.multiply(tint);
        return c2;
      };
      m.material = Array.isArray(m.material) ? m.material.map((x) => tintOne(x as MeshStandardMaterial)) : tintOne(m.material as MeshStandardMaterial);
    });
  }
  outer.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return outer;
}

function load(id: ModelId): Promise<Object3D> {
  let p = cache.get(id);
  if (p) return p;
  const spec = MODELS[id];
  const url = modelUrl(id);
  if (!url) {
    status.set(id, 'placeholder');
    p = Promise.resolve(makePlaceholder(spec.placeholder, spec.targetLengthMeters));
  } else {
    p = loader
      .loadAsync(url)
      .then((g) => {
        status.set(id, 'glb');
        return normalise(g.scene, spec);
      })
      .catch((e) => {
        console.warn(`[assets] ${spec.file} failed to load, using placeholder`, e);
        status.set(id, 'failed');
        return makePlaceholder(spec.placeholder, spec.targetLengthMeters);
      });
  }
  cache.set(id, p);
  return p;
}

/** a fresh, independent clone (shared geometry + textures) of the normalised model */
export async function getModel(id: ModelId): Promise<Object3D> {
  const base = await load(id);
  const c = cloneSkinned(base);
  c.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return c;
}

export function modelStatus(id: ModelId) {
  return status.get(id) ?? (hasModel(id) ? 'pending' : 'placeholder');
}

export function preloadModels(ids: ModelId[]) {
  return Promise.all(ids.map((i) => load(i)));
}

// -------------------------------------------------------------------------------- credits
export function allCredits(): Array<{ file: string; label: string; credit: Credit; present: boolean }> {
  return MODEL_IDS.map((id) => ({ file: MODELS[id].file, label: MODELS[id].label, credit: MODELS[id].credit, present: hasModel(id) }));
}
