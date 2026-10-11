// Port pack: where each piece of fleet equipment is drawn in the 3D scene and how it moves (visual animation of the
// simulator state: positions are illustrative, motion phase is wall-clock).
import type { FleetVis } from '../../engine/types';

const loop = (pts: Array<[number, number]>, y: number, speed: number, phase: number) => ({ kind: 'loop' as const, pts, y, speed, phase });

export const portFleetVis: Record<string, FleetVis> = {
  'DT-01': { model: 'dump-truck', motion: loop([[-330, 70], [-150, 70], [-150, 300], [-330, 300]], 3.5, 6, 0.0), needs: 'RCL-1', needsMin: 0.9 },
  'DT-02': { model: 'dump-truck', motion: loop([[-330, 70], [-150, 70], [-150, 300], [-330, 300]], 3.5, 6, 0.5), needs: 'RCL-1', needsMin: 0.9 },
  'DT-03': { model: 'dump-truck', motion: loop([[-120, 60], [100, 60], [100, 120], [-120, 120]], 3.5, 5.5, 0.25), needs: 'RCL-3', needsMin: 0.9 },
  'DT-04': { model: 'dump-truck', motion: loop([[-120, 60], [100, 60], [100, 120], [-120, 120]], 3.5, 5.5, 0.75), needs: 'RCL-3', needsMin: 0.9 },
  'DT-05': { model: 'dump-truck', motion: loop([[140, 160], [340, 160], [340, 300], [140, 300]], 3.5, 6, 0.1), needs: 'RCL-5', needsMin: 0.9 },
  'DT-06': { model: 'dump-truck', motion: loop([[140, 160], [340, 160], [340, 300], [140, 300]], 3.5, 6, 0.6), needs: 'RCL-5', needsMin: 0.9 },
  'EX-01': { model: 'excavator', motion: { kind: 'static', pos: [-250, 3.5, 150], yaw: 0.6, swing: 0.7, swingPeriod: 9 }, needs: 'RCL-1', needsMin: 0.9 },
  'EX-02': { model: 'excavator', motion: { kind: 'static', pos: [-392, 5.2, 120], yaw: 1.5, swing: 0.5, swingPeriod: 11 }, needs: 'RV-1', needsMin: 0.6 },
  'EX-03': { model: 'excavator', motion: { kind: 'static', pos: [392, 5.2, 160], yaw: -1.5, swing: 0.5, swingPeriod: 10 }, needs: 'RV-2', needsMin: 0.6 },
  'EX-04': { model: 'excavator', motion: { kind: 'static', pos: [-100, 3.5, 24], yaw: -1.4, swing: 0.6, swingPeriod: 8 }, needs: 'RCL-3', needsMin: 0.9 },
  'CC-01': { model: 'crawler-crane', motion: { kind: 'static', pos: [478, 2.6, 110], yaw: 0.4, swing: 0.5, swingPeriod: 14 } },
  'CC-02': { model: 'crawler-crane', motion: { kind: 'static', pos: [478, 2.6, 225], yaw: -0.6, swing: 0.5, swingPeriod: 12 } },
  'MHC-01': { model: 'harbour-crane', motion: { kind: 'static', pos: [-60, 3.6, 46], yaw: 3.14, swing: 0.4, swingPeriod: 16 }, needs: 'APR-2', needsMin: 0.5 },
  'TC-01': { model: 'tower-crane', motion: { kind: 'static', pos: [-168, 3.5, 392], yaw: 0.3, swing: 1.2, swingPeriod: 40 }, needs: 'RCL-2', needsMin: 0.9 },
  'TC-02': { model: 'tower-crane', motion: { kind: 'static', pos: [-290, 3.5, 396], yaw: 1.0, swing: 1.1, swingPeriod: 36 }, needs: 'RCL-1', needsMin: 0.9 },
  'DRG-01': { model: 'dredger', motion: { kind: 'line', a: [-90, -470], b: [60, -280], y: 0, speed: 1.1, phase: 0 } },
  'PR-01': { model: 'piling-rig', motion: { kind: 'static', pos: [-290, 3.5, 300], yaw: 0.8, swing: 0.15, swingPeriod: 7 }, needs: 'RCL-1', needsMin: 0.9 },
  'PR-02': { model: 'piling-rig', motion: { kind: 'static', pos: [-140, 3.5, 250], yaw: -0.5, swing: 0.15, swingPeriod: 8 }, needs: 'RCL-2', needsMin: 0.9 },
  'BP-01': { model: 'batching-plant', motion: { kind: 'static', pos: [455, 2.6, 392], yaw: 0 } },
  'CM-01': { model: 'concrete-mixer', motion: loop([[455, 350], [455, 260], [430, 260], [430, 350]], 2.7, 3, 0.0) },
  'CM-02': { model: 'concrete-mixer', motion: loop([[455, 350], [455, 260], [430, 260], [430, 350]], 2.7, 3, 0.5) },
  'CM-03': { model: 'concrete-mixer', motion: { kind: 'static', pos: [520, 2.7, 365], yaw: 1.2 } },
  'TUG-01': { model: 'tug', motion: loop([[-260, -110], [-80, -140], [-60, -100], [-240, -80]], 0.2, 3, 0) },
  'BRG-01': { model: 'proc:barge', motion: { kind: 'static', pos: [-250, 0, -84], yaw: 0.12 } },
  'BRG-02': { model: 'proc:barge', motion: { kind: 'static', pos: [-575, 0, -300], yaw: 1.1 } },
  'GEN-01': { model: 'proc:gen', motion: { kind: 'static', pos: [610, 2.6, 372], yaw: 0 } },
  'GEN-02': { model: 'proc:gen', motion: { kind: 'static', pos: [-345, 3.5, 330], yaw: 0 }, needs: 'RCL-1', needsMin: 0.9 },
};
