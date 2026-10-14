import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { MeshoptSimplifier } from "meshoptimizer";

// The supplied scan is a single mesh of an already exploded phone. Weld UV
// seams to recover its disconnected assemblies, then simplify each separately.
const input = resolve(process.argv[2] ?? "research/iphone-15/assets/smartphone-source.glb");
const output = resolve(process.argv[3] ?? "public/models/smartphone-disassembly.glb");
const source = await readFile(input);
if (source.readUInt32LE(0) !== 0x46546c67 || source.readUInt32LE(4) !== 2)
  throw new Error("Expected a binary glTF 2.0 model.");
const jsonLength = source.readUInt32LE(12);
const original = JSON.parse(source.toString("utf8", 20, 20 + jsonLength));
const binary = source.subarray(28 + jsonLength);
globalThis.self = globalThis;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
loader.register(() => ({ name: "GeometryOnly", loadTexture: () => Promise.resolve(null) }));
const gltf = await loader.parseAsync(
  source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), "",
);
let geometry;
gltf.scene.traverse((object) => {
  if (object.isMesh) {
    if (geometry) throw new Error("This preparation expects the supplied single-mesh scan.");
    geometry = object.geometry;
  }
});
if (!geometry?.index) throw new Error("The model must have indexed geometry.");
const position = geometry.getAttribute("position");
const normal = geometry.getAttribute("normal");
const uv = geometry.getAttribute("uv");
const indices = geometry.index.array;
const parents = Uint32Array.from({ length: position.count }, (_, i) => i);
const ranks = new Uint8Array(position.count);
function find(vertex) {
  while (parents[vertex] !== vertex) {
    parents[vertex] = parents[parents[vertex]];
    vertex = parents[vertex];
  }
  return vertex;
}
function union(a, b) {
  a = find(a); b = find(b);
  if (a === b) return;
  if (ranks[a] < ranks[b]) [a, b] = [b, a];
  parents[b] = a;
  if (ranks[a] === ranks[b]) ranks[a]++;
}
const welded = new Map();
for (let i = 0; i < position.count; i++) {
  const key = [position.getX(i), position.getY(i), position.getZ(i)]
    .map((value) => Math.round(value * 100000)).join(",");
  if (welded.has(key)) union(i, welded.get(key));
  else welded.set(key, i);
}
for (let i = 0; i < indices.length; i += 3) {
  union(indices[i], indices[i + 1]); union(indices[i], indices[i + 2]);
}
const islands = new Map();
for (let i = 0; i < indices.length; i += 3) {
  const root = find(indices[i]);
  if (!islands.has(root)) islands.set(root, []);
  islands.get(root).push(indices[i], indices[i + 1], indices[i + 2]);
}
const sorted = [...islands.values()].sort((a, b) => b.length - a.length);
if (sorted.length !== 15)
  throw new Error(`Expected the supplied model's 15 assemblies, found ${sorted.length}.`);

