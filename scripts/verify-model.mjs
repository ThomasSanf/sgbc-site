import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Mesh, Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { marbleParts, prepareFinishGeometry } from '../lib/console-materials.ts';

const data = fs.readFileSync(new URL('../public/models/sgbc-revc.glb', import.meta.url));
const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
let textured = 0;
const names = new Set();
gltf.scene.traverse(mesh => {
  if (!(mesh instanceof Mesh)) return;
  names.add(mesh.name);
  prepareFinishGeometry(mesh);
  if (!marbleParts.has(mesh.name) && !['bottom_shell', 'top_shell'].includes(mesh.name)) return;
  const normal = mesh.geometry.getAttribute('normal');
  assert(normal, `${mesh.name}: lighting normals exist`);
  assert(normal.count === mesh.geometry.getAttribute('position').count);
  assert(Array.from(normal.array).every(Number.isFinite));
  if (marbleParts.has(mesh.name)) {
    const uv = mesh.geometry.getAttribute('uv');
    assert(uv && uv.count === normal.count, `${mesh.name}: texture coordinates exist`);
    assert(Array.from(uv.array).every(Number.isFinite));
    textured++;
  }
});
for (const name of ['bottom_shell', 'top_shell', ...marbleParts]) assert(names.has(name), name);
assert.equal(textured, 7);
const bounds = new Box3().setFromObject(gltf.scene).getSize(new Vector3());
assert(bounds.x > 0.14 && bounds.x < 0.16, 'Correct physical model scale');
assert(fs.statSync(new URL('../public/textures/bordeaux-marble.png', import.meta.url)).size > 0);
console.log(`Verified actual CAD loading, both shell surfaces, ${textured} marble surfaces, texture mapping, and physical dimensions.`);
