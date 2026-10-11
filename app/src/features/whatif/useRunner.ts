import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../app/store';
import { useOverlay } from '../../app/overlay';
import type { Delta, RecoveryOption, ScenarioResult } from '../../engine/scenario';
import { getDs, usePack } from '../../sim/useSim';
import type { RecoveryKind } from '../../sim/types';
import { useScenario } from './scenarioStore';

/** runs the scenario in the simulator worker (latest request wins) and publishes it to the Gantt / 3D overlay */
export function useRunner(deltas: Delta[], label: string, opts: { publish?: boolean } = {}) {
  const simT = useApp((s) => s.simT);
  const pack = usePack();
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const key = useMemo(() => JSON.stringify(deltas) + '|' + Math.floor(simT), [deltas, simT]);
  const publish = opts.publish ?? true;
  useEffect(() => {
    const my = ++seq.current;
    if (deltas.length === 0) {
      setResult(null);
      if (publish) {
        useScenario.getState().clear();
        useOverlay.getState().clear();
      }
      return;
    }
    setLoading(true);
    const h = setTimeout(async () => {
      const r = await getDs().runScenario(simT, deltas);
      if (my !== seq.current) return;
      setResult(r);
      setLoading(false);
      if (publish) {
        useScenario.getState().setActive({ label, deltas, result: r });
        const acts: Record<string, number> = {};
        const els: Record<string, 'watch' | 'late'> = {};
        const idx = new Map(pack.activities.map((a, i) => [a.id, i]));
        for (const c of r.changed) {
          acts[c.id] = c.dEf;
          const a = pack.activities[idx.get(c.id)!];
          for (const e of a.elementIds) {
            if (c.dEf >= 14 || els[e] === 'late') els[e] = 'late';
            else if (c.dEf >= 1 && !els[e]) els[e] = 'watch';
          }
        }
        useOverlay.getState().set(label, els, acts);
      }
    }, 90);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { result, loading };
}

/** recovery options for a base scenario (computed in the worker, cached by key) */
export function useRecovery(kind: RecoveryKind, base: Delta[], window?: { fromT: number; toT: number }, enabled = true) {
  const simT = useApp((s) => s.simT);
  const [state, setState] = useState<{ baseResult: ScenarioResult; options: RecoveryOption[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const key = JSON.stringify(base) + JSON.stringify(window ?? null) + '|' + Math.floor(simT) + kind;
  useEffect(() => {
    const my = ++seq.current;
    if (!enabled || base.length === 0) {
      setState(null);
      return;
    }
    setLoading(true);
    const h = setTimeout(async () => {
      const r = await getDs().recovery(simT, kind, base, window);
      if (my !== seq.current) return;
      setState(r);
      setLoading(false);
    }, 140);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return { ...state, loading };
}
