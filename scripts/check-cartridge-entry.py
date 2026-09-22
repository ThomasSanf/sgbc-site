"""Historical simplified-gauge diagnostic; NOT a cartridge insertion fit test.

The user's correction establishes that the cartridge shell slides around the
connector body. The blade/channel and custom case placement below do not model
that engagement. Retain the arithmetic only as a rejected diagnostic, never as
evidence that the carrier clears a cartridge or that the socket is the blocker.
"""
from pathlib import Path
import hashlib,json,os,sys,zipfile
import cadquery as cq

SITE=Path(__file__).resolve().parents[1]
CAD=SITE.parent/'gb-fpga-core/hardware/revC/enclosure'
OUT=SITE/'outputs/cartridge-fit'
with zipfile.ZipFile(OUT/'reference/case.FCStd') as archive:
    (OUT/'reference/PartShape.brp').write_bytes(archive.read('PartShape.brp'))
reference=cq.Workplane(obj=cq.Shape.importBrep(str(OUT/'reference/PartShape.brp')))
reference=reference.rotate((0,0,0),(0,1,1),180)
carrier=cq.importers.importStep(str(CAD.parent/'cartridge_carrier/outputs/cartridge_carrier.step'))
carrier=carrier.rotate((0,0,0),(0,1,1),180).translate((32,24.5,38))
socket=cq.Workplane('XY').box(58,4.4,18).translate((0,28.3,25.5))
socket=socket.cut(cq.Workplane('XY').box(51,1.9,15).translate((0,28.3,29)))
blade=cq.Workplane('XY').box(50,1.5,50).translate((0,28.3,48.5))
volume=lambda shape:sum(s.Volume() for s in shape.solids().vals())
report={'status':'REJECTED_INSERTION_ASSUMPTION',
        'valid_for_cartridge_fit':False,
        'correction':'The cartridge shell slides over and around the connector body. This simplified blade/channel placement does not represent that engagement.',
        'scope':'Historical gauge arithmetic only; neither PCB clearance nor the cause of a cartridge collision is established',
        'model_sha256':hashlib.sha256((SITE/'public/models/sgbc-revc.glb').read_bytes()).hexdigest(),
        'carrier_pcb_y_mm':[24.5,26.1],'carrier_pcb_top_z_mm':38,
        'socket_mouth_z_mm':34.5,'socket_channel_y_mm':[27.35,29.25],
        'pcb_above_socket_mouth_mm':3.5,'pcb_to_channel_clearance_mm':1.25,
        'thin_blade_carrier_overlap_mm3':volume(carrier.intersect(blade)),
        'reference_url':'https://github.com/jojolebarjos/gba-cartridge/tree/master/case',
        'reference_limits':'Custom 5 mm case, not an OEM cartridge. Assumed 1 mm case floor + 0.8 mm PCB, aligned inside nominal 1.9 mm channel. No exact selected socket profile.',
        'reference_sweep':[]}
for z in [70,50,40,38,36,34.5,33,31,29,27,25,23.5]:
    moving=reference.translate((0,27.4,z))
    report['reference_sweep'].append({'leading_edge_z_mm':z,
                                    'carrier_overlap_mm3':volume(carrier.intersect(moving)),
                                    'nominal_socket_overlap_mm3':volume(socket.intersect(moving))})
print(json.dumps(report,indent=2),flush=True)
(OUT/'insertion-audit.json').write_text(json.dumps(report,indent=2)+'\n')
sys.stdout.flush();os._exit(0)
