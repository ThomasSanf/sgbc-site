import { Mesh } from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const bordeauxParts = new Set(['reset_button', 'power_button', 'cartridge_lip', 'snes_bezel', 'link_insert', 'link_bezel', 'microSD_access_insert']);

/** Supply the lighting normals omitted by the engineering CAD export. */
export function prepareFinishGeometry(mesh: Mesh) {
  const isBordeaux = bordeauxParts.has(mesh.name);
  const isShell = mesh.name === 'top_shell' || mesh.name === 'bottom_shell' || mesh.name === 'controls_lid_supports_cutaway' || mesh.name === 'cartridge_cradle_cutaway' || mesh.name === 'cartridge_socket_retainer' || mesh.name.startsWith('foot_');
  if (!isBordeaux && !isShell) return;
  if (!mesh.geometry.getAttribute('normal')) {
    const previous = mesh.geometry;
    mesh.geometry = toCreasedNormals(previous, Math.PI / 4);
    if (mesh.geometry !== previous) previous.dispose();
  }
}
