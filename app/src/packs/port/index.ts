// Assembles the Port project pack: activities + materials + POs (ETAs derived from need-by minus cover) + fleet + 3D scene.
import { buildCalendars } from '../../engine/calendar';
import { runCpm } from '../../engine/cpm';
import { transit, materialById } from '../../engine/routes';
import { ymdToT } from '../../engine/dates';
import type { Activity, ProjectPack, PurchaseOrder } from '../../engine/types';
import { buildPortActivities } from './activities';
import { buildPortAssets } from './assets';
import { portCalendars, portConfig, portPorts, portRouteTable, portRoutes, portRules, portSuppliers, portWbs } from './config';
import { portMaterials, portPoSeeds } from './materials';
import { buildPortScene } from './scene';
import { portFleetVis } from './fleetVis';

let cached: ProjectPack | null = null;

export function buildPortPack(): ProjectPack {
  if (cached) return cached;
  const activities: Activity[] = buildPortActivities(portConfig.bacAED);

  const partial: ProjectPack = {
    config: portConfig,
    wbs: portWbs,
    calendars: portCalendars,
    rules: portRules,
    activities,
    materials: portMaterials,
    suppliers: portSuppliers,
    pos: [] as PurchaseOrder[],
    ports: portPorts,
    routes: portRoutes,
    routeTable: portRouteTable,
    assets: [],
    elements: buildPortScene(),
    fleetVis: portFleetVis,
  };

  // 1) schedule without delivery constraints -> earliest start of every consumer of a delivery milestone
  const cals = buildCalendars(portCalendars, portRules);
  const free = runCpm({ activities, cals });
  const consumerEs = new Map<string, number>();
  for (const a of activities) {
    for (const p of a.preds) {
      const pred = activities[free.idx.get(p.id)!];
      if (pred.kind !== 'delivery') continue;
      const es = free.es[free.idx.get(a.id)!];
      consumerEs.set(pred.id, Math.min(consumerEs.get(pred.id) ?? Infinity, es));
    }
  }

  // 2) POs: ETA = consumer ES - cover (clamped so the order can still be placed after NTP)
  const pos: PurchaseOrder[] = portPoSeeds.map((s) => {
    const mat = materialById(partial, s.materialId);
    const tr = transit(partial, mat, s.routeId, s.weightT);
    const need = consumerEs.get(s.deliveryActivityId);
    if (need === undefined) throw new Error(`delivery ${s.deliveryActivityId} has no consumer`);
    const orderedT = s.orderedOn ? ymdToT(...s.orderedOn) : undefined;
    // an explicit order date stretches production from the order date to the planned ship date (design approval, slot, build)
    const earliest = (orderedT ?? 6) + (orderedT === undefined ? s.prodDays : 8) + s.qaDays + tr.total;
    const etaT = Math.max(need - s.cover, earliest);
    const prodDays = orderedT === undefined ? s.prodDays : Math.max(8, etaT - tr.total - s.qaDays - orderedT);
    return {
      id: s.id,
      materialId: s.materialId,
      supplierId: s.supplierId,
      qty: s.qty,
      valueAED: s.valueM * 1_000_000,
      weightT: s.weightT,
      routeId: s.routeId,
      incoterm: s.incoterm,
      etaT,
      prodDays,
      qaDays: s.qaDays,
      deliveryActivityId: s.deliveryActivityId,
      currentSlipDays: s.slip,
      airEligible: s.airEligible,
      stockTransferDays: s.stockTransferDays,
    };
  });
  partial.pos = pos;
  const byDel = new Map(pos.map((p) => [p.deliveryActivityId, p]));
  for (const a of activities) {
    if (a.kind === 'delivery') {
      const po = byDel.get(a.id);
      if (!po) throw new Error(`no PO for ${a.id}`);
      a.snet = po.etaT;
      a.poId = po.id;
    }
  }

  // 3) fleet linked to activities
  const linked: Record<string, string[]> = {};
  for (const a of activities) for (const id of a.assetIds ?? []) (linked[id] ??= []).push(a.id);
  partial.assets = buildPortAssets(linked);

  // 4) scene elements <- activities
  const elIdx = new Map(partial.elements.map((e) => [e.id, e]));
  for (const a of activities) {
    for (const id of a.elementIds) {
      const e = elIdx.get(id);
      if (!e) throw new Error(`activity ${a.id} references unknown element ${id}`);
      e.activityIds.push(a.id);
    }
  }
  cached = partial;
  return partial;
}
