// Image manifest: use the file in src/assets/images when present, otherwise a generated gradient placeholder
// (SVG data URL) so the UI never shows a broken image. Files are AI-generated illustrations (see CREDITS.md).
const found = import.meta.glob('../assets/images/*.{jpg,jpeg,png,webp}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export type ImageId = 'drone-before' | 'drone-after' | 'cctv-gate' | 'cctv-quay' | 'cctv-yard' | 'cctv-batching' | 'hero-port';

const HUE: Record<ImageId, [string, string]> = {
  'drone-before': ['#6b5b3a', '#2a4a5a'],
  'drone-after': ['#4a5560', '#1f4a60'],
  'cctv-gate': ['#303a3f', '#14202a'],
  'cctv-quay': ['#2c3d47', '#12222c'],
  'cctv-yard': ['#3a3a30', '#1a1f1a'],
  'cctv-batching': ['#3a3530', '#1c1a1a'],
  'hero-port': ['#0f2d3a', '#2a1f3a'],
};

function placeholder(id: ImageId): string {
  const [a, b] = HUE[id];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><text x="800" y="460" font-family="sans-serif" font-size="44" fill="#ffffff" fill-opacity="0.55" text-anchor="middle">${id} (placeholder)</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function imageUrl(id: ImageId): string {
  const key = Object.keys(found).find((k) => /\/([^/]+)\.(jpg|jpeg|png|webp)$/.test(k) && k.includes(`/${id}.`));
  return key ? found[key] : placeholder(id);
}
export function hasImage(id: ImageId): boolean {
  return Object.keys(found).some((k) => k.includes(`/${id}.`));
}
