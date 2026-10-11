// Domain model shared by every engine, the simulator and the UI. Pure data - no React, no DOM.
// Time axis: `t` = float days since PROJECT_START (see dates.ts). Durations are working hours of the activity's calendar.
import type { Bi } from '../lib/bi';

export type Id = string;
export type RelType = 'FS' | 'SS' | 'FF' | 'SF';
export type CalId = 'site' | 'marine' | 'crane' | 'indoor' | 'continuous';

export interface Pred {
  id: Id;
  type: RelType;
  lagHrs: number;
  /** alternative logic that a "resequence" mitigation may switch to (e.g. FS -> SS + lag) */
  resequence?: { type: RelType; lagHrs: number; label: Bi };
}

export type ActivityKind = 'task' | 'milestone' | 'delivery';

export interface Activity {
  id: Id;
  wbsId: Id;
  name: Bi;
  kind: ActivityKind;
  durationHrs: number;
  calendarId: CalId;
  preds: Pred[];
  /** budget at completion, AED (illustrative) */
  budget: number;
  elementIds: Id[];
  assetIds?: Id[];
  poId?: Id; // delivery milestones: PO whose ETA drives the earliest start
  crew?: number;
  /** start-no-earlier-than (t) */
  snet?: number;
}

export interface WbsNode {
  id: Id;
  name: Bi;
  parent?: Id;
  color: string;
}

export interface CalendarProfile {
  id: CalId;
  name: Bi;
  baseHours: number;
  /** index = weekday (0 Sun .. 6 Sat) */
  workDays: boolean[];
  outdoor: boolean;
  sea: boolean;
  wind: boolean;
  ramadan: boolean;
  /** exempt from the midday ban (continuous / critical work) */
  middayExempt: boolean;
}

export interface HolidayDef {
  id: Id;
  name: Bi;
  startT: number; // inclusive integer day
  endT: number; // inclusive integer day
  kind: 'public' | 'eid' | 'national';
  /** Islamic dates are "expected" +/- 1 day (moon sighting) */
  uncertaintyDays: number;
}

export interface CalendarLayers {
  holidays: boolean;
  ramadan: boolean;
  midday: boolean;
  weather: boolean;
  heat: boolean;
  eidLeave: boolean;
}

export interface ShiftPlan {
  id: Id;
  label: Bi;
  calendars: CalId[];
  extraHrs: number;
  fromT: number;
  toT: number;
  /** cost per extra working hour (crew premium), AED, summed for the whole project crew for those calendars */
  costPerHr: number;
}

export interface CalendarRules {
  holidays: HolidayDef[];
  ramadan: Array<{ startT: number; endT: number; cutHrs: number }>;
  eidLeave: Array<{ startT: number; endT: number; loss: number }>;
  middayBan: { m1: number; d1: number; m2: number; d2: number; cutHrs: number };
  weather: { sea: number[]; wind: number[] };
  heat: number[];
  layers: CalendarLayers;
  shifts: ShiftPlan[];
}

// ---------------------------------------------------------------- materials / procurement
export type MaterialClass = 'domestic-bulk' | 'imported-long-lead' | 'imported-standard';
export type Origin = 'CN' | 'IN' | 'TR' | 'EU' | 'AE';

export interface Material {
  id: Id;
  name: Bi;
  cls: MaterialClass;
  unit: string;
  origin: Origin;
  /** 0..1 how exposed to Chokepoint / import disruption */
  exposure: number;
  leadTimeDays: number;
  /** domestic substitute possible? */
  domestic?: { leadDays: number; costFactor: number; note: Bi };
}

export interface Supplier {
  id: Id;
  name: string;
  country: string;
  onTime: number; // 0..1
  quality: number; // 0..1
  priceVar: number; // fraction vs. budget
}

export type PoStage = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Ordered, In production, QA, Shipped, At port, Bonded truck, On site

export interface PurchaseOrder {
  id: Id;
  materialId: Id;
  supplierId: Id;
  qty: number;
  valueAED: number;
  weightT: number;
  routeId: Id;
  incoterm: string;
  /** baseline ETA on site (t) */
  etaT: number;
  /** order release date offset: prod+QA days before ETD */
  prodDays: number;
  qaDays: number;
  /** delivery milestone in the schedule */
  deliveryActivityId: Id;
  /** existing slip already visible at the data date (days) */
  currentSlipDays: number;
  /** can this PO be air-freighted (small / high value)? */
  airEligible: boolean;
  /** stock transfer possible from another project/warehouse */
  stockTransferDays?: number;
}

export type PortId = 'PTA' | 'PTB' | 'PTC' | 'PTD' | 'PTE' | 'LOC';

export interface Port {
  id: PortId;
  name: Bi;
  lat: number;
  lon: number;
  insideChokepoint: boolean;
  handlingDays: number;
  handlingAedPerT: number;
  roadDays: number;
  roadAedPerT: number;
  borderDays: number;
  /** feeder / transhipment premium for ports without direct liner service (AED per tonne) */
  transshipAedPerT: number;
}

export interface RouteDef {
  id: Id;
  name: Bi;
  portId: PortId;
  mode: 'sea' | 'air' | 'road';
  chokepointDependent: boolean;
  /** extra paperwork/bonded handling days on this routing */
  extraDays: number;
}

