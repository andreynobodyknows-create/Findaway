using System;
using System.Collections.Generic;
using System.Windows.Media;
using System.Windows.Media.Media3D;

namespace DesktopFly.Windows.Rendering;

public sealed class FlyVisual3D
{
    private sealed class LegVisual
    {
        public required ModelVisual3D Root { get; init; }
        public required double BaseYaw { get; init; }
        public required double SwingSign { get; init; }
        public required double Phase { get; init; }
        public required bool IsFront { get; init; }
        public required Point3D Attach { get; init; }
        public double Angle { get; set; }
        public double Lift { get; set; }
    }

    public ModelVisual3D Root { get; } = new();
    public double GaitPhase { get; set; }
    private readonly List<LegVisual> _legs = [];
    private readonly ModelVisual3D _wingL;
    private readonly ModelVisual3D _wingR;
    private readonly ModelVisual3D _blurL;
    private readonly ModelVisual3D _blurR;
    private readonly GeometryModel3D _abdomen;
    private readonly ModelVisual3D _shadow;
    private double _wingRaise;
    private double _flapPhase;
    private double _time;

    public FlyVisual3D()
    {
        var body = new Model3DGroup();
        var brown = Color.FromRgb(128, 97, 56);
        var darkBrown = Color.FromRgb(82, 58, 35);
        var eyeRed = Color.FromRgb(158, 25, 18);

        body.Children.Add(Placed(Geometry3D.Ellipsoid(4.4, 5.2, 3.8, brown, .35), 0, 2.5, 6.2));
        _abdomen = Geometry3D.Ellipsoid(4.5, 7.5, 3.75, Color.FromRgb(184, 140, 82), .28);
        body.Children.Add(Placed(_abdomen, 0, -6.5, 5.6));
        body.Children.Add(Placed(Geometry3D.Ellipsoid(3.0, 2.55, 2.7, Color.FromRgb(148, 115, 72), .28), 0, 9.0, 6.0));
        body.Children.Add(Placed(Geometry3D.Ellipsoid(1.6, 2.0, 2.3, eyeRed, .9), -2.1, 9.7, 6.4));
        body.Children.Add(Placed(Geometry3D.Ellipsoid(1.6, 2.0, 2.3, eyeRed, .9), 2.1, 9.7, 6.4));

        foreach (var side in new[] { -1.0, 1.0 })
        {
            var ant = Geometry3D.Cylinder(.16, 2.2, darkBrown, 8);
            var t = new Transform3DGroup();
            t.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(0, 0, 1), side * 20)));
            t.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(1, 0, 0), -65)));
            t.Children.Add(new TranslateTransform3D(side * .9, 11.6, 6.3));
            ant.Transform = t;
            body.Children.Add(ant);
        }
        Root.Content = body;

        var specs = new (double Side, double X, double Y, double Z, double Yaw, double Phase, bool Front, double F, double T, double A)[]
        {
            ( 1,  3.1,  5.3, 4.5,  .95, 0.0, true,  4.2, 4.8, 3.2),
            (-1, -3.1,  5.3, 4.5,  .95, 0.5, true,  4.2, 4.8, 3.2),
            ( 1,  3.7,  2.0, 4.5, -.10, 0.5, false, 4.8, 5.6, 3.8),
            (-1, -3.7,  2.0, 4.5, -.10, 0.0, false, 4.8, 5.6, 3.8),
            ( 1,  3.3, -1.2, 4.5, -.95, 0.0, false, 5.8, 7.0, 4.6),
            (-1, -3.3, -1.2, 4.5, -.95, 0.5, false, 5.8, 7.0, 4.6),
        };
        foreach (var s in specs)
        {
            var baseYaw = s.Side > 0 ? s.Yaw : Math.PI - s.Yaw;
            var leg = BuildLeg(s.X, s.Y, s.Z, baseYaw, s.Side, s.Phase, s.Front, s.F, s.T, s.A);
            _legs.Add(leg);
            Root.Children.Add(leg.Root);
        }

        _wingL = BuildWing(-1, false); _wingR = BuildWing(1, false);
        _blurL = BuildWing(-1, true); _blurR = BuildWing(1, true);
        Root.Children.Add(_wingL); Root.Children.Add(_wingR); Root.Children.Add(_blurL); Root.Children.Add(_blurR);

        var shadowModel = Geometry3D.Ellipsoid(9, 4, .05, Color.FromArgb(55, 0, 0, 0), 0, 20, 3);
        _shadow = new ModelVisual3D { Content = shadowModel };
    }

    public ModelVisual3D Shadow => _shadow;

    public void Update(double dt, double worldX, double worldY, double heading, double altitude,
        double pitch, string state, double speed, double backwardTimer, double liveWing, double arousal, double flightEffort)
    {
        _time += dt;
        var flying = state == "Flying";
        var sleeping = state == "Sleeping";
        var effectiveSpeed = backwardTimer > 0 ? -22 : speed;

        UpdateLegs(dt, state, effectiveSpeed, backwardTimer);
        UpdateWings(dt, flying, sleeping, liveWing, arousal, flightEffort);

        var breathe = sleeping ? 1 + .05 * Math.Sin(_time * 1.1) : 1 + .03 * Math.Sin(_time * 3.0);
        var abdomenTransform = new Transform3DGroup();
        abdomenTransform.Children.Add(new ScaleTransform3D(1, 1, breathe));
        abdomenTransform.Children.Add(new TranslateTransform3D(0, -6.5, 5.6));
        _abdomen.Transform = abdomenTransform;

        var scale = 1.15 * (1 + .8 * altitude);
        var transforms = new Transform3DGroup();
        transforms.Children.Add(new ScaleTransform3D(scale, scale, scale));
        transforms.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(1, 0, 0), pitch * 180 / Math.PI)));
        transforms.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(0, 0, 1), -heading * 180 / Math.PI - 90)));
        transforms.Children.Add(new TranslateTransform3D(worldX, worldY, 90 * altitude));
        Root.Transform = transforms;

        var shadowScale = 1 + altitude * 1.7;
        var st = new Transform3DGroup();
        st.Children.Add(new ScaleTransform3D(shadowScale, shadowScale, 1));
        st.Children.Add(new TranslateTransform3D(worldX + altitude * 10, worldY - altitude * 8, -.7));
        _shadow.Transform = st;
    }

    private void UpdateLegs(double dt, string state, double effectiveSpeed, double backwardTimer)
    {
        var walking = state == "Walking" && Math.Abs(effectiveSpeed) > 1;
        if (walking)
        {
            var amp = Math.Clamp(.20 + Math.Abs(effectiveSpeed) * .0022, .20, .50);
            var stride = Math.Max(5, 2 * amp * 13);
            var freq = Math.Clamp(Math.Abs(effectiveSpeed) / stride, 3, 11);
            GaitPhase = (GaitPhase + freq * dt) % 1;
            const double stance = .6;
            foreach (var leg in _legs)
            {
                var p = (GaitPhase + leg.Phase) % 1;
                if (p < stance)
                {
                    leg.Angle = amp * (1 - 2 * p / stance);
                    leg.Lift = 0;
                }
                else
                {
                    var s = (p - stance) / (1 - stance);
                    leg.Angle = -amp + 2 * amp * SmoothStep(s);
                    leg.Lift = Math.Sin(s * Math.PI) * .55;
                }
                if (backwardTimer > 0) leg.Angle = -leg.Angle;
                ApplyLeg(leg);
            }
        }
        else if (state == "Grooming")
        {
            foreach (var leg in _legs)
            {
                if (leg.IsFront)
                {
                    leg.Angle = .45 + .25 * Math.Sin(_time * 20 + leg.SwingSign * 1.3);
                    leg.Lift = .55 + .15 * Math.Sin(_time * 22);
                }
                else
                {
                    leg.Angle += (0 - leg.Angle) * Math.Min(1, 8 * dt);
                    leg.Lift += (0 - leg.Lift) * Math.Min(1, 8 * dt);
                }
                ApplyLeg(leg);
            }
        }
        else if (state == "Flying")
        {
            foreach (var leg in _legs)
            {
                leg.Angle += (-.35 - leg.Angle) * Math.Min(1, 6 * dt);
                leg.Lift += (.5 - leg.Lift) * Math.Min(1, 6 * dt);
                ApplyLeg(leg);
            }
        }
        else
        {
            foreach (var leg in _legs)
            {
                leg.Angle += (0 - leg.Angle) * Math.Min(1, 10 * dt);
                leg.Lift += (0 - leg.Lift) * Math.Min(1, 10 * dt);
                ApplyLeg(leg);
            }
        }
    }

    private void UpdateWings(double dt, bool flying, bool sleeping, double liveWing, double arousal, double effort)
    {
        if (!flying)
        {
            var raiseTarget = !sleeping && liveWing > .7 ? 1 : 0;
            _wingRaise += (raiseTarget - _wingRaise) * Math.Min(1, 8 * dt);
            SetWingPose(_wingL, -1, -.5 * _wingRaise, .13 + .3 * _wingRaise, .95);
            SetWingPose(_wingR, 1, -.5 * _wingRaise, .13 + .3 * _wingRaise, .95);
            _blurL.Content = null; _blurR.Content = null;
            return;
        }

        var liveEffort = Math.Clamp(Math.Max(effort, effort * .55 + arousal * .25 + liveWing * .6), .25, 1.3);
        _flapPhase = (_flapPhase + dt * (14 + 10 * liveEffort)) % 1;
        var stroke = Math.Sin(_flapPhase * 2 * Math.PI);
        SetWingPose(_wingL, -1, stroke * .35, .45 + .35 * (.5 + .5 * stroke), .95);
        SetWingPose(_wingR, 1, stroke * .35, .45 + .35 * (.5 + .5 * stroke), .95);
        _blurL.Content ??= Geometry3D.Wing(11, 5, Color.FromArgb(45, 220, 232, 238));
        _blurR.Content ??= Geometry3D.Wing(11, 5, Color.FromArgb(45, 220, 232, 238));
        SetWingPose(_blurL, -1, 0, .45 + stroke * .2, .35);
        SetWingPose(_blurR, 1, 0, .45 + stroke * .2, .35);
    }

    private LegVisual BuildLeg(double x, double y, double z, double yaw, double sign, double phase, bool front,
        double femur, double tibia, double tarsus)
    {
        var color = Color.FromRgb(84, 61, 36);
        var group = new Model3DGroup();
        group.Children.Add(Geometry3D.Cylinder(.48, femur, color));
        var tib = Geometry3D.Cylinder(.38, tibia, color);
        tib.Transform = new Transform3DGroup
        {
            Children = new Transform3DCollection
            {
                new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(0,1,0), 43)),
                new TranslateTransform3D(femur,0,0)
            }
        };
        group.Children.Add(tib);
        var tar = Geometry3D.Cylinder(.24, tarsus, Color.FromRgb(63, 45, 27));
        tar.Transform = new Transform3DGroup
        {
            Children = new Transform3DCollection
            {
                new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(0,1,0), 25)),
                new TranslateTransform3D(femur + tibia * .72,0,-tibia * .45)
            }
        };
        group.Children.Add(tar);
        var root = new ModelVisual3D { Content = group };
        var leg = new LegVisual { Root = root, BaseYaw = yaw, SwingSign = sign, Phase = phase, IsFront = front, Attach = new Point3D(x, y, z) };
        ApplyLeg(leg, leg.Attach);
        return leg;
    }

    private static void ApplyLeg(LegVisual leg) => ApplyLeg(leg, leg.Attach);

    private static void ApplyLeg(LegVisual leg, Point3D attach)
    {
        var t = new Transform3DGroup();
        t.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(0, 1, 0), -leg.Lift * 57.2958)));
        t.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(0, 0, 1), (leg.BaseYaw + leg.SwingSign * leg.Angle) * 57.2958)));
        t.Children.Add(new TranslateTransform3D(attach.X, attach.Y, attach.Z));
        leg.Root.Transform = t;
    }

    private static ModelVisual3D BuildWing(double side, bool blur)
    {
        var color = blur ? Color.FromArgb(40, 225, 235, 240) : Color.FromArgb(90, 225, 235, 240);
        var model = Geometry3D.Wing(5.2, 16.5, color);
        var node = new ModelVisual3D { Content = blur ? null : model };
        SetWingPose(node, side, 0, .13, blur ? .35 : .95);
        return node;
    }

    private static void SetWingPose(ModelVisual3D wing, double side, double pitch, double spread, double scale)
    {
        var t = new Transform3DGroup();
        t.Children.Add(new ScaleTransform3D(scale, scale, scale));
        t.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(1, 0, 0), pitch * 57.2958)));
        t.Children.Add(new RotateTransform3D(new AxisAngleRotation3D(new Vector3D(0, 0, 1), side * spread * 57.2958)));
        t.Children.Add(new TranslateTransform3D(side * 1.6, .5, side > 0 ? 7.7 : 7.55));
        wing.Transform = t;
    }

    private static GeometryModel3D Placed(GeometryModel3D model, double x, double y, double z)
    {
        model.Transform = new TranslateTransform3D(x, y, z);
        return model;
    }

    private static double SmoothStep(double t)
    {
        var x = Math.Clamp(t, 0, 1);
        return x * x * (3 - 2 * x);
    }
}
