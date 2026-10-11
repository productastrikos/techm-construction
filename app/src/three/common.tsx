import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Color, Group, InstancedMesh, Material, Matrix4, Mesh, Object3D, PMREMGenerator, Quaternion, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getModel, type ModelId } from './assetManifest';

/** offline image-based lighting (RoomEnvironment is bundled with three, no HDR download) */
export function SceneEnv({ intensity = 0.55 }: { intensity?: number }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new PMREMGenerator(gl);
    const env = new RoomEnvironment();
    const tex = pm.fromScene(env, 0.04).texture;
    scene.environment = tex;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      tex.dispose();
      pm.dispose();
      env.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
}

/** loads a manifest model (GLB or procedural placeholder) and mounts an independent clone */
export function ModelInstance({
  id,
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
  onReady,
  userData,
}: {
  id: ModelId;
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
  onReady?: (o: Object3D) => void;
  userData?: Record<string, unknown>;
}) {
  const [obj, setObj] = useState<Object3D | null>(null);
  const ref = useRef<Group>(null);
  useEffect(() => {
    let live = true;
    getModel(id).then((o) => {
      if (!live) return;
      setObj(o);
      onReady?.(o);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return (
    <group ref={ref} position={position} rotation={[0, rotationY, 0]} scale={scale} userData={userData}>
      {obj && <primitive object={obj} />}
    </group>
  );
}

export interface GlbInst {
  p: [number, number, number];
  ry?: number;
  s?: number;
  c?: string;
}

/** many copies of one manifest model as InstancedMesh (one draw call per sub-mesh). Static models only (no skinning). */
export function InstancedGLB({ id, items, receive = false, cast = true }: { id: ModelId; items: GlbInst[]; receive?: boolean; cast?: boolean }) {
  const [parts, setParts] = useState<Array<{ mesh: Mesh; local: Matrix4 }>>([]);
  const refs = useRef<Array<InstancedMesh | null>>([]);
  useEffect(() => {
    let live = true;
    getModel(id).then((root) => {
      if (!live) return;
      root.updateMatrixWorld(true);
      const out: Array<{ mesh: Mesh; local: Matrix4 }> = [];
      root.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) out.push({ mesh: m, local: m.matrixWorld.clone() });
      });
      setParts(out);
    });
    return () => {
      live = false;
    };
  }, [id]);
  useLayoutEffect(() => {
    const m4 = new Matrix4();
    const q = new Quaternion();
    const col = new Color();
    parts.forEach((part, pi) => {
      const im = refs.current[pi];
      if (!im) return;
      items.forEach((it, i) => {
        q.setFromAxisAngle(new Vector3(0, 1, 0), it.ry ?? 0);
        m4.compose(new Vector3(...it.p), q, new Vector3().setScalar(it.s ?? 1));
        m4.multiply(part.local);
        im.setMatrixAt(i, m4);
        if (it.c) {
          col.set(it.c);
          im.setColorAt(i, col);
        }
      });
      im.count = items.length;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    });
  }, [parts, items]);
  if (!items.length) return null;
  return (
    <group>
      {parts.map((part, i) => (
        <instancedMesh
          key={`${id}-${i}-${items.length}`}
          ref={(r) => {
            refs.current[i] = r;
          }}
          args={[part.mesh.geometry, part.mesh.material as Material, items.length]}
          castShadow={cast}
          receiveShadow={receive}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
