import { BufferAttribute, Mesh } from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const marbleParts = new Set(['reset_button', 'power_button', 'cartridge_lip', 'snes_bezel', 'link_insert', 'link_bezel', 'microSD_access_insert']);

/** Supply the normals and UV coordinates omitted by the engineering CAD export. */
export function prepareFinishGeometry(mesh: Mesh) {
  const isMarble = marbleParts.has(mesh.name);
  const isShell = mesh.name === 'top_shell' || mesh.name === 'bottom_shell' || mesh.name.startsWith('foot_');
  if (!isMarble && !isShell) return;
  if (!mesh.geometry.getAttribute('normal')) {
    const previous = mesh.geometry;
    mesh.geometry = toCreasedNormals(previous, Math.PI / 4);
    if (mesh.geometry !== previous) previous.dispose();
  }
  if (!isMarble) return;
  const positions = mesh.geometry.getAttribute('position');
  const normals = mesh.geometry.getAttribute('normal');
  const uv = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    const nx = Math.abs(normals.getX(i));
    const ny = Math.abs(normals.getY(i));
    const nz = Math.abs(normals.getZ(i));
    // Dominant-plane projection in the model's original millimetre coordinates.
    uv[i * 2] = (nx > ny && nx > nz ? positions.getY(i) : positions.getX(i)) / 44;
    uv[i * 2 + 1] = (nz >= nx && nz >= ny ? positions.getY(i) : positions.getZ(i)) / 44;
  }
  mesh.geometry.setAttribute('uv', new BufferAttribute(uv, 2));
}
