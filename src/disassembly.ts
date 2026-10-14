import type { Vec3 } from "./types";

export const disassemblySteps = [
  { value: 0, label: "Montado", description: "Aparelho montado" },
  { value: 25, label: "Abrir", description: "Tela e vidro traseiro afastados" },
  { value: 60, label: "Internos", description: "Bateria e conjuntos internos expostos" },
  { value: 100, label: "Separar", description: "Componentes separados para inspeção" },
] as const;

export function partProgress(explosion: number, stage: number, duration = 0.32) {
  const progress = Math.max(0, Math.min(1, (explosion / 100 - stage) / duration));
  return progress * progress * (3 - 2 * progress);
}

// Semantic assignments are illustrative: the supplied scan is not a CAD model
// or a certified iPhone 15 teardown. Multiple surfaces belong to one assembly.
export interface ImportedAssembly {
  mesh: string;
  component: string;
  size?: Vec3;
  position?: Vec3;
  explodedPosition?: Vec3;
  stage?: number;
}

export const importedAssemblies: ImportedAssembly[] = [
  { mesh: "assembly-00", component: "frame", size: [2.72, 5.48, 0.09], position: [0, 0, -0.07], explodedPosition: [0.15, 0, -0.75], stage: 0.12 },
  { mesh: "assembly-01", component: "frame", size: [2.72, 5.48, 0.09], position: [0, 0, 0.07], explodedPosition: [0.15, 0, 0.65], stage: 0.12 },
  { mesh: "assembly-02", component: "back", explodedPosition: [3.2, 0, -2.4] },
  { mesh: "assembly-03", component: "screen", size: [1.4, 5.1, 0.04], position: [-0.55, 0, 0.16], explodedPosition: [-3.75, 0, 1.68] },
  { mesh: "assembly-04", component: "wireless-coil", size: [1.7, 4.2, 0.08] },
  { mesh: "assembly-05", component: "board" },
  { mesh: "assembly-06", component: "screen", explodedPosition: [-3.2, 0, 1.85] },
  { mesh: "assembly-07", component: "battery" },
  { mesh: "assembly-08", component: "connector", size: [0.38, 3.8, 0.045], position: [0.57, 0.15, 0.14], explodedPosition: [2.65, 0.1, 0.3] },
  { mesh: "assembly-09", component: "screen", size: [1.05, 4.9, 0.035], position: [0.7, 0, 0.16], explodedPosition: [-2.5, 0, 1.68] },
  { mesh: "assembly-10", component: "main-camera", size: [0.78, 1.32, 0.28] },
  { mesh: "assembly-11", component: "ultra-camera" },
  { mesh: "assembly-12", component: "usb" },
  { mesh: "assembly-13", component: "taptic" },
  { mesh: "assembly-14", component: "bottom-speaker" },
];
