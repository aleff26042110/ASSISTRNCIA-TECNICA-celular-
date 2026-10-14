import {
  Component,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  RoundedBox,
  Grid,
  ContactShadows,
  useGLTF,
  Html,
} from "@react-three/drei";
import * as THREE from "three";
import { components } from "./data";
import ImportedPhone from "./ImportedPhone";
import type { AssemblyGeometry } from "./ImportedPhone";
import { partProgress } from "./disassembly";
import { useStore } from "./store";
import type { PhoneComponent } from "./types";
export function GLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => scene.clone(), [scene]);
  return <primitive object={clone} />;
}
class ModelBoundary extends Component<{
  children: ReactNode;
  fallback: ReactNode;
  onError: () => void;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fallback">
        Não foi possível iniciar o 3D. Use a lista de componentes para continuar
        o diagnóstico e recarregue a página para tentar novamente.
      </div>
    ) : (
      this.props.children
    );
  }
}
function Part({ part, model, isolated = false, labels = false, reducedMotion = false, labelAllowed = true, dragged }: {
  part: PhoneComponent;
  model?: AssemblyGeometry;
  isolated?: boolean;
  labels?: boolean;
  reducedMotion?: boolean;
  labelAllowed?: boolean;
  dragged?: { current: boolean };
}) {
  const ref = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(), []);
  const assembled = useMemo(
    () => new THREE.Vector3(...part.originalPosition),
    [part.originalPosition],
  );
  const exploded = useMemo(
    () => new THREE.Vector3(...part.explodedPosition),
    [part.explodedPosition],
  );
  const invalidate = useThree((s) => s.invalidate);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const explosion = useStore((s) => s.explosion);
  const faulty = useStore((s) => s.diagnoses[part.id]?.state === "Defeito confirmado");
  useEffect(() => {
    invalidate();
  }, [explosion, selected, faulty, isolated, labels, reducedMotion, invalidate]);
  const active = selected === part.id;
  useEffect(() => {
    if (model) {
      model.material.emissive.set(active ? "#1684ed" : faulty ? "#a82032" : "#000000");
      model.material.emissiveIntensity = active ? 0.24 : faulty ? 0.2 : 0;
      invalidate();
    }
  }, [model, active, faulty, invalidate]);
  useFrame((_, dt) => {
    if (!ref.current?.visible) return;
    const progress = partProgress(explosion, part.stage);
    target.copy(assembled).lerp(exploded, progress);
    if (isolated) {
      const original = components.find((component) => component.id === part.id)!.originalPosition;
      target.set(assembled.x - original[0], assembled.y - original[1], assembled.z - original[2]);
    }
    const damping = reducedMotion ? 1 : 1 - Math.exp(-dt * 12);
    const rotation = isolated ? 0 : progress * (part.id === "back" ? -0.12 : 0.04);
    ref.current.position.lerp(target, damping);
    ref.current.rotation.y = THREE.MathUtils.lerp(
      ref.current.rotation.y,
      rotation,
      damping,
    );
    if (model && part.id === "frame") {
      const opacity = isolated ? 1 : 1 - 0.68 * partProgress(explosion, 0.3, 0.25);
      model.material.opacity = THREE.MathUtils.lerp(model.material.opacity, opacity, damping);
      model.material.transparent = model.material.opacity < 0.999;
      model.material.depthWrite = !model.material.transparent;
      if (Math.abs(model.material.opacity - opacity) > 0.001) invalidate();
    }
    if (ref.current.position.distanceTo(target) > 0.001 || Math.abs(ref.current.rotation.y - rotation) > 0.0001) invalidate();
  });
  const edge = useMemo(() => new THREE.BoxGeometry(...part.size), [part]);
  useEffect(() => () => edge.dispose(), [edge]);
  const camera = part.visual === "camera";
  const showBody = !["frame", "coil"].includes(part.visual);
  return (
    <group
      ref={ref}
      name={`component-${part.id}`}
      position={part.originalPosition}
      visible={!isolated || active}
      onClick={(e) => {
        if (dragged?.current || e.delta > 2 || (isolated && !active)) return;
        e.stopPropagation();
        select(part.id);
      }}
      onPointerOver={(e) => {
        if (isolated && !active) return;
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      {model ? <>
        <mesh geometry={model.geometry} material={model.material} castShadow receiveShadow />
        {(active || faulty) && <lineSegments>
          <edgesGeometry args={[edge]} />
          <lineBasicMaterial color={faulty ? "#ff6378" : "#65bdff"} />
        </lineSegments>}
      </> : <group>
      <RoundedBox
        visible={showBody}
        args={part.size}
        radius={Math.min(0.09, part.size[2] / 3)}
        smoothness={3}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={part.color}
          metalness={part.visual === "battery" ? 0.12 : 0.62}
          roughness={part.visual === "battery" ? 0.72 : 0.3}
          emissive={active ? "#1684ed" : faulty ? "#a82032" : "#000000"}
          emissiveIntensity={active ? 0.35 : faulty ? 0.2 : 0}
        />
        {(active || faulty) && (
          <lineSegments>
            <edgesGeometry args={[edge]} />
            <lineBasicMaterial color={faulty ? "#ff6378" : "#65bdff"} />
          </lineSegments>
        )}
      </RoundedBox>
      {part.id === "frame" && (
        <group>
          {(
            [
              [-1.28, 0, 0],
              [1.28, 0, 0],
              [0, 2.65, 0],
              [0, -2.65, 0],
            ] as [number, number, number][]
          ).map((pos, i) => (
            <RoundedBox
              key={i}
              position={pos}
              args={i < 2 ? [0.1, 5.3, 0.3] : [2.5, 0.1, 0.3]}
              radius={0.04}
              castShadow
            >
              <meshStandardMaterial
                color={active ? "#438fd0" : "#778697"}
                metalness={0.85}
                roughness={0.22}
              />
            </RoundedBox>
          ))}
          <RoundedBox
            position={[-0.53, 1.73, -0.16]}
            args={[1.28, 1.34, 0.12]}
            radius={0.18}
            smoothness={4}
          >
            <meshStandardMaterial
              color="#aeb5ba"
              metalness={0.74}
              roughness={0.3}
            />
          </RoundedBox>
        </group>
      )}
      {part.visual === "board" && (
        <group>
          {[-1.15, -0.35, 0.45, 1.18].map((y, index) => (
            <RoundedBox
              key={y}
              position={[0, y, 0.09]}
              args={[0.5, index === 1 ? 0.72 : 0.45, 0.05]}
              radius={0.03}
            >
              <meshStandardMaterial
                color={index % 2 ? "#a8adb0" : "#20262b"}
                metalness={0.72}
                roughness={0.38}
              />
            </RoundedBox>
          ))}
          {[-0.22, 0, 0.22].map((x) => (
            <mesh key={x} position={[x, 0.12, 0.1]}>
              <boxGeometry args={[0.1, 0.1, 0.045]} />
              <meshStandardMaterial color="#c6a75a" metalness={0.8} />
            </mesh>
          ))}
        </group>
      )}
      {camera && (
        <group position={[0, 0, -part.size[2] / 2 - 0.02]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry
              args={[part.size[0] * 0.41, part.size[0] * 0.41, 0.1, 48]}
            />
            <meshStandardMaterial
              color="#151b21"
              metalness={0.9}
              roughness={0.18}
            />
          </mesh>
          <mesh position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry
              args={[part.size[0] * 0.29, part.size[0] * 0.29, 0.035, 48]}
            />
            <meshPhysicalMaterial
              color="#07192b"
              metalness={0.65}
              roughness={0.04}
              clearcoat={1}
              clearcoatRoughness={0.05}
            />
          </mesh>
          <mesh position={[-0.08, 0.09, -0.085]}>
            <sphereGeometry args={[part.size[0] * 0.06, 16, 16]} />
            <meshBasicMaterial color="#87bfea" transparent opacity={0.6} />
          </mesh>
        </group>
      )}
      {part.id === "screen" && (
        <group position={[0, 0, 0.055]}>
          <RoundedBox args={[2.42, 5.08, 0.025]} radius={0.28} smoothness={5}>
            <meshPhysicalMaterial
              color="#081525"
              emissive="#0d3155"
              emissiveIntensity={0.24}
              roughness={0.09}
              clearcoat={1}
            />
          </RoundedBox>
          <RoundedBox
            position={[0, 2.14, 0.025]}
            args={[0.7, 0.16, 0.03]}
            radius={0.08}
          >
            <meshBasicMaterial color="#050a10" />
          </RoundedBox>
        </group>
      )}
      {part.visual === "battery" && (
        <group position={[0, 0, part.size[2] / 2 + 0.012]}>
          {[0.52, 0.34, -0.88].map((y, index) => (
            <mesh key={y} position={[0, y, 0]}>
              <planeGeometry args={[index === 2 ? 1.1 : 0.82, 0.03]} />
              <meshBasicMaterial color={index === 2 ? "#7d8790" : "#4e555c"} />
            </mesh>
          ))}
        </group>
      )}
      {part.visual === "coil" && (
        <group>
          {[0.8, 0.68, 0.56].map((radius, index) => (
            <mesh key={radius} position={[0, 0, index * 0.006]}>
              <torusGeometry args={[radius, 0.035, 10, 72]} />
              <meshStandardMaterial
                color={index === 0 ? "#d0a064" : "#a66d3c"}
                metalness={0.7}
                roughness={0.34}
              />
            </mesh>
          ))}
          <RoundedBox
            position={[0, -1.02, 0]}
            args={[0.2, 0.65, 0.05]}
            radius={0.04}
          >
            <meshStandardMaterial color="#9a6638" metalness={0.55} />
          </RoundedBox>
        </group>
      )}
      {part.visual === "taptic" && (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.18, 0.18, 0.72, 32]} />
          <meshStandardMaterial
            color="#899198"
            metalness={0.88}
            roughness={0.24}
          />
        </mesh>
      )}
      {part.visual === "speaker" && (
        <group position={[0, 0, part.size[2] / 2 + 0.012]}>
          {[-0.22, 0, 0.22].flatMap((x) =>
            [-0.12, 0.12].map((y) => (
              <mesh key={`${x}-${y}`} position={[x, y, 0]}>
                <circleGeometry args={[0.035, 12]} />
                <meshBasicMaterial color="#080b0f" />
              </mesh>
            )),
          )}
        </group>
      )}
      {part.visual === "connector" && (
        <RoundedBox
          position={[0, 0, part.size[2] / 2 + 0.015]}
          args={[part.size[0] * 0.72, part.size[1] * 0.46, 0.035]}
          radius={0.025}
        >
          <meshStandardMaterial
            color="#d0a95f"
            metalness={0.72}
            roughness={0.3}
          />
        </RoundedBox>
      )}
      </group>}
      {labelAllowed && (!isolated || active) && (isolated || (explosion > 15 && (labels || active))) && (
        <Html position={[0, part.size[1] / 2 + 0.22, 0]} center zIndexRange={[5, 0]} className="part-label" style={{ pointerEvents: "none" }}>
          <span className={active ? "active" : ""}>{part.name}</span>
        </Html>
      )}
    </group>
  );
}
function Rig({ view, reset, isolated, reducedMotion, damping }: { view: string; reset: number; isolated: boolean; reducedMotion: boolean; damping: boolean }) {
  const controls = useRef<any>(null);
  const { camera, invalidate } = useThree();
  const selected = useStore((s) => s.selected);
  const expanded = useStore((s) => s.explosion > 35);
  const { width, height } = useThree((s) => s.size);
  const target = useRef(new THREE.Vector3(8, 4, 10));
  const focus = useRef(new THREE.Vector3());
  useEffect(() => {
    const positions: Record<string, number[]> = {
      perspective: [9, 6, 12],
      front: [0, 0, 12],
      back: [0, 0, -12],
      side: [12, 0, 0],
    };
    target.current.set(...(positions[view] as [number, number, number]));
    focus.current.set(0, 0, 0);
    const part = components.find((p) => p.id === selected);
    if (part && !isolated) {
      focus.current.set(
        part.originalPosition[0] * 0.35,
        part.originalPosition[1] * 0.35,
        0,
      );
    }
    if (part && isolated) {
      focus.current.set(0, 0, 0);
      target.current.normalize().multiplyScalar(Math.max(3.5, Math.max(...part.size) * 2.3));
    } else if (!isolated) {
      target.current.normalize().multiplyScalar(expanded ? Math.min(30, Math.max(16.5, 16.5 * height / width)) : 13.4);
    }
  }, [selected, isolated, camera, view, reset, expanded, width, height]);
  const moving = useRef(true);
  useEffect(() => {
    moving.current = true;
    invalidate();
  }, [view, reset, selected, isolated, reducedMotion, expanded, width, height, invalidate]);
  useFrame((_, dt) => {
    if (moving.current && controls.current) {
      const damping = reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
      camera.position.lerp(target.current, damping);
      controls.current.target.lerp(focus.current, damping);
      controls.current.update();
      invalidate();
      if (camera.position.distanceTo(target.current) < 0.02 && controls.current.target.distanceTo(focus.current) < 0.02)
        moving.current = false;
    }
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={damping && !reducedMotion}
      minDistance={2.5}
      maxDistance={32}
      onStart={() => {
        moving.current = false;
      }}
    />
  );
}
export default memo(function Viewer({
  view,
  reset,
  quality,
  detailed = true,
  isolated = false,
  labels = false,
}: {
  view: string;
  reset: number;
  quality: string;
  detailed?: boolean;
  isolated?: boolean;
  labels?: boolean;
}) {
  const [lost, setLost] = useState(false);
  const [modelStatus, setModelStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const modelReady = useCallback(() => setModelStatus("ready"), []);
  const modelFailed = useCallback(() => setModelStatus("fallback"), []);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const renderPart = useCallback((part: PhoneComponent, model?: AssemblyGeometry, key?: string) => (
    <Part key={key ?? part.id} part={part} model={model} isolated={isolated} labels={labels} reducedMotion={reducedMotion} dragged={dragged}
      labelAllowed={!key || !["assembly-01", "assembly-03", "assembly-09"].includes(key)} />
  ), [isolated, labels, reducedMotion]);
  const schematic = components.map((part) => renderPart(part));
  const [supported] = useState(() => {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      context?.getExtension("WEBGL_lose_context")?.loseContext();
      return !!context;
    } catch {
      return false;
    }
  });
  if (!supported || lost)
    return (
      <div className="fallback">
        {lost
          ? "O contexto gráfico foi interrompido."
          : "WebGL não está disponível neste dispositivo."}{" "}
        O diagnóstico e o orçamento continuam disponíveis.{" "}
        <button onClick={() => location.reload()}>
          Recarregar visualizador
        </button>
      </div>
    );
  return (
    <Boundary>
      {detailed && <div className={`model-status ${modelStatus}`} role="status">
        {modelStatus === "loading" ? "Carregando modelo detalhado…" : modelStatus === "ready" ? "Modelo detalhado carregado" : "Modelo indisponível · esquema técnico ativo"}
      </div>}
      <Canvas
        onPointerDownCapture={(event) => {
          pointerDown.current = { x: event.clientX, y: event.clientY };
          dragged.current = false;
        }}
        onPointerUpCapture={(event) => {
          const start = pointerDown.current;
          dragged.current = !!start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4;
          pointerDown.current = null;
        }}
        frameloop="demand"
        shadows={quality === "Alta"}
        dpr={[1, quality === "Alta" ? 2 : 1]}
        camera={{ position: [8, 4, 10], fov: 38 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setLost(true);
          });
          gl.setClearColor("#090e16");
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <hemisphereLight args={["#d9ecff", "#101722", 1.35]} />
        <directionalLight
          position={[4, 8, 5]}
          intensity={2.7}
          castShadow={quality === "Alta"}
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-4, 2, -4]} intensity={22} color="#4c91ff" />
        <pointLight position={[3, -2, 4]} intensity={13} color="#9fe4d1" />
        {detailed ? <ModelBoundary onError={modelFailed} fallback={schematic}>
          <Suspense fallback={schematic}>
            <ImportedPhone renderPart={renderPart} onReady={modelReady} />
          </Suspense>
        </ModelBoundary> : schematic}
        {quality === "Alta" && (
          <ContactShadows
            position={[0, -3.48, 0]}
            opacity={0.32}
            scale={9}
            blur={2.4}
            far={6}
          />
        )}
        <Grid
          position={[0, -3.8, 0]}
          args={[30, 30]}
          cellColor="#263445"
          sectionColor="#35455b"
          fadeDistance={25}
          infiniteGrid
        />
        <Rig view={view} reset={reset} isolated={isolated} reducedMotion={reducedMotion} damping={quality === "Alta"} />
      </Canvas>
    </Boundary>
  );
});