export interface RouteTable {
  /** sea transit days origin->port */
  seaDays: Record<Origin, Partial<Record<PortId, number>>>;
  /** sea freight AED per tonne origin->port */
  seaAedPerT: Record<Origin, number>;
  airDays: number;
  airAedPerKg: number;
  chokepoint: {
    open: { extraDays: number; costPct: number };
    restricted: { extraDays: number; costPct: number };
    closed: { extraDays: number; costPct: number };
  };
}

export type ChokepointState = 'open' | 'restricted' | 'closed';

// ---------------------------------------------------------------- assets
export type AssetType =
  | 'crawler-crane'
  | 'mobile-harbour-crane'
  | 'tower-crane'
  | 'excavator'
  | 'dump-truck'
  | 'dredger'
  | 'piling-rig'
  | 'batching-plant'
  | 'concrete-mixer'
  | 'tug'
  | 'barge'
  | 'generator';

export interface ChannelDef {
  id: string;
  name: Bi;
  unit: string;
  base: number;
  /** alarm threshold (high) */
  alarm: number;
  warn: number;
  /** relative weight for health score */
  weight: number;
  /** diurnal swing amplitude */
  diurnal: number;
  noise: number;
  /** load coupling: added when the asset is working */
  load: number;
}

export interface FaultSeed {
  channelId: string;
  /** component explanation, bilingual */
  component: Bi;
  onsetT: number;
  /** time channel reaches alarm threshold if unserviced */
  alarmT: number;
  /** end-of-life/failure time */
  failT: number;
  /** secondary channels that move with the fault: fraction of (alarm - base) reached at failure */
  coupled?: Record<string, number>;
}

export interface Asset {
  id: Id;
  type: AssetType;
  name: Bi;
  model: string;
  hours: number;
  location: Bi;
  channels: ChannelDef[];
  fault?: FaultSeed;
  linkedActivityIds: Id[];
  pm: { intervalHrs: number; lastDoneHrs: number };
  certExpiryT?: number;
  /** replacement rental cost, AED/day */
  rentalPerDay: number;
  /** mobilisation lead time for a replacement, days */
  mobDays: number;
  /** typical repair duration if it fails in service */
  repairDays: number;
  /** planned service duration, days */
  serviceDays: number;
  fuelLph?: number;
}

// ---------------------------------------------------------------- 3D scene elements
export type ElementKind =
  | 'seabed'
  | 'reclamation'
  | 'quay'
  | 'revetment'
  | 'breakwater'
  | 'apron'
  | 'yard'
  | 'road'
  | 'building'
  | 'mast'
  | 'rail'
  | 'fender'
  | 'sts'
  | 'utility'
  | 'embankment'
  | 'bridge'
  | 'pier'
  | 'culvert';

export interface SceneElement {
  id: Id;
  name: Bi;
  kind: ElementKind;
  /** centre, metres (x east, z south; sea is -z) */
  pos: [number, number, number];
  /** size w,h,d in metres */
  size: [number, number, number];
  rotY?: number;
  /** which axis progress reveals along: 'y' grows up, 'x'/'z' wipes */
  grow: 'y' | 'x' | 'z' | 'fade';
  color: string;
  /** activity ids contributing to progress (filled by pack builder) */
  activityIds: Id[];
  /** repeated sub-items drawn along the element (fenders, masts, rails) */
  count?: number;
}

// ---------------------------------------------------------------- fleet visualisation (3D)
export type MotionSpec =
  | { kind: 'static'; pos: [number, number, number]; yaw: number; swing?: number; swingPeriod?: number }
  | { kind: 'loop'; pts: Array<[number, number]>; y: number; speed: number; phase: number }
  | { kind: 'line'; a: [number, number]; b: [number, number]; y: number; speed: number; phase: number };

export interface FleetVis {
  /** manifest model id, or a procedural prop */
  model: string;
  motion: MotionSpec;
  scale?: number;
  /** only draw once this scene element is at least `needsMin` built (equipment cannot float over unbuilt land) */
  needs?: Id;
  needsMin?: number;
}

// ---------------------------------------------------------------- the pack
export interface KpiSeed {
  ltifr: number;
  daysSinceLti: number;
  manpower: number;
  manhoursMonth: number;
  openRisks: number;
}

export interface PackConfig {
  id: string;
  name: Bi;
  subtitle: Bi;
  code: string;
  location: { lat: number; lon: number; label: Bi };
  startT: number; // 0
  baselineFinishT: number; // informational
  nowT: number;
  bacAED: number;
  contingencyPct: number;
  retentionPct: number;
  advancePct: number;
  ldPerDay: number;
  ldCapPct: number;
  prolongationPerDay: number;
  /** illustrative: CPI per WBS used to synthesise actual cost */
  cpiByWbs: Record<Id, number>;
  kpiSeed: KpiSeed;
  vocab: { site: Bi; asset: Bi; milestone: Bi };
  /** which 3D environment to render */
  sceneKind?: 'port' | 'highway';
}

export interface ProjectPack {
  config: PackConfig;
  wbs: WbsNode[];
  calendars: CalendarProfile[];
  rules: CalendarRules;
  activities: Activity[];
  materials: Material[];
  suppliers: Supplier[];
  pos: PurchaseOrder[];
  ports: Port[];
  routes: RouteDef[];
  routeTable: RouteTable;
  assets: Asset[];
  elements: SceneElement[];
  fleetVis: Record<Id, FleetVis>;
}
