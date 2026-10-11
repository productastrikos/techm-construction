import type { CalMap } from '../engine/calendar';
import type { CpmResult } from '../engine/cpm';
import { progressAt } from '../engine/plan';
import { allElementStates, type ElementState } from '../engine/twin';
import type { Id, ProjectPack } from '../engine/types';

export interface SceneModel {
  t: number;
  pack: ProjectPack;
  fc: CpmResult;
  base: CpmResult;
  cals: CalMap;
  states: Map<Id, ElementState>;
  /** forecast progress per activity index at t */
  act: Float32Array;
  actIdx: Map<Id, number>;
}

export function buildSceneModel(pack: ProjectPack, fc: CpmResult, base: CpmResult, cals: CalMap, t: number): SceneModel {
  const act = new Float32Array(pack.activities.length);
  const actIdx = new Map<Id, number>();
  pack.activities.forEach((a, i) => {
    actIdx.set(a.id, i);
    act[i] = progressAt(fc, cals, pack, i, t);
  });
  return { t, pack, fc, base, cals, states: allElementStates(pack, fc, base, cals, t), act, actIdx };
}

export const prog = (m: SceneModel, id: Id): number => {
  const i = m.actIdx.get(id);
  return i === undefined ? 0 : m.act[i];
};
