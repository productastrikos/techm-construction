import type { MotionSpec } from '../engine/types';

export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

const cache = new WeakMap<object, { cum: number[]; total: number }>();

function loopInfo(pts: Array<[number, number]>) {
  let hit = cache.get(pts);
  if (!hit) {
    const cum = [0];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    hit = { cum, total: cum[cum.length - 1] };
    cache.set(pts, hit);
  }
  return hit;
}

/** model faces +X; rotating about Y by yaw maps +X to (cos yaw, -sin yaw) in (x, z) */
const yawOf = (dx: number, dz: number) => Math.atan2(-dz, dx);

/** pure pose function of wall-clock seconds (deterministic) */
export function poseAt(m: MotionSpec, secs: number): Pose {
  switch (m.kind) {
    case 'static': {
      const sw = m.swing ? Math.sin((secs / (m.swingPeriod ?? 10)) * Math.PI * 2) * m.swing : 0;
      return { x: m.pos[0], y: m.pos[1], z: m.pos[2], yaw: m.yaw + sw };
    }
    case 'loop': {
      const { cum, total } = loopInfo(m.pts);
      const s = (((m.speed * secs + m.phase * total) % total) + total) % total;
      let i = 0;
      while (i < cum.length - 2 && cum[i + 1] < s) i++;
      const a = m.pts[i];
      const b = m.pts[(i + 1) % m.pts.length];
      const u = (s - cum[i]) / Math.max(1e-6, cum[i + 1] - cum[i]);
      return { x: a[0] + (b[0] - a[0]) * u, y: m.y, z: a[1] + (b[1] - a[1]) * u, yaw: yawOf(b[0] - a[0], b[1] - a[1]) };
    }
    case 'line': {
      const len = Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]);
      const s = (((m.speed * secs + m.phase * len * 2) % (2 * len)) + 2 * len) % (2 * len);
      const fwd = s <= len;
      const u = (fwd ? s : 2 * len - s) / len;
      const dx = (m.b[0] - m.a[0]) * (fwd ? 1 : -1);
      const dz = (m.b[1] - m.a[1]) * (fwd ? 1 : -1);
      return { x: m.a[0] + (m.b[0] - m.a[0]) * u, y: m.y + Math.sin(secs * 0.6) * 0.15, z: m.a[1] + (m.b[1] - m.a[1]) * u, yaw: yawOf(dx, dz) };
    }
  }
}
