import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildPortPack } from '../src/packs/port';
import { buildPlan } from '../src/engine/plan';
import { allElementStates, assetActive, assetOnSite } from '../src/engine/twin';
import { poseAt } from '../src/three/motion';
import { enAll, arAll } from '../src/i18n/dict';
import { MODEL_IDS, MODELS } from '../src/three/assetManifest';

const pack = buildPortPack();
const plan = buildPlan(pack);

describe('4D twin logic', () => {
  it('element progress is monotonic in time and bounded 0..1', () => {
    const ids = pack.elements.map((e) => e.id);
    let prev = new Map<string, number>(ids.map((i) => [i, 0]));
    for (let t = 0; t <= plan.forecast.finish + 10; t += 20) {
      const st = allElementStates(pack, plan.forecast, plan.baseline, plan.baseCals, t);
      for (const id of ids) {
        const s = st.get(id)!;
        expect(s.pf).toBeGreaterThanOrEqual(0);
        expect(s.pf).toBeLessThanOrEqual(1.0001);
        expect(s.pf).toBeGreaterThanOrEqual(prev.get(id)! - 1e-6);
      }
      prev = new Map(ids.map((i) => [i, st.get(i)!.pf]));
    }
  });
  it('4D reveals match schedule dates: a caisson is fully built only after its last linked activity finishes', () => {
    const el = pack.elements.find((e) => e.id === 'QW-03')!;
    const ends = el.activityIds.map((id) => plan.forecast.ef[plan.forecast.idx.get(id)!]);
    const end = Math.max(...ends);
    const before = allElementStates(pack, plan.forecast, plan.baseline, plan.baseCals, end - 3).get('QW-03')!;
    const after = allElementStates(pack, plan.forecast, plan.baseline, plan.baseCals, end + 1).get('QW-03')!;
    expect(before.pf).toBeLessThan(1);
    expect(after.pf).toBeGreaterThan(0.999);
  });
  it('everything is built by the forecast finish; nothing is built at project start', () => {
    const s0 = allElementStates(pack, plan.forecast, plan.baseline, plan.baseCals, 0);
    const s1 = allElementStates(pack, plan.forecast, plan.baseline, plan.baseCals, plan.forecast.finish + 1);
    for (const e of pack.elements) {
      expect(s0.get(e.id)!.pf, e.id).toBeLessThan(0.05);
      expect(s1.get(e.id)!.pf, e.id).toBeGreaterThan(0.99);
    }
  });
  it('fleet visualisation covers every asset and the crawler crane is on site at the data date', () => {
    for (const a of pack.assets) expect(pack.fleetVis[a.id], a.id).toBeDefined();
    expect(assetOnSite(pack, plan.forecast, 'CC-02', plan.nowT)).toBe(true);
    expect(assetActive(pack, plan.forecast, 'DRG-01', plan.nowT)).toBe(true);
  });
});

describe('equipment motion', () => {
  it('loop poses stay on the polyline bounds and are deterministic', () => {
    const m = pack.fleetVis['DT-01'].motion;
    for (let s = 0; s < 400; s += 7) {
      const p = poseAt(m, s);
      expect(p.x).toBeGreaterThanOrEqual(-331);
      expect(p.x).toBeLessThanOrEqual(-149);
      expect(p.z).toBeGreaterThanOrEqual(69);
      expect(p.z).toBeLessThanOrEqual(301);
      expect(poseAt(m, s)).toEqual(p);
    }
  });
});

describe('asset manifest', () => {
  it('lists the 12 required models + 2 extras with sane scale', () => {
    for (const id of ['sts-crane', 'crawler-crane', 'container-ship', 'dredger', 'dump-truck', 'excavator', 'tower-crane', 'tug', 'reach-stacker', 'concrete-mixer', 'piling-rig', 'worker']) expect(MODEL_IDS).toContain(id);
    for (const id of MODEL_IDS) {
      expect(MODELS[id].targetLengthMeters).toBeGreaterThan(1);
      expect(MODELS[id].credit.author.length).toBeGreaterThan(2);
    }
  });
  it('every shipped .glb is declared in the manifest (credits cannot be missed)', () => {
    const dir = join(process.cwd(), 'src/assets/models');
    const files = readdirSync(dir).filter((f) => f.endsWith('.glb'));
    const declared = new Set(MODEL_IDS.map((i) => MODELS[i].file));
    for (const f of files) expect(declared.has(f), f).toBe(true);
  });
});

describe('i18n completeness', () => {
  const walk = (d: string, out: string[] = []): string[] => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(f) && !/i18n[\\/]/.test(p)) out.push(p);
    }
    return out;
  };
  it('every literal t("key") used in the source exists in EN and AR', () => {
    const missing: string[] = [];
    for (const f of walk(join(process.cwd(), 'src'))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        if (!(m[1] in enAll) || !(m[1] in arAll)) missing.push(`${f.split('src')[1]}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
  it('dynamic key families used by templates exist', () => {
    const fam: string[] = [];
    for (const k of ['open', 'restricted', 'closed']) fam.push(`wi.hz.${k}`);
    for (const k of ['ramadan', 'eidLeave', 'midday', 'weather', 'heat']) fam.push(`wi.cal.layer.${k}`);
    for (const k of ['none', 'ramadan', 'eid', 'ramEid', 'summer', 'weather', 'heat', 'all']) fam.push(`wi.cal.preset.${k}`);
    for (const k of ['run', 'service', 'prepos', 'manual']) fam.push(`wi.eq.mode.${k}`);
    for (const k of ['realistic', 'progress', 'material', 'health', 'hse']) fam.push(`twin.mode.${k}`);
    for (const k of ['overview', 'quay', 'castingYard', 'yard', 'offshore']) fam.push(`twin.cam.${k}`);
    for (const k of ['open', 'planned', 'inprogress', 'done']) fam.push(`asset.wo.${k}`);
    for (const k of ['cranes', 'earth', 'trucks', 'marine', 'piling', 'plant']) fam.push(`asset.group.${k}`);
    for (const k of fam) {
      expect(k in enAll, k).toBe(true);
      expect(k in arAll, k).toBe(true);
    }
  });
});
