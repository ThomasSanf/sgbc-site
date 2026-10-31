import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Mesh, Box3, Matrix3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bordeauxParts } from '../lib/console-materials.ts';
import { setCutawayVisibility } from '../lib/console-assembly.ts';

const data = fs.readFileSync(new URL('../public/models/sgbc-revc.glb', import.meta.url));
const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
const finishParts = [
  'bottom_shell', 'top_shell', 'controls_lid_supports_cutaway', 'cartridge_cradle_cutaway',
  'cartridge_socket_retainer', 'foot_1', 'foot_2', 'foot_3', 'foot_4', ...bordeauxParts,
];
gltf.scene.updateMatrixWorld(true);
const names = new Set();
gltf.scene.traverse(mesh => {
  if (!(mesh instanceof Mesh)) return;
  names.add(mesh.name);
  if (!finishParts.includes(mesh.name)) return;
  const normal = mesh.geometry.getAttribute('normal');
  assert(normal, `${mesh.name}: GLB contains authored normals`);
  assert.equal(normal.count, mesh.geometry.getAttribute('position').count);
  for (let i = 0; i < normal.count; i++) {
    assert(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 1e-4,
      `${mesh.name}: invalid normal at vertex ${i}`);
  }
});
for (const name of finishParts) assert(names.has(name), name);
assert.equal(finishParts.length, 16);
const bounds = new Box3().setFromObject(gltf.scene).getSize(new Vector3());
assert(bounds.x > 0.14 && bounds.x < 0.16, 'Correct physical model scale');
const fit = JSON.parse(fs.readFileSync(new URL('../public/models/rear-port-fit.json', import.meta.url), 'utf8'));
assert.equal(createHash('sha256').update(data).digest('hex'), fit.model_sha256);
assert.equal(fit.radial_clearance_mm, 0.25);

// Check known design surfaces in world millimetres. This allows retessellation
// and separate indices at genuine CAD edges; no particular vertex order is assumed.
function checkShellNormals(mesh) {
  const { position, normal } = mesh.geometry.attributes, index = mesh.geometry.index;
  const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld);
  const positions = Array.from({ length: position.count }, (_, i) =>
    new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).multiplyScalar(1000));
  const normals = Array.from({ length: normal.count }, (_, i) =>
    new Vector3().fromBufferAttribute(normal, i).applyNormalMatrix(normalMatrix));
  const rear = new Vector3(0, 0, -1), down = new Vector3(0, -1, 0), intoVent = new Vector3(-1, 0, 0);
  const near = (a, b) => Math.abs(a - b) < .003;
  const sameDirection = (n, target) => n.dot(target) > Math.cos(0.15 * Math.PI / 180);
  let rearArea = 0, minArcAngle = Infinity, maxArcAngle = -Infinity, floorRim = 0, wallRim = 0;

  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
    const pts = ids.map(id => positions[id]);
    const cross = new Vector3().subVectors(pts[1], pts[0]).cross(new Vector3().subVectors(pts[2], pts[0]));
    const area = cross.length() / 2;
    if (!area) continue;
    const face = cross.normalize();
    if (pts.every(p => near(p.z, -fit.rear_panel_y_mm)) && sameDirection(face, rear)) {
      rearArea += area;
      assert(ids.every(id => sameDirection(normals[id], rear)), `${mesh.name}: tilted normal on flat rear panel`);
    }

    // The right rear quarter-cylinder has centre (63, -39.5) and radius
    // 11 mm. Sample its curved side, excluding the flat adjoining lands.
    if (pts.every(p => p.x > 64 && p.z < -40.5 && near(Math.hypot(p.x - 63, p.z + 39.5), 11))
        && Math.abs(face.y) < .001) {
      for (const id of ids) {
        const p = positions[id], radial = new Vector3(p.x - 63, 0, p.z + 39.5).normalize();
        assert(sameDirection(normals[id], radial), `${mesh.name}: faceted or split normal on rounded outer corner`);
        const angle = Math.atan2(-radial.z, radial.x) * 180 / Math.PI;
        minArcAngle = Math.min(minArcAngle, angle);
        maxArcAngle = Math.max(maxArcAngle, angle);
      }
    }

    // At the central bottom vent the right wall and the underside meet at
    // x=1.5, y=0. Both must keep their own perpendicular normal at the rim.
    if (mesh.name === 'bottom_shell') {
      const rim = ids.filter(id => {
        const p = positions[id];
        return near(p.x, 1.5) && near(p.y, 0) && p.z >= -8.603 && p.z <= 12.603;
      });
      if (rim.length !== 2) continue;
      const span = Math.abs(positions[rim[0]].z - positions[rim[1]].z);
      if (sameDirection(face, down)) {
        assert(rim.every(id => sameDirection(normals[id], down)), 'Floor normal bleeds into vent wall');
        floorRim += span;
      } else if (sameDirection(face, intoVent)) {
        assert(rim.every(id => sameDirection(normals[id], intoVent)), 'Vent wall normal bleeds into floor');
        wallRim += span;
      }
    }
  }
  assert(rearArea > 100, `${mesh.name}: checked the exterior rear panel`);
  assert(maxArcAngle - minArcAngle > 45, `${mesh.name}: checked the full curved span of the outer corner`);
  if (mesh.name === 'bottom_shell') assert(floorRim > 20 && wallRim > 20, 'Checked both surfaces along the vent rim');
}
for (const name of ['top_shell', 'bottom_shell']) checkShellNormals(gltf.scene.getObjectByName(name));

