// Route graph, Chokepoint state, PO timelines (7-stage pipeline), landed cost and lead time.
// Pure TS. A PO's date chain is: order -> production -> QA -> ship (sea) -> port/customs -> bonded truck -> site.
import type { ChokepointState, Id, Material, Port, ProjectPack, PurchaseOrder, RouteDef } from './types';

export interface Transit {
  seaDays: number;
  portDays: number;
  roadDays: number;
  extraDays: number;
  total: number;
  freightAED: number;
  chokepointDependent: boolean;
  route: RouteDef;
  port: Port;
}

export function routeById(pack: ProjectPack, id: Id): RouteDef {
  const r = pack.routes.find((x) => x.id === id);
  if (!r) throw new Error(`unknown route ${id}`);
  return r;
}
export function materialById(pack: ProjectPack, id: Id): Material {
  const m = pack.materials.find((x) => x.id === id);
  if (!m) throw new Error(`unknown material ${id}`);
  return m;
}

/** door-to-door transit for a material shipped on a route */
export function transit(pack: ProjectPack, mat: Material, routeId: Id, weightT: number): Transit {
  const route = routeById(pack, routeId);
  const port = pack.ports.find((p) => p.id === route.portId)!;
  const rt = pack.routeTable;
  let sea = 0;
  let portDays = 0;
  let freight = 0;
  if (route.mode === 'air') {
    sea = rt.airDays;
    portDays = 1;
    freight = rt.airAedPerKg * weightT * 1000;
  } else if (route.mode === 'road') {
    portDays = 0;
    freight = weightT * port.roadAedPerT;
  } else {
    sea = rt.seaDays[mat.origin][port.id] ?? 30;
    portDays = port.handlingDays + port.borderDays;
    freight = weightT * (rt.seaAedPerT[mat.origin] + port.handlingAedPerT + port.roadAedPerT + port.transshipAedPerT);
  }
  return {
    seaDays: sea,
    portDays,
    roadDays: port.roadDays,
    extraDays: route.extraDays,
    total: sea + portDays + port.roadDays + route.extraDays,
    freightAED: freight,
    chokepointDependent: route.chokepointDependent,
    route,
    port,
  };
}

export interface ChokepointScenario {
  state: ChokepointState;
  startT: number;
  durationDays: number;
}

export interface PoTimeline {
  poId: Id;
  routeId: Id;
  orderedT: number;
  /** end of the "Ordered" (design approval / acknowledgement) phase */
  b1: number;
  /** end of production */
  b2: number;
  /** end of QA = ETD */
  etdT: number;
  /** vessel arrives at port */
  b4: number;
  /** leaves port (customs released) */
  b5: number;
  /** on site */
  etaT: number;
  slipDays: number;
  chokepointSlipDays: number;
  freightAED: number;
  transit: Transit;
}

export const STAGES = ['ordered', 'production', 'qa', 'shipped', 'port', 'truck', 'site'] as const;

export interface PoOverride {
  routeId?: Id;
  /** extra delay inserted from `fromT` on (days) */
  slipDays?: number;
  /** replace the ETA outright (substitute / stock transfer) with this on-site date */
  forceEtaT?: number;
  /** extra freight added to the PO (expedite premium) */
  extraCostAED?: number;
}

/** baseline timeline for a PO (no scenario), anchored on its planned ETA */
export function basePoTimeline(pack: ProjectPack, po: PurchaseOrder): PoTimeline {
  const mat = materialById(pack, po.materialId);
  const tr = transit(pack, mat, po.routeId, po.weightT);
  const etaT = po.etaT;
  const b5 = etaT - tr.roadDays - tr.extraDays;
  const b4 = b5 - tr.portDays;
  const etdT = b4 - tr.seaDays;
  const b2 = etdT - po.qaDays;
  const orderedT = b2 - po.prodDays;
  const b1 = orderedT + Math.min(10, po.prodDays * 0.2);
  return { poId: po.id, routeId: po.routeId, orderedT, b1, b2, etdT, b4, b5, etaT, slipDays: 0, chokepointSlipDays: 0, freightAED: tr.freightAED, transit: tr };
}

/**
 * Timeline under a scenario. `nowT` anchors "from now on" delays: every boundary later than now shifts by the slip
 * (the delay is inserted in the stage the PO is in / enters next).
 */
