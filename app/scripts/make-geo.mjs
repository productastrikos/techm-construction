// Builds src/assets/geojson/region.json: Natural Earth (public domain, via the world-atlas package) countries around the
// Regional outline, clipped to a bounding box and decimated. Runtime uses ONLY this local file (no tiles, no network).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { feature } from 'topojson-client';

const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-10m.json', import.meta.url)));
const fc = feature(topo, topo.objects.countries);
const NAMES = new Set(['Iran', 'Saudi Arabia', 'United Arab Emirates', 'Oman', 'Qatar', 'Bahrain', 'Kuwait', 'Iraq', 'Pakistan', 'Yemen']);
const BOX = [44, 20.5, 66, 32.5]; // minLon, minLat, maxLon, maxLat

function clip(ring, edge, inside, intersect) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i];
    const prev = ring[(i + ring.length - 1) % ring.length];
    const ci = inside(cur);
    const pi = inside(prev);
    if (ci) {
      if (!pi) out.push(intersect(prev, cur));
      out.push(cur);
    } else if (pi) out.push(intersect(prev, cur));
  }
  return out;
}
function clipBox(ring) {
  const [x0, y0, x1, y1] = BOX;
  let r = ring;
  const steps = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  for (const [ins, inter] of steps) {
    if (!r.length) break;
    r = clip(r, null, ins, inter);
  }
  return r;
}
function decimate(ring, tol) {
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const p = out[out.length - 1];
    if (Math.hypot(ring[i][0] - p[0], ring[i][1] - p[1]) >= tol) out.push(ring[i]);
  }
  if (out.length < 4) return null;
  out.push(out[0]);
  return out.map((p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]);
}
const feats = [];
for (const f of fc.features) {
  if (!NAMES.has(f.properties.name)) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const outPolys = [];
  for (const poly of polys) {
    const rings = poly
      .map((r) => clipBox(r.slice(0, -1)))
      .map((r) => (r.length > 3 ? decimate(r, 0.012) : null))
      .filter(Boolean);
    if (rings.length) outPolys.push(rings);
  }
  if (outPolys.length) feats.push({ type: 'Feature', properties: { name: f.properties.name }, geometry: { type: 'MultiPolygon', coordinates: outPolys } });
}
mkdirSync(new URL('../src/assets/geojson/', import.meta.url), { recursive: true });
const json = JSON.stringify({ type: 'FeatureCollection', features: feats });
writeFileSync(new URL('../src/assets/geojson/region.json', import.meta.url), json);
console.log('features', feats.length, 'bytes', json.length);
