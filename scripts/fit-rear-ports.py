"""Build the website's close-fitting rear-port design variant from Rev C CAD.

Run with ../.tools/case-env/Scripts/python.exe from the site directory.
Engineering PCB, STEP and printable enclosure files are input-only.
"""
from pathlib import Path
import hashlib
import json
import os
import sys

import cadquery as cq
import numpy as np
from scipy.spatial import ConvexHull
import trimesh
import cartridge_loader

SITE = Path(__file__).resolve().parents[1]
CAD = SITE.parent / 'gb-fpga-core/hardware/revC/enclosure'
OUT = SITE / 'outputs/port-fit'
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(CAD))
import generate_case as case

REAR = 50.5
PROJECTION = 0.10
CLEARANCE = 0.25
REFERENCES = {'J1': 'usb_c', 'J500': 'hdmi'}
WORLD = np.array([[1000,0,0,-65],[0,0,-1000,47.5],[0,1000,0,6],[0,0,0,1]])
GLTF = np.array([[.001,0,0,0],[0,0,.001,0],[0,-.001,0,0],[0,0,0,1]])


def component_ref(scene, node):
    while node in scene.graph.transforms.parents:
        if node in REFERENCES:
            return node
        node = scene.graph.transforms.parents[node]
    return None


def rgba(mesh):
    material = mesh.visual.material
    color = getattr(material, 'baseColorFactor', None)
    return tuple(int(v) for v in (color if color is not None else material.main_color))


def offset_convex(points, distance):
    """Offset a CCW convex polygon by intersecting its outward parallel edges."""
    points = np.asarray(points)
    edges = np.roll(points, -1, axis=0) - points
    normals = np.column_stack((edges[:, 1], -edges[:, 0]))
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    constants = np.sum(normals * points, axis=1) + distance
    return np.array([np.linalg.solve(np.array([normals[i-1], normals[i]]),
                                    np.array([constants[i-1], constants[i]]))
                     for i in range(len(points))])


