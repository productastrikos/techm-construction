// Highway pack #2: proves "same engine, new project". Re-uses calendars, GCC rules, ports/routes (Chokepoint logic) from the
// port pack; WBS, programme, materials, POs, fleet and 3D scene are all different.
import { buildCalendars } from '../../engine/calendar';
import { runCpm } from '../../engine/cpm';
import { ymdToT } from '../../engine/dates';
import { materialById, transit } from '../../engine/routes';
import type { Activity, ProjectPack, PurchaseOrder } from '../../engine/types';
import { portCalendars, portPorts, portRouteTable, portRoutes, portRules } from '../port/config';
import { buildHighwayActivities } from './activities';
import { buildHighwayAssets, buildHighwayScene, highwayConfig, highwayFleetVis, highwayMaterials, highwayPoSeeds, highwaySuppliers, highwayWbs } from './data';

let cached: ProjectPack | null = null;

export function buildHighwayPack(): ProjectPack {
  if (cached) return cached;
  const activities: Activity[] = buildHighwayActivities(highwayConfig.bacAED);
  const pack: ProjectPack = {
    config: highwayConfig,
    wbs: highwayWbs,
    calendars: portCalendars,
    rules: portRules,
    activities,
    materials: highwayMaterials,
    suppliers: highwaySuppliers,
    pos: [],
    ports: portPorts,
    routes: portRoutes,
    routeTable: portRouteTable,
    assets: [],
    elements: buildHighwayScene(),
    fleetVis: highwayFleetVis,
  };
  const cals = buildCalendars(portCalendars, portRules);
  const free = runCpm({ activities, cals });
  const consumerEs = new Map<string, number>();
  for (const a of activities) {
    for (const p of a.preds) {
      const pred = activities[free.idx.get(p.id)!];
      if (pred.kind !== 'delivery') continue;
      consumerEs.set(pred.id, Math.min(consumerEs.get(pred.id) ?? Infinity, free.es[free.idx.get(a.id)!]));
    }
  }
  const pos: PurchaseOrder[] = highwayPoSeeds.map((s) => {
    const mat = materialById(pack, s.materialId);
    const tr = transit(pack, mat, s.routeId, s.weightT);
    const need = consumerEs.get(s.deliveryActivityId);
    if (need === undefined) throw new Error(`delivery ${s.deliveryActivityId} has no consumer`);
    const orderedT = s.orderedOn ? ymdToT(...s.orderedOn) : undefined;
    const earliest = (orderedT ?? 6) + (orderedT === undefined ? s.prodDays : 8) + s.qaDays + tr.total;
    const etaT = Math.max(need - s.cover, earliest);
    const prodDays = orderedT === undefined ? s.prodDays : Math.max(8, etaT - tr.total - s.qaDays - orderedT);
    return { id: s.id, materialId: s.materialId, supplierId: s.supplierId, qty: s.qty, valueAED: s.valueM * 1e6, weightT: s.weightT, routeId: s.routeId, incoterm: s.incoterm, etaT, prodDays, qaDays: s.qaDays, deliveryActivityId: s.deliveryActivityId, currentSlipDays: s.slip, airEligible: s.airEligible, stockTransferDays: s.stockTransferDays };
  });
  pack.pos = pos;
  const byDel = new Map(pos.map((p) => [p.deliveryActivityId, p]));
  for (const a of activities) {
    if (a.kind === 'delivery') {
      const po = byDel.get(a.id);
      if (!po) throw new Error(`no PO for ${a.id}`);
      a.snet = po.etaT;
      a.poId = po.id;
    }
  }
  const linked: Record<string, string[]> = {};
  for (const a of activities) for (const id of a.assetIds ?? []) (linked[id] ??= []).push(a.id);
  pack.assets = buildHighwayAssets(linked);
  const idx = new Map(pack.elements.map((e) => [e.id, e]));
  for (const a of activities) for (const id of a.elementIds) {
    const e = idx.get(id);
    if (!e) throw new Error(`activity ${a.id} references unknown element ${id}`);
    e.activityIds.push(a.id);
  }
  cached = pack;
  return pack;
}
