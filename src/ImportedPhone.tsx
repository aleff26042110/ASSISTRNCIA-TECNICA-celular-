import { useEffect, useMemo } from "react";
import { Bvh, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { components, phone } from "./data";
import { importedAssemblies } from "./disassembly";
import type { PhoneComponent } from "./types";

export interface AssemblyGeometry {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

export default function ImportedPhone({ renderPart, onReady }: {
  renderPart: (part: PhoneComponent, model?: AssemblyGeometry, key?: string) => React.ReactNode;
  onReady: () => void;
}) {
  const { scene } = useGLTF(phone.glbUrl!, false, false);
  const assemblies = useMemo(() => importedAssemblies.map((assembly) => {
    const mesh = scene.getObjectByName(assembly.mesh) as THREE.Mesh | undefined;
    if (!mesh?.isMesh) throw new Error(`Assembly missing: ${assembly.mesh}`);
    const part = components.find((component) => component.id === assembly.component)!;
    const size = assembly.size ?? part.size;
    const geometry = mesh.geometry.clone();
    const position = geometry.getAttribute("position");
    // Principal direction in X/Z removes the scan's different panel angles.
    // This makes all assemblies align when the phone is put back together.
    let xx = 0, xz = 0, zz = 0;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i);
      xx += x * x; xz += x * z; zz += z * z;
    }
    geometry.rotateY(Math.atan2(2 * xz, xx - zz) / 2);
    geometry.center();
    geometry.computeBoundingBox();
    const extent = geometry.boundingBox!.getSize(new THREE.Vector3());
    geometry.scale(size[0] / extent.x, size[1] / extent.y, size[2] / extent.z);
    geometry.computeBoundingSphere();
    const material = (mesh.material as THREE.MeshStandardMaterial).clone();
    return {
      key: assembly.mesh,
      part: {
        ...part, size,
        originalPosition: assembly.position ?? part.originalPosition,
        explodedPosition: assembly.explodedPosition ?? part.explodedPosition,
        stage: assembly.stage ?? part.stage,
      },
      model: { geometry, material },
    };
  }), [scene]);
  useEffect(() => {
    onReady();
    return () => assemblies.forEach(({ model }) => {
      model.geometry.dispose(); model.material.dispose();
    });
  }, [assemblies, onReady]);
  const mapped = new Set(importedAssemblies.map((assembly) => assembly.component));
  return <Bvh firstHitOnly>
    {assemblies.map(({ part, model, key }) => renderPart(part, model, key))}
    {components.filter((part) => !mapped.has(part.id)).map((part) => renderPart(part))}
  </Bvh>;
}