def main():
    native = trimesh.load(CAD / 'output/console_revC_native.glb', force='scene')
    batches = {}
    ports = {ref: [] for ref in REFERENCES}
    for node in native.graph.nodes_geometry:
        transform, geometry = native.graph[node]
        mesh = native.geometry[geometry].copy()
        mesh.apply_transform(WORLD @ transform)
        ref = component_ref(native, node)
        if ref:
            ports[ref].append(mesh)
        batches.setdefault((ref, rgba(mesh)), []).append(mesh)

    cuts = {}
    report = {'scope': 'Rear ports are a website presentation variant; cartridge and identical-button controls import routed C2 hardware',
              'rear_panel_y_mm': REAR, 'radial_clearance_mm': CLEARANCE,
              'connector_projection_mm': PROJECTION, 'ports': {}}
    controls_sha = hashlib.sha256((CAD.parent/'controls_board/controls_board.kicad_pcb').read_bytes()).hexdigest()
    electrical = json.loads((CAD.parent/'controls_board/outputs/c2_electrical_checks.json').read_text())
    manifest = json.loads((CAD/'output/case_manifest.json').read_text())
    identity = json.loads((CAD/'output/identical_buttons_check.json').read_text())
    motion = json.loads((CAD/'output/controls_fit_check.json').read_text())
    assert electrical['controls_sha256'] == manifest['controls']['pcb_sha256'] == controls_sha
    assert identity['controls_pcb_sha256'] == motion['controls_pcb_sha256'] == controls_sha
    assert identity['native_glb_sha256'] == hashlib.sha256((CAD.parent/'controls_board/outputs/controls_board.glb').read_bytes()).hexdigest()
    assert identity['native_switch_geometry_identical'] and identity['status'] == 'PASS'
    assert all(row['intersection_mm3'] < .01 for row in motion['checks'])
    report['controls'] = {'revision':'C2','pcb_sha256':controls_sha,
                          'switch_mpn_both':identity['switch_mpn_both'],
                          'native_switch_geometry_identical':True,
                          'cap_and_tip_symmetric_difference_mm3':identity['CAD_symmetric_difference_mm3'],
                          'motion_check_count':len(motion['checks']),
                          'power_controller':'LTC2950ITS8-1#TRMPBF',
                          'native_switches':identity['switches']}
    for ref, meshes in ports.items():
        vertices = np.vstack([mesh.vertices for mesh in meshes])
        face_y = float(vertices[:, 1].max())
        points = np.unique(np.round(vertices[vertices[:, 1] > face_y-.025][:, [0, 2]], 4), axis=0)
        profile = points[ConvexHull(points).vertices]
        opening = offset_convex(profile, CLEARANCE)
        outline = opening.tolist()
        cuts[REFERENCES[ref]] = cq.Workplane('XZ').polyline(outline).close().extrude(6, both=True).translate((0, REAR, 0))
        shift = REAR + PROJECTION - face_y
        for mesh in meshes:
            mesh.apply_translation((0, shift, 0))
        report['ports'][ref] = {'name': REFERENCES[ref], 'outward_shift_mm': shift,
                              'face_y_mm': REAR + PROJECTION,
                              'opening_bounds_xz_mm': [*opening.min(axis=0), *opening.max(axis=0)],
                              'opening_profile_xz_mm': outline}

    case.cutouts = [(name, cuts.get(name, cutter)) for name, cutter in case.all_port_cuts()]
    print('Building fitted rear openings in both shells', flush=True)
    shells = {'bottom_shell': case.build_bottom(), 'top_shell': case.build_top()}
    assembly = trimesh.load(CAD / 'output/SGBC_RevC_colored.glb', force='scene')
    checks = []
    cartridge_report, cartridge_gauge = cartridge_loader.build(case, shells, assembly)
    report['cartridge_loader'] = {k:v for k,v in cartridge_report.items() if k != 'sweep_checks'}
    checks.append('Lower carrier clears the full wrapping-cartridge design gauge')
    for name, shape in shells.items():
        assert shape.val().isValid(), name
        assert len(shape.solids().vals()) == 1, name
        path = OUT / f'{name}.stl'
        cq.exporters.export(shape, str(path), tolerance=.06, angularTolerance=.12)
        mesh = trimesh.load_mesh(path, process=True)
        assert mesh.is_watertight, name
        mesh.apply_transform(GLTF)
        _, geometry = assembly.graph[name]
        mesh.visual = assembly.geometry[geometry].visual.copy()
        # Existing CAD nodes inherit the mm-to-m transform. The replacement
        # geometry already has that transform baked in, so reset the node.
        assembly.geometry[geometry] = mesh
        assembly.graph.update(frame_to=name, frame_from=assembly.graph.base_frame,
                              matrix=np.eye(4), geometry=geometry)

    # Retain the actual lid's four PCB posts and two retainer posts when the
    # viewer removes the roof. The 0.01 mm offset excludes the roof itself.
    support_region = case.block(60, 32, 14.49, 26, -26.5, 25.245)
    supports = shells['top_shell'].intersect(support_region)
    assert len(supports.solids().vals()) == 6, 'Four PCB posts and two retainer posts'
    support_path = OUT / 'controls_lid_supports_cutaway.stl'
    cq.exporters.export(supports, str(support_path), tolerance=.06, angularTolerance=.12)
    mesh = trimesh.load_mesh(support_path, process=True)
    assert mesh.is_watertight, 'Controls supports'
    mesh.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
        name='controls_lid_supports_material', baseColorFactor=[152,152,143,255],
        metallicFactor=0, roughnessFactor=.49))
    mesh.apply_transform(GLTF)
    assembly.add_geometry(mesh, geom_name='controls_lid_supports_cutaway', node_name='controls_lid_supports_cutaway')
    checks.append('Cutaway retains all six actual lid mounting posts')

    # Check the entire close-fitting perimeter, including the old exposed-PCB
    # gap below each port. Sample inside the wall to avoid boundary tolerances.
    solids = [shape.val() for shape in shells.values()]
    for ref, port in report['ports'].items():
        opening = np.array(port['opening_profile_xz_mm'])
        perimeter = offset_convex(opening, .35)
        samples = [a + t*(b-a) for a,b in zip(perimeter, np.roll(perimeter,-1,axis=0))
                   for t in np.linspace(0, 1, 8, endpoint=False)]
        for x,z in samples:
            assert any(s.isInside(cq.Vector(x, REAR-.15, z), 1e-6) for s in solids), (ref, x, z)
        x,z = opening.mean(axis=0)
        assert not any(s.isInside(cq.Vector(x, REAR-.15, z), 1e-6) for s in solids), ref
        checks.append(f'{ref}: opening clear; shell encloses all {len(samples)} perimeter samples')

    # Rebatch the native board by material, keeping the moved connectors named.
    for name in list(assembly.geometry):
        if name.startswith('native_PCB_material_'):
            assembly.delete_geometry(name)
    for index, ((ref, color), meshes) in enumerate(batches.items()):
        name = f'rear_{REFERENCES[ref]}_material_{index}' if ref else f'native_PCB_material_{index}'
        mesh = trimesh.util.concatenate(meshes)
        mesh.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
            name=f'{name}_material', baseColorFactor=color, metallicFactor=.08, roughnessFactor=.53))
        mesh.apply_transform(GLTF)
        assembly.add_geometry(mesh, geom_name=name, node_name=name)

    destination = SITE / 'public/models/sgbc-revc.glb'
    assembly.export(destination)
    report['checks'] = checks + ['Both shells are valid single solids and watertight meshes']
    report['model_sha256'] = hashlib.sha256(destination.read_bytes()).hexdigest()
    (SITE / 'public/models/rear-port-fit.json').write_text(json.dumps(report, indent=2)+'\n')
    print('\n'.join(report['checks']), flush=True)

    if '--render' in sys.argv:
        render(assembly, controls='--controls' in sys.argv, cartridge='--cartridge' in sys.argv)