export function poTimeline(pack: ProjectPack, po: PurchaseOrder, nowT: number, hz: ChokepointScenario | null, ov: PoOverride = {}): PoTimeline {
  const base = basePoTimeline(pack, po);
  const mat = materialById(pack, po.materialId);
  let t = { ...base };
  const preSlip = po.currentSlipDays;
  const shiftFrom = (tl: PoTimeline, from: number, days: number): PoTimeline => {
    if (days === 0) return tl;
    const f = (x: number) => (x > from ? x + days : x);
    return { ...tl, b1: f(tl.b1), b2: f(tl.b2), etdT: f(tl.etdT), b4: f(tl.b4), b5: f(tl.b5), etaT: tl.etaT + days, slipDays: tl.slipDays + days };
  };
  // seeded slip already visible at the data date
  // slip already seen at the pack's data date is anchored there (not at the moving demo clock)
  t = shiftFrom(t, pack.config.nowT, preSlip);

  // reroute / expedite: replace the transit chain from the later of (ETD, now)
  if (ov.routeId && ov.routeId !== po.routeId) {
    const tr = transit(pack, mat, ov.routeId, po.weightT);
    const start = Math.max(t.etdT, nowT);
    const divert = t.etdT < nowT ? 3 : 0; // already at sea: diversion penalty
    const b4 = start + divert + tr.seaDays;
    const b5 = b4 + tr.portDays;
    const eta = b5 + tr.roadDays + tr.extraDays;
    t = { ...t, routeId: ov.routeId, b4, b5, etaT: eta, freightAED: tr.freightAED, transit: tr };
  }
  if (ov.forceEtaT !== undefined) {
    t = { ...t, etaT: ov.forceEtaT, b5: ov.forceEtaT - 0.5, b4: ov.forceEtaT - 1, slipDays: ov.forceEtaT - base.etaT };
  }
  if (ov.slipDays) t = shiftFrom(t, nowT, ov.slipDays);

  // Chokepoint: sea/port window overlapping the disruption window adds delay for Chokepoint-dependent routes
  let hzSlip = 0;
  if (hz && hz.state !== 'open' && t.transit.chokepointDependent && ov.forceEtaT === undefined) {
    const seaStart = t.etdT;
    const seaEnd = t.b5;
    const wStart = hz.startT;
    const wEnd = hz.startT + hz.durationDays;
    if (seaEnd >= wStart && seaStart <= wEnd) {
      hzSlip = pack.routeTable.chokepoint[hz.state].extraDays;
      t = shiftFrom(t, Math.max(nowT, seaStart + 1e-6), hzSlip);
    }
  }
  t.chokepointSlipDays = hzSlip;
  return t;
}

export type PoStatus = 'planned' | 'ordered' | 'production' | 'qa' | 'shipped' | 'port' | 'truck' | 'site';

/** pipeline stage at time t: -1 = not yet ordered (planned), 0..6 */
export function stageAt(tl: PoTimeline, t: number): -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  if (t < tl.orderedT) return -1;
  if (t < tl.b1) return 0;
  if (t < tl.b2) return 1;
  if (t < tl.etdT) return 2;
  if (t < tl.b4) return 3;
  if (t < tl.b5) return 4;
  if (t < tl.etaT) return 5;
  return 6;
}

/** landed-cost view of a route for a PO (value + freight + Chokepoint surcharge) */
export function landedCost(pack: ProjectPack, po: PurchaseOrder, routeId: Id, hz: ChokepointScenario | null): { freight: number; surcharge: number; total: number } {
  const mat = materialById(pack, po.materialId);
  const tr = transit(pack, mat, routeId, po.weightT);
  const pct = hz && tr.chokepointDependent ? pack.routeTable.chokepoint[hz.state].costPct : 0;
  const surcharge = po.valueAED * mat.exposure * pct;
  return { freight: tr.freightAED, surcharge, total: po.valueAED + tr.freightAED + surcharge };
}

/** candidate routes for a PO, with lead time / cost / risk under the given Chokepoint state */
export function routeOptions(pack: ProjectPack, po: PurchaseOrder, nowT: number, hz: ChokepointScenario | null) {
  const mat = materialById(pack, po.materialId);
  const base = poTimeline(pack, po, nowT, hz);
  return pack.routes
    .filter((r) => (mat.origin === 'AE' ? r.mode === 'road' : r.mode !== 'road'))
    .filter((r) => r.mode !== 'air' || po.airEligible)
    .map((r) => {
      const tl = poTimeline(pack, po, nowT, hz, { routeId: r.id });
      const lc = landedCost(pack, po, r.id, hz);
      const blocked = !!hz && hz.state === 'closed' && r.chokepointDependent;
      return {
        route: r,
        etaT: tl.etaT,
        transitDays: tl.transit.total,
        costAED: lc.total,
        deltaDays: tl.etaT - base.etaT,
        deltaCostAED: lc.total - landedCost(pack, po, po.routeId, hz).total,
        risk: r.chokepointDependent ? (hz?.state === 'closed' ? 'high' : hz?.state === 'restricted' ? 'medium' : 'low') : 'low',
        blocked,
        chokepointSlip: tl.chokepointSlipDays,
      };
    });
}
