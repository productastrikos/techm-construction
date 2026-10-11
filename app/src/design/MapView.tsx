// Offline map: MapLibre GL with a style that has ONLY a local GeoJSON source (Natural Earth countries, public domain,
// clipped to the demo region by scripts/make-geo.mjs). No tiles, glyphs, sprites or network. Labels are HTML markers.
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { LngLatBoundsLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import region from '../assets/geojson/region.json';
import type { Tone } from './ui';
import { toneVar } from './ui';
import { useApp } from '../app/store';

export interface MapMarker {
  id: string;
  lon: number;
  lat: number;
  label?: string;
  tone?: Tone;
  /** px diameter of the dot */
  size?: number;
  pulse?: boolean;
  title?: string;
  onClick?: () => void;
}

export interface MapLine {
  id: string;
  coords: Array<[number, number]>;
  color?: string;
  width?: number;
  dashed?: boolean;
  opacity?: number;
}

export interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  bounds?: [[number, number], [number, number]];
  markers?: MapMarker[];
  lines?: MapLine[];
  className?: string;
  interactive?: boolean;
  onReady?: (m: maplibregl.Map) => void;
}

// Vite cannot resolve MapLibre's worker by itself: point it at the bundled local file (works dev + build, offline)
maplibregl.setWorkerUrl(workerUrl);

const lineFC = (lines: MapLine[]) => ({
  type: 'FeatureCollection' as const,
  features: lines.map((l) => ({ type: 'Feature' as const, properties: { id: l.id, color: l.color ?? '#3ee0b0', width: l.width ?? 2, dash: l.dashed ? 1 : 0, opacity: l.opacity ?? 0.9 }, geometry: { type: 'LineString' as const, coordinates: l.coords } })),
});

export function MapView({ center = [54.5, 25.6], zoom = 5.2, bounds, markers = [], lines = [], className, interactive = true, onReady }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const mk = useRef<Map<string, maplibregl.Marker>>(new Map());
  const loaded = useRef(false);
  const theme = useApp((s) => s.theme);

  useEffect(() => {
    if (!el.current) return;
    const dark = theme === 'dark';
    const m = new maplibregl.Map({
      container: el.current,
      scrollZoom: false,
      style: {
        version: 8,
        sources: { region: { type: 'geojson', data: region as never }, lines: { type: 'geojson', data: lineFC([]) } },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': dark ? '#111214' : '#dde5ea' } },
          { id: 'land', type: 'fill', source: 'region', paint: { 'fill-color': dark ? '#2a2a2e' : '#f1ede3', 'fill-opacity': 1 } },
          { id: 'border', type: 'line', source: 'region', paint: { 'line-color': dark ? '#6a6a72' : '#a79f84', 'line-width': 1 } },
          { id: 'lines', type: 'line', source: 'lines', paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': ['get', 'opacity'] }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
        ],
      },
      center,
      zoom,
      attributionControl: false,
      interactive,
      dragRotate: false,
      pitchWithRotate: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.current = m;
    m.on('load', () => {
      loaded.current = true;
      if (bounds) m.fitBounds(bounds as LngLatBoundsLike, { padding: 30, duration: 0 });
      (m.getSource('lines') as maplibregl.GeoJSONSource).setData(lineFC(lines) as never);
      onReady?.(m);
    });
    const mkRef = mk.current;
    return () => {
      mkRef.forEach((x) => x.remove());
      mkRef.clear();
      m.remove();
      map.current = null;
      loaded.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => (m.getSource('lines') as maplibregl.GeoJSONSource | undefined)?.setData(lineFC(lines) as never);
    if (loaded.current) apply();
    else m.once('load', apply);
  }, [lines, theme]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const k of markers) {
      seen.add(k.id);
      let mm = mk.current.get(k.id);
      const c = toneVar[k.tone ?? 'accent'];
      if (!mm) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;cursor:' + (k.onClick ? 'pointer' : 'default');
        wrap.dataset.marker = k.id;
        mm = new maplibregl.Marker({ element: wrap, anchor: 'center' }).setLngLat([k.lon, k.lat]).addTo(m);
        mk.current.set(k.id, mm);
      }
      const wrap = mm.getElement();
      wrap.title = k.title ?? '';
      wrap.onclick = k.onClick ? () => k.onClick!() : null;
      const s = k.size ?? 12;
      wrap.replaceChildren();
      const dot = document.createElement('span');
      dot.style.cssText = `width:${s}px;height:${s}px;border-radius:50%;background:${c};border:2px solid rgba(255,255,255,.85);box-shadow:0 0 0 ${k.pulse ? 6 : 0}px color-mix(in srgb, ${c} 30%, transparent);display:block`;
      wrap.appendChild(dot);
      if (k.label) {
        const lab = document.createElement('span');
        lab.style.cssText = 'font:600 11px var(--font-sans);color:var(--text);background:color-mix(in srgb, var(--surface) 82%, transparent);border:1px solid var(--line-2);border-radius:6px;padding:0 5px;white-space:nowrap';
        lab.textContent = k.label;
        wrap.appendChild(lab);
      }
      mm.setLngLat([k.lon, k.lat]);
    }
    mk.current.forEach((v, id) => {
      if (!seen.has(id)) {
        v.remove();
        mk.current.delete(id);
      }
    });
  }, [markers, theme]);

  return <div ref={el} className={className} style={{ width: '100%', height: '100%', minHeight: 160 }} data-testid="map" />;
}

/** great-circle-ish arc between two lon/lat points (quadratic bezier bulge) for route lines */
export function arc(a: [number, number], b: [number, number], bulge = 0.18, n = 28): Array<[number, number]> {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const cx = mx - dy * bulge;
  const cy = my + dx * bulge;
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1]]);
  }
  return out;
}