for (const port of Object.values(fit.ports)) {
  const portBounds = new Box3();
  gltf.scene.traverse(mesh => {
    if (mesh instanceof Mesh && mesh.name.startsWith(`rear_${port.name}_material_`)) {
      portBounds.union(new Box3().setFromObject(mesh));
    }
  });
  assert(!portBounds.isEmpty(), `${port.name}: connector geometry exists`);
  assert(Math.abs(-portBounds.min.z * 1000 - port.face_y_mm) < 0.001, `${port.name}: face sits flush with rear shell`);
}
const reset = gltf.scene.getObjectByName('reset_button');
const power = gltf.scene.getObjectByName('power_button');
const resetTop = new Box3().setFromObject(reset).max.y;
const powerTop = new Box3().setFromObject(power).max.y;
assert(Math.abs(resetTop - powerTop) < 0.00001, 'Released button caps have the same height');
assert(Math.abs(resetTop * 1000 - 36.9) < 0.01, 'Button caps retain their CAD roof elevation');
const controlsPCB = fs.readFileSync(new URL('../../gb-fpga-core/hardware/revC/controls_board/controls_board.kicad_pcb', import.meta.url));
assert.equal(fit.controls.pcb_sha256, createHash('sha256').update(controlsPCB).digest('hex'));
assert.equal(fit.controls.revision, 'C2');
assert.equal(fit.controls.switch_mpn_both, 'KSC623G LFG');
assert.equal(fit.controls.native_switch_geometry_identical, true);
assert.equal(fit.controls.motion_check_count, 128); // 126 obstacle checks plus two actuation margins.
for (const volume of Object.values(fit.controls.cap_and_tip_symmetric_difference_mm3)) assert(volume < 1e-6);
for (const suffix of ['_button', '_contact_tip_TPU']) {
  const normalized = ['power', 'reset'].map(prefix => {
    const part = gltf.scene.getObjectByName(prefix + suffix);
    const center = new Box3().setFromObject(part).getCenter(new Vector3());
    const position = part.geometry.getAttribute('position');
    const vertices = [];
    for (let i = 0; i < position.count; i++) {
      const v = new Vector3().fromBufferAttribute(position, i).applyMatrix4(part.matrixWorld).sub(center);
      vertices.push(v);
    }
    return vertices;
  });
  // B-rep face boundaries may duplicate positions to carry different normals.
  // Compare both translated position sets, independent of that duplication.
  for (const [a, b] of [[normalized[0], normalized[1]], [normalized[1], normalized[0]]]) {
    for (const v of a) assert(b.some(w => v.distanceToSquared(w) < 1e-14), `${suffix}: identical translated geometry`);
  }
}
const supports = gltf.scene.getObjectByName('controls_lid_supports_cutaway');
assert(supports instanceof Mesh, 'Actual lid supports are present for the cutaway');
assert(supports.geometry.getAttribute('normal'), 'Cutaway supports have lighting normals');
let controlsMeshes = 0;
for (const cutaway of [true, false, true]) {
  gltf.scene.traverse(mesh => {
    if (!(mesh instanceof Mesh)) return;
    setCutawayVisibility(mesh, cutaway);
    if (mesh.name.startsWith('controls_material_')) {
      assert(mesh.visible, 'Controls PCB and switches remain visible with their mechanisms');
      if (cutaway) controlsMeshes++;
    }
  });
  assert.equal(gltf.scene.getObjectByName('top_shell').visible, !cutaway);
  assert.equal(supports.visible, cutaway, 'Supports appear only when their containing roof is removed');
  for (const name of ['reset_button', 'power_button', 'reset_contact_tip_TPU', 'power_contact_tip_TPU',
    'button_retainer', 'D1_LED_spacer', 'D2_LED_spacer', 'controls_M2x8_1', 'controls_M2x8_4',
    'controls_retainer_M2x6_1', 'controls_retainer_M2x6_2', 'snes_bezel', 'link_bezel']) {
    assert(gltf.scene.getObjectByName(name).visible, `${name}: remains assembled in every view`);
  }
}
assert(controlsMeshes > 0, 'Native controls PCB meshes were checked');
const loader = fit.cartridge_loader;
assert.equal(loader.status, 'HARDWARE_C2');
const pcb = fs.readFileSync(new URL('../../gb-fpga-core/hardware/revC/cartridge_carrier/cartridge_carrier.kicad_pcb', import.meta.url));
assert.equal(createHash('sha256').update(pcb).digest('hex'), loader.carrier_pcb_sha256);
const carrierBounds = new Box3();
gltf.scene.traverse(mesh => {
  if (mesh instanceof Mesh && mesh.name.startsWith('carrier_material_')) carrierBounds.union(new Box3().setFromObject(mesh));
});
assert(!carrierBounds.isEmpty(), 'Actual routed KiCad carrier meshes are present');
assert(Math.abs(carrierBounds.max.y * 1000 - 25.2) < .01, 'Actual carrier stops below the seated wrapping shell');
assert(loader.shell_bottom_z_mm - carrierBounds.max.y * 1000 > .99, 'At least 1 mm nominal carrier-to-shell vertical clearance');
assert(loader.old_board_overlap_mm3 > 0, 'Wrapping-shell gauge detects the original obstruction');
assert(!names.has('cartridge_carrier_PCB_revised'), 'Superseded presentation-only PCB is absent');
assert.equal(loader.check_count, 936);
assert.equal(loader.website_shell_check_count, 144);
for (const name of ['cartridge_socket_retainer', 'cartridge_ground_straps', 'cartridge_mount_tabs', 'cartridge_retainer_M2x6_1', 'cartridge_retainer_M2x6_2']) {
  assert(names.has(name), `${name}: actual C2 mounting hardware is present`);
  for (const cutaway of [true,false]) {
    const part = gltf.scene.getObjectByName(name);
    setCutawayVisibility(part,cutaway);
    assert(part.visible, `${name}: remains assembled in both views`);
  }
}
const cradle = gltf.scene.getObjectByName('cartridge_cradle_cutaway');
assert(cradle instanceof Mesh, 'Load-bearing socket cradle is present');
for (const cutaway of [false,true]) {
  setCutawayVisibility(cradle,cutaway);
  assert.equal(cradle.visible,cutaway, 'Cradle is shown separately only with the roof removed');
}
console.log('Verified authored finish normals, flat rear panels, smooth outer corners, sharp vent rim, controls C2 parts, rear ports, C2 carrier and PCB fit, and cutaway visibility.');
