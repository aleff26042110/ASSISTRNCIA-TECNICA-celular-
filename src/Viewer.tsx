import {
  Component,
  Suspense,
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
import { useStore } from "./store";
import type { PhoneComponent } from "./types";
export function GLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene.clone()} />;
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
function Part({ part }: { part: PhoneComponent }) {
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
  const { selected, select, explosion, diagnoses } = useStore();
  useEffect(() => {
    invalidate();
  }, [explosion, selected, diagnoses, invalidate]);
  const active = selected === part.id;
  const faulty = diagnoses[part.id]?.state === "Defeito confirmado";
  useFrame((_, dt) => {
    if (!ref.current) return;
    const progress = THREE.MathUtils.smoothstep(explosion / 100, part.stage, 1);
    target.copy(assembled).lerp(exploded, progress);
    ref.current.position.lerp(target, 1 - Math.exp(-dt * 10));
    if (ref.current.position.distanceTo(target) > 0.001) invalidate();
    ref.current.rotation.y = THREE.MathUtils.lerp(
      ref.current.rotation.y,
      progress * (part.id === "back" ? -0.12 : 0.04),
      1 - Math.exp(-dt * 10),
    );
  });
  const edge = useMemo(() => new THREE.BoxGeometry(...part.size), [part]);
  useEffect(() => () => edge.dispose(), [edge]);
  const camera = part.visual === "camera";
  const showBody = !["frame", "coil"].includes(part.visual);
  return (
    <group
      ref={ref}
      position={part.originalPosition}
      onClick={(e) => {
        e.stopPropagation();
        select(part.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
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
    </group>
  );
}
function Rig({ view, reset }: { view: string; reset: number }) {
  const controls = useRef<any>(null);
  const { camera, invalidate } = useThree();
  const selected = useStore((s) => s.selected);
  const target = useRef(new THREE.Vector3(8, 4, 10));
  const focus = useRef(new THREE.Vector3());
  useEffect(() => {
    const positions: Record<string, number[]> = {
      perspective: [8, 4, 10],
      front: [0, 0, 12],
      back: [0, 0, -12],
      side: [12, 0, 0],
    };
    target.current.set(...(positions[view] as [number, number, number]));
    focus.current.set(0, 0, 0);
  }, [view, reset]);
  useEffect(() => {
    const part = components.find((p) => p.id === selected);
    if (part) {
      focus.current.set(
        part.originalPosition[0] * 0.35,
        part.originalPosition[1] * 0.35,
        0,
      );
      target.current.copy(camera.position).multiplyScalar(0.92);
    }
  }, [selected]);
  const moving = useRef(true);
  useEffect(() => {
    moving.current = true;
    invalidate();
  }, [view, reset, selected, invalidate]);
  useFrame((_, dt) => {
    if (moving.current && controls.current) {
      camera.position.lerp(target.current, 1 - Math.exp(-dt * 5));
      controls.current.target.lerp(focus.current, 1 - Math.exp(-dt * 5));
      controls.current.update();
      invalidate();
      if (camera.position.distanceTo(target.current) < 0.02)
        moving.current = false;
    }
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      minDistance={5}
      maxDistance={22}
      onStart={() => {
        moving.current = false;
      }}
    />
  );
}
export default function Viewer({
  view,
  reset,
  quality,
}: {
  view: string;
  reset: number;
  quality: string;
}) {
  const [lost, setLost] = useState(false);
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
      <Canvas
        frameloop="demand"
        shadows={quality !== "Baixa"}
        dpr={[1, quality === "Alta" ? 2 : 1.3]}
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
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-4, 2, -4]} intensity={22} color="#4c91ff" />
        <pointLight position={[3, -2, 4]} intensity={13} color="#9fe4d1" />
        <Suspense fallback={<Html center>Carregando modelo…</Html>}>
          {components.map((part) => (
            <Part key={part.id} part={part} />
          ))}
        </Suspense>
        {quality !== "Baixa" && (
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
        <Rig view={view} reset={reset} />
      </Canvas>
    </Boundary>
  );
}
