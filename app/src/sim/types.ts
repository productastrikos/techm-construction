import type { CpmResult } from '../engine/cpm';
import type { EvmSnapshot, SCurve, CashMonth } from '../engine/evm';
import type { HealthReport, Sample } from '../engine/assets';
import type { Delta, RecoveryOption, ScenarioResult } from '../engine/scenario';
import type { Bi } from '../lib/bi';
import type { Id } from '../engine/types';

export type RiskLevel = 'ok' | 'watch' | 'risk' | 'late';

export interface PoRow {
  id: Id;
  materialId: Id;
  supplierId: Id;
  routeId: Id;
  /** -1 planned (not yet ordered) .. 6 on site */
  stage: number;
  orderedT: number;
  etdT: number;
  etaT: number;
  needBy: number;
  /** days between arrival and need-by (negative = drives the schedule) */
  floatDays: number;
  slipDays: number;
  risk: RiskLevel;
  chokepointExposed: boolean;
  valueAED: number;
  deliveryActivityId: Id;
}

export interface AssetRow {
  id: Id;
  report: HealthReport;
  /** 0..1 */
  working: number;
  utilisation: number;
  availability: number;
  mtbfHrs: number;
  mttrHrs: number;
}

export interface Alarm {
  id: string;
  t: number;
  severity: 'info' | 'warn' | 'crit';
  source: 'asset' | 'po' | 'schedule' | 'hse' | 'weather';
  ref: Id;
  text: Bi;
}

export interface Briefing {
  headline: Bi;
  bullets: Array<{ tone: 'good' | 'warn' | 'bad' | 'info'; text: Bi; ref?: { type: 'po' | 'asset' | 'activity'; id: Id } }>;
}

export interface Snapshot {
  nowT: number;
  baselineFinish: number;
  forecastFinish: number;
  contractFinish: number;
  dFinishVsBaseline: number;
  baseline: CpmResult;
  forecast: CpmResult;
  /** percent complete per activity at the data date (0..1) */
  pct: Float32Array;
  criticalPath: Id[];
  pos: PoRow[];
  assets: AssetRow[];
  evm: EvmSnapshot;
  evmWbs: Array<{ wbsId: Id; bac: number; pv: number; ev: number; ac: number; cpi: number; spi: number }>;
  sCurve: SCurve;
  cashflow: CashMonth[];
  alarms: Alarm[];
  briefing: Briefing;
  kpis: {
    spi: number;
    cpi: number;
    ltifr: number;
    daysSinceLti: number;
    manpower: number;
    openRisks: number;
    fleetAvailability: number;
    materialAtRiskAED: number;
    poAtRisk: number;
    poTotal: number;
  };
}

export type RecoveryKind = 'supply' | 'calendar';

export interface DataSource {
  init(): Promise<void>;
  /** progress / forecast as of a demo-clock time */
  getSnapshot(simT: number): Promise<Snapshot>;
  runScenario(simT: number, deltas: Delta[]): Promise<ScenarioResult>;
  recovery(simT: number, kind: RecoveryKind, base: Delta[], window?: { fromT: number; toT: number }): Promise<{ baseResult: ScenarioResult; options: RecoveryOption[] }>;
  assetOptions(simT: number, assetId: Id, failT: number): Promise<{
    run: ScenarioResult;
    service: { startT: number; res: ScenarioResult };
    prepos: ScenarioResult;
  }>;
  telemetry(assetId: Id, channelId: string, fromT: number, toT: number, stepDays: number, simT: number): Promise<Sample[]>;
  health(assetId: Id, t: number, simT: number): Promise<HealthReport>;
  /** productive hours per day for the calendar heatmap */
  productiveHours(profileId: string, layers: Partial<import('../engine/types').CalendarLayers>, fromT: number, toT: number): Promise<number[]>;
  reset(): Promise<void>;
}