await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;
const chunks = [];
let byteLength = 0;
const document = {
  asset: { version: "2.0", generator: "CellVision assembly preparation" },
  scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], accessors: [],
  bufferViews: [], buffers: [], images: [], textures: original.textures,
  samplers: original.samplers, materials: original.materials,
};
function append(data, target) {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const view = document.bufferViews.length;
  document.bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: buffer.length, ...(target ? { target } : {}) });
  chunks.push(buffer);
  const padding = (4 - buffer.length % 4) % 4;
  if (padding) chunks.push(Buffer.alloc(padding));
  byteLength += buffer.length + padding;
  return view;
}
function accessor(data, type, componentType, bounds) {
  const index = document.accessors.length;
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type];
  document.accessors.push({ bufferView: append(data, type === "SCALAR" ? 34963 : 34962), componentType, count: data.length / width, type, ...bounds });
  return index;
}
// Copy embedded textures byte-for-byte; no texture fetching or remote decoder.
for (const image of original.images) {
  const view = original.bufferViews[image.bufferView];
  const data = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  document.images.push({ ...image, bufferView: append(data) });
}
let triangleCount = 0;
for (const [island, inputIndices] of sorted.entries()) {
  const localIndices = new Uint32Array(inputIndices);
  const [remap, vertexCount] = MeshoptSimplifier.compactMesh(localIndices);
  const positions = new Float32Array(vertexCount * 3);
  const attributes = new Float32Array(vertexCount * 5);
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < remap.length; i++) {
    if (remap[i] === 0xffffffff) continue;
    const dest = remap[i];
    for (let axis = 0; axis < 3; axis++) {
      const value = position.getComponent(i, axis);
      positions[dest * 3 + axis] = value;
      attributes[dest * 5 + axis] = normal.getComponent(i, axis);
      minimum[axis] = Math.min(minimum[axis], value);
      maximum[axis] = Math.max(maximum[axis], value);
    }
    attributes[dest * 5 + 3] = uv.getX(i);
    attributes[dest * 5 + 4] = uv.getY(i);
  }
  const center = minimum.map((value, axis) => (value + maximum[axis]) / 2);
  const target = Math.max(3000, Math.floor(localIndices.length * 0.075 / 3) * 3);
  const [simplified, error] = MeshoptSimplifier.simplifyWithAttributes(
    localIndices, positions, 3, attributes, 5, [0.1, 0.1, 0.1, 1, 1], null,
    Math.min(target, localIndices.length), 0.005,
  );
  const [finalRemap, finalCount] = MeshoptSimplifier.compactMesh(simplified);
  const finalPositions = new Float32Array(finalCount * 3);
  const finalNormals = new Float32Array(finalCount * 3);
  const finalUvs = new Float32Array(finalCount * 2);
  for (let i = 0; i < finalRemap.length; i++) {
    if (finalRemap[i] === 0xffffffff) continue;
    const dest = finalRemap[i];
    for (let axis = 0; axis < 3; axis++) {
      finalPositions[dest * 3 + axis] = positions[i * 3 + axis] - center[axis];
      finalNormals[dest * 3 + axis] = attributes[i * 5 + axis];
    }
    finalUvs.set(attributes.subarray(i * 5 + 3, i * 5 + 5), dest * 2);
  }
  // Accessor bounds reflect the final geometry, including simplification.
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < finalPositions.length; i++) {
    const axis = i % 3;
    min[axis] = Math.min(min[axis], finalPositions[i]);
    max[axis] = Math.max(max[axis], finalPositions[i]);
  }
  const name = `assembly-${String(island).padStart(2, "0")}`;
  document.scenes[0].nodes.push(island);
  document.nodes.push({ name, mesh: island, translation: center, extras: { island, sourceCenter: center } });
  document.meshes.push({ name, primitives: [{ attributes: {
    POSITION: accessor(finalPositions, "VEC3", 5126, { min, max }),
    NORMAL: accessor(finalNormals, "VEC3", 5126),
    TEXCOORD_0: accessor(finalUvs, "VEC2", 5126),
  }, indices: accessor(simplified, "SCALAR", 5125), material: 0 }] });
  triangleCount += simplified.length / 3;
  console.log(`${name}: ${inputIndices.length / 3} → ${simplified.length / 3} triangles (error ${error.toFixed(5)})`);
}
document.buffers.push({ byteLength });
const json = Buffer.from(JSON.stringify(document));
const paddedJson = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + paddedJson.length + byteLength, 8);
header.writeUInt32LE(paddedJson.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(byteLength, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
await mkdir(dirname(output), { recursive: true });
const result = Buffer.concat([header, paddedJson, binaryHeader, ...chunks]);
await writeFile(output, result);
console.log(`Saved ${output}: ${triangleCount} triangles, ${(result.length / 1048576).toFixed(2)} MiB (source: ${(source.length / 1048576).toFixed(2)} MiB).`);
