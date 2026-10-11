// Sea surface: analytic waves, depth-tinted shallows and animated foam along the coast, driven by the terrain depth mask.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, ShaderMaterial, Vector3, Vector4 } from 'three';
import { MASK, makeWaterMask } from './terrain';

export interface WaterLook {
  deep: string;
  shallow: string;
  fog: string;
  sun: [number, number, number];
  sunColor: string;
  skyHorizon: string;
  skyZenith: string;
}

export const DAY_WATER: WaterLook = {
  deep: '#06324a',
  shallow: '#3fb7b0',
  fog: '#b7cfd8',
  sun: [0.5, 0.55, -0.62],
  sunColor: '#fff2d8',
  skyHorizon: '#cfe2ea',
  skyZenith: '#5b93c6',
};

const vert = `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;

const frag = `
uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFog; uniform vec3 uSun; uniform vec3 uSunCol;
uniform vec3 uHorizon; uniform vec3 uZenith; uniform sampler2D uMask; uniform vec4 uBounds;
varying vec3 vW;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ return 0.5*vn(p) + 0.25*vn(p*2.03+7.1) + 0.125*vn(p*4.1+3.7); }
void main(){
  vec2 p = vW.xz;
  float t = uTime;
  // large swell + chop + fine ripples
  float dx = cos(p.x*0.045+t*0.7)*0.05 + cos((p.x*0.6+p.y)*0.05+t*0.55)*0.045 + cos(p.x*0.35-p.y*0.2+t*1.3)*0.03;
  float dz = cos(p.y*0.04-t*0.6)*0.05 + cos((p.x*0.6+p.y)*0.05+t*0.55)*0.045 + cos(p.y*0.31+p.x*0.12-t*1.1)*0.03;
  vec2 q = p*0.55 + vec2(t*0.35, -t*0.22);
  float r1 = vn(q) - 0.5; float r2 = vn(q*2.3+vec2(-t*0.5, t*0.3)) - 0.5; float r3 = vn(p*2.6 + vec2(t*0.9, t*0.5)) - 0.5;
  float cd = length(cameraPosition - vW); float fade = 1.0 - smoothstep(250.0, 1400.0, cd);
  dx += (r1*0.14 + (r2*0.12 + r3*0.05)*fade); dz += (r2*0.16*fade - r1*0.1 + r3*0.05*fade);
  vec3 n = normalize(vec3(-dx, 1.0, -dz));
  vec3 v = normalize(cameraPosition - vW);
  vec3 sun = normalize(uSun);
  vec3 rf = reflect(-v, n);
  float fres = 0.02 + 0.98*pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 sky = mix(uHorizon, uZenith, clamp(rf.y*1.4, 0.0, 1.0));
  float spec = pow(max(dot(rf, sun), 0.0), 220.0) * 1.6 + pow(max(dot(rf, sun), 0.0), 18.0) * 0.07;
  // depth from the terrain mask
  vec2 muv = (p - uBounds.xy) / uBounds.zw;
  float d = texture2D(uMask, clamp(muv, 0.001, 0.999)).r;
  float inMask = step(0.0, muv.x) * step(muv.x, 1.0) * step(0.0, muv.y) * step(muv.y, 1.0);
  d = mix(1.0, d, inMask);
  float body = smoothstep(0.0, 0.62, d);
  vec3 col = mix(uShallow, uDeep, body);
  // turbidity near the shore
  col = mix(col, vec3(0.5,0.62,0.52), (1.0 - smoothstep(0.0, 0.16, d)) * 0.35);
  col = mix(col, sky, fres * 0.85);
  col += uSunCol * spec;
  // foam: shoreline band + breaking lines
  float wob = fbm(p*0.35 + vec2(t*0.1, 0.0));
  float band = smoothstep(0.0, 0.02, d) * (1.0 - smoothstep(0.045, 0.2, d + (wob - 0.5)*0.06));
  float lines = 0.5 + 0.5*sin(d*95.0 - t*1.7 + wob*9.0);
  float foam = clamp(band * (0.35 + 0.65*lines) * (0.5 + wob), 0.0, 1.0);
  // whitecaps in open water
  float cap = smoothstep(0.78, 0.95, fbm(p*0.12 + vec2(t*0.25, t*0.1))) * 0.18 * smoothstep(0.35, 0.8, d);
  col = mix(col, vec3(0.96,0.98,0.97), clamp(foam*0.9 + cap, 0.0, 1.0));
  float dist = length(cameraPosition - vW);
  col = mix(col, uFog, smoothstep(1500.0, 5200.0, dist));
  float alpha = mix(0.35, 0.95, smoothstep(0.0, 0.3, d));
  alpha = max(alpha, foam);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function Water({ look = DAY_WATER }: { look?: WaterLook }) {
  const mask = useMemo(() => makeWaterMask(), []);
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new Color(look.deep) },
          uShallow: { value: new Color(look.shallow) },
          uFog: { value: new Color(look.fog) },
          uSun: { value: new Vector3(...look.sun) },
          uSunCol: { value: new Color(look.sunColor) },
          uHorizon: { value: new Color(look.skyHorizon) },
          uZenith: { value: new Color(look.skyZenith) },
          uMask: { value: mask },
          uBounds: { value: new Vector4(MASK.x0, MASK.z0, MASK.sx, MASK.sz) },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mask],
  );
  useEffect(() => {
    const u = mat.uniforms;
    u.uDeep.value.set(look.deep);
    u.uShallow.value.set(look.shallow);
    u.uFog.value.set(look.fog);
    u.uSun.value.set(...look.sun);
    u.uSunCol.value.set(look.sunColor);
    u.uHorizon.value.set(look.skyHorizon);
    u.uZenith.value.set(look.skyZenith);
  }, [look, mat]);
  useEffect(
    () => () => {
      mask.dispose();
      mat.dispose();
    },
    [mask, mat],
  );
  useFrame((s) => {
    mat.uniforms.uTime.value = s.clock.elapsedTime;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={mat} renderOrder={2}>
      <planeGeometry args={[9000, 9000]} />
    </mesh>
  );
}
