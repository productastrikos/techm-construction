// SimCore: the simulator process. Holds the pack, re-plans at any demo-clock day (progress advances with the clock),
// runs scenarios, and serves telemetry. Lives in a Web Worker in the app; the same class runs inline in tests / fallback.
import { channelValue, healthReport, series, type HealthReport, type Sample } from '../engine/assets';
import { dayBreakdown } from '../engine/calendar';
import { assetOptions, calendarRecovery, evaluate, supplyRecovery, type Delta, type RecoveryOption, type ScenarioResult } from '../engine/scenario';
import { buildPlan, type Plan } from '../engine/plan';
import { withLayers } from '../engine/calendar';
import type { CalendarLayers, Id, ProjectPack } from '../engine/types';
import { assetWorkCtx, buildSnapshot } from './snapshot';
import type { DataSource, RecoveryKind, Snapshot } from './types';
import { buildPortPack } from '../packs/port';
import { buildHighwayPack } from '../packs/highway';

export function loadPack(id: string): ProjectPack {
  return id === 'highway' ? buildHighwayPack() : buildPortPack();
}

export class SimCore implements DataSource {
  private pack!: ProjectPack;
  private plans = new Map<number, Plan>();
  private snaps = new Map<number, Snapshot>();

  constructor(private packId = 'port') {}

  async init(): Promise<void> {
    this.pack = loadPack(this.packId);
    this.plans.clear();
    this.snaps.clear();
  }

  async setPack(id: string) {
    this.packId = id;
    await this.init();
  }

  private dayKey(simT: number): number {
    // the data date is anchored to 08:00 of the demo-clock day; the pack's own data date is preserved when clock == nowT
    return Math.floor(simT);
  }

  private plan(simT: number): Plan {
    const key = this.dayKey(simT);
    let p = this.plans.get(key);
    if (!p) {
      const dd = key === Math.floor(this.pack.config.nowT) ? this.pack.config.nowT : key + 8 / 24;
      p = buildPlan(this.pack, dd);
      this.plans.set(key, p);
      if (this.plans.size > 12) {
        const first = this.plans.keys().next().value as number;
        this.plans.delete(first);
        this.snaps.delete(first);
      }
    }
    return p;
  }

  async getSnapshot(simT: number): Promise<Snapshot> {
    const key = this.dayKey(simT);
    let s = this.snaps.get(key);
    if (!s) {
      s = buildSnapshot(this.plan(simT));
      this.snaps.set(key, s);
    }
    return s;
  }

  async runScenario(simT: number, deltas: Delta[]): Promise<ScenarioResult> {
    return evaluate(this.plan(simT), deltas);
  }

  async recovery(simT: number, kind: RecoveryKind, base: Delta[], window?: { fromT: number; toT: number }): Promise<{ baseResult: ScenarioResult; options: RecoveryOption[] }> {
    const plan = this.plan(simT);
    return kind === 'supply' ? supplyRecovery(plan, base) : calendarRecovery(plan, base, window ?? { fromT: plan.nowT, toT: plan.nowT + 60 });
  }

  async assetOptions(simT: number, assetId: Id, failT: number) {
    const plan = this.plan(simT);
    const r = assetOptions(plan, assetId, failT, plan.nowT);
    return { run: r.run, service: r.service, prepos: r.prepos };
  }

  async telemetry(assetId: Id, channelId: string, fromT: number, toT: number, stepDays: number, simT: number): Promise<Sample[]> {
    const plan = this.plan(simT);
    const asset = this.pack.assets.find((a) => a.id === assetId);
    if (!asset) return [];
    return series(asset, channelId, fromT, toT, stepDays, assetWorkCtx(plan, asset));
  }

  async health(assetId: Id, t: number, simT: number): Promise<HealthReport> {
    const plan = this.plan(simT);
    const asset = this.pack.assets.find((a) => a.id === assetId)!;
    return healthReport(asset, t, assetWorkCtx(plan, asset));
  }

  async productiveHours(profileId: string, layers: Partial<CalendarLayers>, fromT: number, toT: number): Promise<number[]> {
    const prof = this.pack.calendars.find((c) => c.id === profileId) ?? this.pack.calendars[0];
    const rules = withLayers(this.pack.rules, layers);
    const out: number[] = [];
    for (let d = Math.floor(fromT); d <= Math.floor(toT); d++) out.push(dayBreakdown(prof, rules, d).hours);
    return out;
  }

  async reset() {
    this.plans.clear();
    this.snaps.clear();
  }
}

export { channelValue };
