"""Tessellate a CAD part for display, keeping the normals of its design surfaces."""

import cadquery as cq
import numpy as np
import trimesh
from OCP.BRep import BRep_Tool
from OCP.BRepLib import BRepLib_ToolTriangulatedShape
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.TopAbs import TopAbs_REVERSED
from OCP.TopLoc import TopLoc_Location


def surface_mesh(shape, tolerance=.06, angular_tolerance=.12):
    """Return an indexed trimesh in CAD millimetres, using OCCT's surface normals.

    Indices are shared within each B-rep face, not across its boundaries. At a
    sharp edge the two faces keep distinct normals; tangent fillets still meet
    with matching normals because both are evaluated on the actual surfaces.
    """
    if isinstance(shape, cq.Workplane):
        parts = shape.vals()
        shape = parts[0] if len(parts) == 1 else cq.Compound.makeCompound(parts)
    # Match CadQuery's STL exporter: relative linear/angular deflection, with
    # positions taken directly from the same tessellation instead of via STL.
    BRepMesh_IncrementalMesh(shape.wrapped, tolerance, True, angular_tolerance, True)
    vertices, normals, triangles = [], [], []
    for face in shape.Faces():
        location = TopLoc_Location()
        poly = BRep_Tool.Triangulation_s(face.wrapped, location)
        if poly is None or not poly.HasUVNodes():
            raise ValueError('CAD face lacks a UV triangulation')
        # OCCT evaluates the surface at each triangulation UV, including at
        # singularities. These vectors use the underlying (forward) surface's
        # orientation and the triangulation's local coordinate system.
        BRepLib_ToolTriangulatedShape.ComputeNormals_s(face.wrapped, poly)
        trsf = location.Transformation()
        reverse = face.wrapped.Orientation() == TopAbs_REVERSED
        offset = len(vertices)
        for index in range(1, poly.NbNodes() + 1):
            vertices.append(poly.Node(index).Transformed(trsf).Coord())
            n = poly.Normal(index).Transformed(trsf)
            normals.append((n.Reversed() if reverse else n).Coord())
        for triangle in poly.Triangles():
            a, b, c = triangle.Get()
            if reverse:
                b, c = c, b
            triangles.append((offset + a - 1, offset + b - 1, offset + c - 1))

    normals = np.asarray(normals)
    if not triangles or not np.allclose(np.linalg.norm(normals, axis=1), 1, atol=1e-6):
        raise ValueError('CAD tessellation has no triangles or invalid surface normals')
    mesh = trimesh.Trimesh(vertices=vertices, faces=triangles,
                           vertex_normals=normals, process=False)
    # A solid is closed across CAD faces even though the render mesh uses
    # separate indices for their normals. Weld a copy for the topology check.
    solid = mesh.copy()
    solid.merge_vertices(merge_norm=True)
    if not solid.is_watertight:
        raise ValueError('CAD surface mesh is not closed')
    return mesh
