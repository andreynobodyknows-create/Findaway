using System;
using System.Windows.Media;
using System.Windows.Media.Media3D;

namespace DesktopFly.Windows.Rendering;

public static class Geometry3D
{
    public static Material Material(Color color, double specular = .25)
    {
        var group = new MaterialGroup();
        group.Children.Add(new DiffuseMaterial(new SolidColorBrush(color)));
        if (specular > 0)
            group.Children.Add(new SpecularMaterial(new SolidColorBrush(Color.FromArgb(color.A, 235, 235, 235)), 20 + specular * 70));
        return group;
    }

    public static GeometryModel3D Ellipsoid(double rx, double ry, double rz, Color color, double specular = .25,
        int slices = 14, int stacks = 9)
    {
        var mesh = new MeshGeometry3D();
        for (var stack = 0; stack <= stacks; stack++)
        {
            var phi = Math.PI * stack / stacks;
            var sp = Math.Sin(phi);
            var cp = Math.Cos(phi);
            for (var slice = 0; slice <= slices; slice++)
            {
                var theta = 2 * Math.PI * slice / slices;
                var ct = Math.Cos(theta);
                var st = Math.Sin(theta);
                var p = new Point3D(rx * sp * ct, ry * sp * st, rz * cp);
                mesh.Positions.Add(p);
                var n = new Vector3D(p.X / (rx * rx), p.Y / (ry * ry), p.Z / (rz * rz));
                n.Normalize();
                mesh.Normals.Add(n);
                mesh.TextureCoordinates.Add(new System.Windows.Point((double)slice / slices, (double)stack / stacks));
            }
        }
        for (var stack = 0; stack < stacks; stack++)
        for (var slice = 0; slice < slices; slice++)
        {
            var a = stack * (slices + 1) + slice;
            var b = a + slices + 1;
            mesh.TriangleIndices.Add(a); mesh.TriangleIndices.Add(b); mesh.TriangleIndices.Add(a + 1);
            mesh.TriangleIndices.Add(a + 1); mesh.TriangleIndices.Add(b); mesh.TriangleIndices.Add(b + 1);
        }
        return Model(mesh, Material(color, specular));
    }

    public static GeometryModel3D Cylinder(double radius, double length, Color color, int segments = 10)
    {
        var mesh = new MeshGeometry3D();
        for (var ring = 0; ring < 2; ring++)
        {
            var x = ring * length;
            for (var i = 0; i < segments; i++)
            {
                var a = 2 * Math.PI * i / segments;
                mesh.Positions.Add(new Point3D(x, radius * Math.Cos(a), radius * Math.Sin(a)));
                mesh.Normals.Add(new Vector3D(0, Math.Cos(a), Math.Sin(a)));
            }
        }
        for (var i = 0; i < segments; i++)
        {
            var j = (i + 1) % segments;
            mesh.TriangleIndices.Add(i); mesh.TriangleIndices.Add(segments + i); mesh.TriangleIndices.Add(j);
            mesh.TriangleIndices.Add(j); mesh.TriangleIndices.Add(segments + i); mesh.TriangleIndices.Add(segments + j);
        }
        var c0 = mesh.Positions.Count; mesh.Positions.Add(new Point3D(0, 0, 0)); mesh.Normals.Add(new Vector3D(-1, 0, 0));
        var c1 = mesh.Positions.Count; mesh.Positions.Add(new Point3D(length, 0, 0)); mesh.Normals.Add(new Vector3D(1, 0, 0));
        for (var i = 0; i < segments; i++)
        {
            var j = (i + 1) % segments;
            mesh.TriangleIndices.Add(c0); mesh.TriangleIndices.Add(j); mesh.TriangleIndices.Add(i);
            mesh.TriangleIndices.Add(c1); mesh.TriangleIndices.Add(segments + i); mesh.TriangleIndices.Add(segments + j);
        }
        return Model(mesh, Material(color, .15));
    }

    public static GeometryModel3D Wing(double width, double length, Color color)
    {
        var mesh = new MeshGeometry3D();
        const int segments = 24;
        mesh.Positions.Add(new Point3D(0, 0, 0));
        mesh.Normals.Add(new Vector3D(0, 0, 1));
        for (var i = 0; i <= segments; i++)
        {
            var a = Math.PI * 2 * i / segments;
            var x = width * .5 * Math.Cos(a);
            var y = length * .5 * Math.Sin(a) - length * .35;
            mesh.Positions.Add(new Point3D(x, y, 0));
            mesh.Normals.Add(new Vector3D(0, 0, 1));
            if (i > 0) { mesh.TriangleIndices.Add(0); mesh.TriangleIndices.Add(i); mesh.TriangleIndices.Add(i + 1); }
        }
        var mat = Material(color, .55);
        var model = Model(mesh, mat);
        model.BackMaterial = mat;
        return model;
    }

    private static GeometryModel3D Model(MeshGeometry3D mesh, Material material)
        => new(mesh, material) { BackMaterial = material };
}
