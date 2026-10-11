// Procedural stand-ins for every equipment model: same footprint as the real GLB (length along +X, forward +X,
// bottom at y=0) so a missing/failed asset never blocks the scene.
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';

export type PlaceholderKind = 'sts' | 'crawler' | 'ship' | 'dredger' | 'truck' | 'excavator' | 'tower' | 'tug' | 'stacker' | 'mixer' | 'piling' | 'worker' | 'harbour' | 'straddle';

const mat = (color: string, metal = 0.2, rough = 0.7) => new MeshStandardMaterial({ color, metalness: metal, roughness: rough });

function box(g: Group, w: number, h: number, d: number, x: number, y: number, z: number, color: string) {
  const m = new Mesh(new BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
function cyl(g: Group, r: number, h: number, x: number, y: number, z: number, color: string, rotZ = 0) {
  const m = new Mesh(new CylinderGeometry(r, r, h, 16), mat(color));
  m.position.set(x, y + h / 2, z);
  m.rotation.z = rotZ;
  m.castShadow = true;
  g.add(m);
  return m;
}
function wheels(g: Group, L: number, W: number, r: number, color = '#1c1f22') {
  for (const x of [-L * 0.32, L * 0.32]) for (const z of [-W / 2, W / 2]) cyl(g, r, r * 0.9, x, r - 0.0, z, color, Math.PI / 2).rotation.x = Math.PI / 2;
}

export function makePlaceholder(kind: PlaceholderKind, L: number): Group {
  const g = new Group();
  g.name = `placeholder-${kind}`;
  const W = L * 0.3;
  switch (kind) {
    case 'sts': {
      // gantry crane: portal legs, girder, boom reaching +X (seaward), machinery house
      const col = '#e0792b';
      const legH = L * 0.42;
      for (const x of [-L * 0.12, L * 0.12]) for (const z of [-L * 0.2, L * 0.2]) box(g, 1.6, legH, 1.6, x, 0, z, col);
      box(g, L * 0.3, 2.4, L * 0.46, 0, legH, 0, col);
      box(g, L * 0.95, 2.2, 3, L * 0.18, legH + 2.4, 0, '#c9661f');
      box(g, 10, 6, 8, -L * 0.2, legH + 2.4, 0, '#8a8f94');
      break;
    }
    case 'crawler': {
      box(g, L * 0.7, 1.4, W * 0.5, 0, 0, 0, '#2b2e31');
      box(g, L * 0.34, 2.6, W * 0.5, -L * 0.08, 1.4, 0, '#e8a31c');
      const boom = box(g, L * 0.8, 0.8, 0.8, L * 0.28, 5.5, 0, '#e8a31c');
      boom.rotation.z = 0.7;
      break;
    }
    case 'ship': {
      box(g, L, L * 0.09, L * 0.15, 0, 0, 0, '#1f3a4d');
      box(g, L * 0.8, L * 0.045, L * 0.14, -L * 0.04, L * 0.09, 0, '#b94a2f');
      box(g, L * 0.1, L * 0.12, L * 0.14, -L * 0.36, L * 0.135, 0, '#e8e8e8');
      break;
    }
    case 'dredger': {
      box(g, L, L * 0.1, L * 0.2, 0, 0, 0, '#c9c24a');
      box(g, L * 0.16, L * 0.15, L * 0.18, -L * 0.3, L * 0.1, 0, '#e8e8e8');
      cyl(g, 0.7, L * 0.09, L * 0.12, L * 0.1, 0, '#555');
      break;
    }
    case 'truck': {
      box(g, L * 0.42, W * 0.5, W * 0.6, L * 0.25, 0.5, 0, '#e8a31c');
      box(g, L * 0.5, W * 0.45, W * 0.62, -L * 0.2, 0.7, 0, '#e8a31c');
      wheels(g, L, W * 0.62, W * 0.2);
      break;
    }
    case 'excavator': {
      box(g, L * 0.55, W * 0.28, W * 0.7, 0, 0, 0, '#2b2e31');
      box(g, L * 0.4, W * 0.4, W * 0.55, -L * 0.04, W * 0.28, 0, '#e8a31c');
      const arm = box(g, L * 0.5, 0.45, 0.45, L * 0.26, W * 0.55, 0, '#e8a31c');
      arm.rotation.z = 0.35;
      break;
    }
    case 'tower': {
      const h = L * 0.9;
      box(g, 1.6, h, 1.6, 0, 0, 0, '#e8c71c');
      box(g, L, 1.2, 1.2, L * 0.25, h, 0, '#e8c71c');
      box(g, 3, 3, 3, -L * 0.2, h - 3, 0, '#8a8f94');
      break;
    }
    case 'tug': {
      box(g, L, L * 0.12, L * 0.3, 0, 0, 0, '#c43d2f');
      box(g, L * 0.4, L * 0.16, L * 0.24, -L * 0.1, L * 0.12, 0, '#e8e8e8');
      break;
    }
    case 'stacker': {
      box(g, L * 0.55, W * 0.45, W * 0.8, -L * 0.1, 0.5, 0, '#e8a31c');
      const boom = box(g, L * 0.55, 0.5, 0.6, L * 0.2, W * 0.7, 0, '#2b2e31');
      boom.rotation.z = 0.25;
      wheels(g, L, W * 0.8, W * 0.22);
      break;
    }
    case 'mixer': {
      box(g, L * 0.3, W * 0.45, W * 0.7, L * 0.3, 0.5, 0, '#e8e8e8');
      cyl(g, W * 0.4, L * 0.55, -L * 0.12, W * 0.5, 0, '#c9661f', Math.PI / 2 - 0.2);
      wheels(g, L, W * 0.7, W * 0.2);
      break;
    }
    case 'piling': {
      box(g, L * 0.6, 1.2, W * 0.5, 0, 0, 0, '#2b2e31');
      box(g, L * 0.25, 2.2, W * 0.45, -L * 0.15, 1.2, 0, '#d9692a');
      box(g, 0.9, L * 0.9, 0.9, L * 0.18, 0, 0, '#d9692a');
      break;
    }
    case 'worker': {
      cyl(g, 0.22, 1.1, 0, 0.5, 0, '#e8a31c');
      const head = new Mesh(new SphereGeometry(0.17, 12, 12), mat('#f1c9a4'));
      head.position.set(0, 1.72, 0);
      g.add(head);
      const hat = new Mesh(new SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ffd400'));
      hat.position.set(0, 1.78, 0);
      g.add(hat);
      break;
    }
    case 'harbour': {
      box(g, L * 0.3, L * 0.18, L * 0.3, 0, 0, 0, '#3a6f9e');
      box(g, L * 0.8, 1.2, 1.2, L * 0.2, L * 0.4, 0, '#3a6f9e');
      break;
    }
    case 'straddle': {
      for (const z of [-W * 0.4, W * 0.4]) box(g, L * 0.8, W * 0.5, 0.5, 0, 0, z, '#d33');
      box(g, L * 0.8, 0.6, W * 0.9, 0, W * 0.5, 0, '#d33');
      break;
    }
  }
  return g;
}
