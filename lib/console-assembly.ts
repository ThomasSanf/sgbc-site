import { Mesh } from 'three';

/** Remove the roof for inspection, retaining the complete controls mechanism. */
export function setCutawayVisibility(mesh: Mesh, cutaway: boolean) {
  if (mesh.name === 'top_shell' || mesh.name === 'cartridge_lip') {
    mesh.visible = !cutaway;
  } else if (mesh.name === 'controls_lid_supports_cutaway' || mesh.name === 'cartridge_cradle_cutaway' || mesh.name === 'FPGA_package_envelope') {
    mesh.visible = cutaway;
  } else {
    mesh.visible = true;
  }
}
