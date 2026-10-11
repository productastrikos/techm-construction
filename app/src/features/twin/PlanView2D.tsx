import type { ColorMode } from '../../app/store';
import type { Id } from '../../engine/types';
import type { MatRisk } from '../../three/PortScene';
import type { SceneModel } from '../../three/sceneModel';

const C = { good: '#3ee0b0', warn: '#f7b84b', bad: '#ff6b6b', dim: '#52707a' };

/** WebGL-free fallback: top-down SVG plan of the same elements, same colours, same click-to-select */
export function PlanView2D({ model, colorMode, selection, onSelect, matRisk, overlay }: { model: SceneModel; colorMode: ColorMode; selection: Id | null; onSelect: (id: Id | null) => void; matRisk: Map<Id, MatRisk>; overlay: Record<Id, 'watch' | 'late'> }) {
  const col = (id: string, base: string) => {
    const ov = overlay[id];
    if (ov) return ov === 'late' ? C.bad : C.warn;
    const st = model.states.get(id);
    if (colorMode === 'progress') return !st || st.status === 'planned' ? C.dim : st.health === 'late' ? C.bad : st.health === 'watch' ? C.warn : C.good;
    if (colorMode === 'material') {
      const r = matRisk.get(id) ?? 'none';
      return r === 'ok' ? C.good : r === 'late' ? C.bad : r === 'none' ? C.dim : C.warn;
    }
    return base;
  };
  return (
    <svg viewBox="-720 -520 1500 1100" className="w-full h-full" style={{ background: '#0e3a4c' }} onClick={() => onSelect(null)} data-testid="plan2d">
      <rect x={-900} y={0} width={1900} height={700} fill="#b9a57c" opacity={0.0} />
      {model.pack.elements
        .filter((e) => e.kind !== 'seabed')
        .map((e) => {
          const st = model.states.get(e.id);
          const p = st?.pf ?? 0;
          const w = e.size[0];
          const d = e.size[2];
          return (
            <g key={e.id} transform={`translate(${e.pos[0]} ${e.pos[2]}) rotate(${((e.rotY ?? 0) * -180) / Math.PI})`} onClick={(ev) => (ev.stopPropagation(), onSelect(e.id))} style={{ cursor: 'pointer' }}>
              <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="none" stroke="#7fe0d0" strokeOpacity={0.35} strokeWidth={1.2} />
              {p > 0.002 && <rect x={-w / 2} y={-d / 2} width={w} height={d} fill={col(e.id, e.color)} opacity={0.25 + 0.7 * p} stroke={selection === e.id ? '#fff' : 'none'} strokeWidth={2.5} />}
            </g>
          );
        })}
    </svg>
  );
}
