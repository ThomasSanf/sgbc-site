"""Use the actual C2 carrier, clamp and straps exported by the hardware project."""
from pathlib import Path
import hashlib
import json
import cadquery as cq
import numpy as np
import trimesh

HERE = Path(__file__).resolve().parents[1]
OUT = HERE / 'outputs/cartridge-fit/hardware-c2'
OUT.mkdir(parents=True, exist_ok=True)
GLTF = np.array([[.001,0,0,0],[0,0,.001,0],[0,-.001,0,0],[0,0,0,1]])


def build(case, shells, assembly):
    hardware = case.HERE.parent
    source = hardware / 'cartridge_carrier/cartridge_carrier.kicad_pcb'
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    fit = json.loads((case.OUT / 'cartridge_fit_check.json').read_text())
    electrical = json.loads((hardware / 'cartridge_carrier/outputs/c2_electrical_checks.json').read_text())
    manifest = json.loads((case.OUT / 'case_manifest.json').read_text())
    assert fit['status'] == 'PASS_NOMINAL_GAUGES'
    assert digest == fit['carrier_pcb_sha256'] == electrical['pcb_sha256'] == manifest['source_carrier_sha256']
    assert electrical['native_DRC_violations'] == electrical['native_unconnected'] == electrical['native_ERC_violations'] == 0
    assert all(r['overlap_mm3'] < .001 for r in fit['checks'])
    assert any(n.startswith('carrier_material_') for n in assembly.geometry)
    for name in ['cartridge_socket_retainer','cartridge_ground_straps','cartridge_mount_tabs']:
        assert name in assembly.geometry, name

    # Expose the actual roof-supported cradle only in cutaway view. The closed
    # assembly already has this exact solid fused into its top shell.
    cutaway = case.cartridge_case.fixed_cradle()
    for rail in case.cartridge_rails():
        cutaway = cutaway.union(rail)
    export_part(assembly, 'cartridge_cradle_cutaway', cutaway, (152,152,143,255))

    shell, margin, pcb = case.cartridge_case.cartridge_gauges()
    checks = []
    boxes = {name:shape.val().BoundingBox() for name,shape in shells.items()}
    # The site modifies rear openings. Independently check its final shells
    # against both complete cartridge gauges, leaving native carrier untouched.
    for lift in range(36):
        for label, moving in [('shell_0.2mm_allowance', margin), ('internal_cartridge_PCB', pcb)]:
            moving = moving.translate((0,0,lift))
            mb = moving.val().BoundingBox()
            for name, obstacle in shells.items():
                bb = boxes[name]
                disjoint = any(getattr(mb,a+'min') >= getattr(bb,a+'max') or getattr(bb,a+'min') >= getattr(mb,a+'max') for a in 'xyz')
                overlap = 0 if disjoint else sum(s.Volume() for s in obstacle.intersect(moving).solids().vals())
                checks.append(dict(lift_mm=lift,gauge=label,obstacle=name,overlap_mm3=overlap))
    assert all(r['overlap_mm3'] < .001 for r in checks), [r for r in checks if r['overlap_mm3'] >= .001]
    report = {k:v for k,v in fit.items() if k not in ['checks','status']}
    report.update(status='HARDWARE_C2',
                  scope='Actual routed C2 carrier, native FFC and capacitors, printed clamp and formed ground straps',
                  native_carrier_glb_sha256=hashlib.sha256((hardware/'cartridge_carrier/outputs/cartridge_carrier.glb').read_bytes()).hexdigest(),
                  engagement='Cartridge hollow end descends over the connector; enclosing shell walls and internal PCB clear the carrier and supports',
                  native_electrical_checks=dict(DRC=0,unconnected=0,ERC=0),
                  website_shell_check_count=len(checks),sweep_checks=checks)
    (OUT/'fit-check.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f'Actual carrier C2: {fit["check_count"]} hardware and {len(checks)} website-shell insertion checks pass',flush=True)
    return report, shell


def export_part(assembly,name,shape,color):
    path = OUT/f'{name}.stl'
    cq.exporters.export(shape,str(path),tolerance=.035,angularTolerance=.1)
    mesh = trimesh.load_mesh(path,process=True)
    assert mesh.is_watertight, name
    mesh.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
        baseColorFactor=color,metallicFactor=.08,roughnessFactor=.53))
    mesh.apply_transform(GLTF)
    assembly.add_geometry(mesh,geom_name=name,node_name=name)