def render(assembly, controls=False, cartridge=False):
    import vtk
    # Use the established CAD render helper, without invoking its build/export.
    from vtk.util.numpy_support import numpy_to_vtk, numpy_to_vtkIdTypeArray
    renderer = vtk.vtkRenderer()
    renderer.SetBackground(.96, .96, .945)
    for node in assembly.graph.nodes_geometry:
        if (controls or cartridge) and node in ['top_shell', 'cartridge_lip']:
            continue
        if not controls and node == 'controls_lid_supports_cutaway':
            continue
        if not cartridge and node == 'cartridge_cradle_cutaway':
            continue
        transform, geometry = assembly.graph[node]
        mesh = assembly.geometry[geometry].copy()
        mesh.apply_transform(np.linalg.inv(GLTF) @ transform)
        points = vtk.vtkPoints()
        points.SetData(numpy_to_vtk(mesh.vertices.copy(), deep=True))
        cells = vtk.vtkCellArray()
        packed = np.column_stack((np.full(len(mesh.faces), 3), mesh.faces)).astype(np.int64).ravel()
        cells.ImportLegacyFormat(numpy_to_vtkIdTypeArray(packed, deep=True))
        poly = vtk.vtkPolyData(); poly.SetPoints(points); poly.SetPolys(cells)
        normals = vtk.vtkPolyDataNormals(); normals.SetInputData(poly); normals.SetFeatureAngle(45)
        mapper = vtk.vtkPolyDataMapper(); mapper.SetInputConnection(normals.GetOutputPort())
        actor = vtk.vtkActor(); actor.SetMapper(mapper)
        color = np.array(rgba(mesh)[:3])/255
        if node in ['top_shell', 'controls_lid_supports_cutaway', 'cartridge_cradle_cutaway', 'cartridge_socket_retainer']: color = np.array([152,152,143])/255
        elif node == 'bottom_shell' or node.startswith('foot_'): color = np.array([20,20,22])/255
        elif node in ['reset_button','power_button','cartridge_lip','snes_bezel','link_insert','link_bezel','microSD_access_insert']: color = np.array([89,35,48])/255
        actor.GetProperty().SetColor(*color); actor.GetProperty().SetInterpolationToPhong()
        renderer.AddActor(actor)
    camera = renderer.GetActiveCamera()
    camera.SetPosition(2,260,35); camera.SetFocalPoint(0,0,18); camera.SetViewUp(0,0,1)
    camera.ParallelProjectionOn(); camera.SetParallelScale(33)
    if controls:
        camera.SetPosition(-70,-155,115); camera.SetFocalPoint(28,-26,25)
        camera.SetParallelScale(26)
    if cartridge:
        camera.SetPosition(85,155,95); camera.SetFocalPoint(0,28,26)
        camera.SetParallelScale(27)
    renderer.ResetCameraClippingRange()
    window = vtk.vtkRenderWindow(); window.SetOffScreenRendering(1)
    window.SetSize(1400,850) if (controls or cartridge) else window.SetSize(1600,650)
    window.SetMultiSamples(4); window.AddRenderer(renderer)
    window.Render()
    capture = vtk.vtkWindowToImageFilter(); capture.SetInput(window); capture.Update()
    writer = vtk.vtkPNGWriter(); writer.SetFileName(str(OUT/('cartridge-loader-fixed.png' if cartridge else 'controls-cutaway.png' if controls else 'rear-ports.png')))
    writer.SetInputConnection(capture.GetOutputPort()); writer.Write(); window.Finalize()


if __name__ == '__main__':
    main()
    # Windows OCP teardown can crash after successful CAD operations.
    sys.stdout.flush()
    os._exit(0)
