import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { Btn } from '../../design/ui';
import { MODEL_IDS, MODELS, allCredits, modelStatus, preloadModels } from '../../three/assetManifest';
import { ModelInstance, SceneEnv } from '../../three/common';
import { Card, Chip, PageHeader, Td, Th } from '../../design/ui';

/** hidden QA route (#/models): every manifest model next to a 10 m scale bar, facing +X, plus credits */
export default function ModelsPage() {
  const [, setTick] = useState(0);
  const [focus, setFocus] = useState<(typeof MODEL_IDS)[number] | null>(null);
  useEffect(() => {
    void preloadModels(MODEL_IDS).then(() => setTick((x) => x + 1));
  }, []);
  let x = 0;
  const placed = MODEL_IDS.map((id) => {
    const L = MODELS[id].targetLengthMeters;
    const w = Math.max(L, 6) * 0.9 + 6;
    const pos = x + w / 2;
    x += w;
    return { id, pos, L };
  });
  const total = x;
  const fL = focus ? MODELS[focus].targetLengthMeters : 0;
  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Asset library (QA)"
        subtitle="Manifest models, normalised to real-world length, forward = +X"
        actions={
          <div className="flex flex-wrap gap-1 max-w-[900px] justify-end">
            <Btn size="sm" variant={focus ? 'outline' : 'soft'} onClick={() => setFocus(null)}>All</Btn>
            {MODEL_IDS.map((id) => (
              <Btn key={id} size="sm" variant={focus === id ? 'soft' : 'outline'} data-testid={`m-${id}`} onClick={() => setFocus(id)}>{id}</Btn>
            ))}
          </div>
        }
      />
      <div className="px-5 pb-5 flex-1 min-h-0 grid grid-rows-[1fr_auto] gap-3">
        <Card className="min-h-[300px]" bodyClass="!p-0">
          <Canvas key={focus ?? 'all'} shadows camera={{ position: focus ? [fL * 0.9, fL * 0.55, fL * 1.2] : [total * 0.45, total * 0.22, total * 0.6], fov: 35, near: 0.1, far: 3000 }} data-testid="models-canvas">
            <color attach="background" args={['#0b1a20']} />
            <SceneEnv />
            <hemisphereLight args={['#bcd9e6', '#3a3a34', 0.7]} />
            <directionalLight position={[80, 120, 60]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} />
            {!focus && <gridHelper args={[total + 80, Math.round((total + 80) / 10), '#2a4a55', '#183039']} position={[total / 2, 0, 0]} />}
            {focus && (
              <group>
                <ModelInstance id={focus} position={[0, 0, 0]} />
                <mesh position={[fL * 0.75, 0.2, 0]}><boxGeometry args={[fL * 0.5, 0.3, 0.3]} /><meshBasicMaterial color="#ff6b6b" /></mesh>
                <gridHelper args={[fL * 2, 20, '#2a4a55', '#183039']} />
                <OrbitControls target={[0, fL * 0.15, 0]} />
              </group>
            )}
            {!focus && placed.map((p) => (
              <group key={p.id}>
                <ModelInstance id={p.id} position={[p.pos, 0, 0]} />
                <mesh position={[p.pos, 0.2, MODELS[p.id].targetLengthMeters * 0.35 + 3]}>
                  <boxGeometry args={[p.L, 0.4, 0.4]} />
                  <meshBasicMaterial color="#3ee0b0" />
                </mesh>
              </group>
            ))}
            {!focus && <OrbitControls target={[total / 2, 8, 0]} />}
          </Canvas>
        </Card>
        <Card title="Credits (CC BY 4.0 - attribution required)" bodyClass="overflow-auto max-h-[200px]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>File</Th>
                <Th>Title</Th>
                <Th>Author</Th>
                <Th>Licence</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {allCredits().map((c) => (
                <tr key={c.file}>
                  <Td className="mono">{c.file}</Td>
                  <Td>{c.credit.title}</Td>
                  <Td>{c.credit.author}</Td>
                  <Td>{c.credit.licence}</Td>
                  <Td>
                    <Chip tone={modelStatus(MODEL_IDS.find((i) => MODELS[i].file === c.file)!) === 'glb' ? 'good' : 'warn'}>{modelStatus(MODEL_IDS.find((i) => MODELS[i].file === c.file)!)}</Chip>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
