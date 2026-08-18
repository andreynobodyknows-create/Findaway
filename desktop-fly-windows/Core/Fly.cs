using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using DesktopFly.Windows.Platform;
using DesktopFly.Windows.Rendering;

namespace DesktopFly.Windows.Core;

public sealed class Fly
{
    public enum FlyState { Walking, Idle, Grooming, Flying, Sleeping }

    private const double EdgeMargin = 50;
    private const double ScareRadius = 110;
    private const double NervousRadius = 240;
    private readonly Random _rng;

    public FlyVisual3D Visual { get; }
    public Point Position { get; set; }
    public double Heading { get; set; }
    public double Speed { get; set; } = 30;
    public FlyState State { get; set; } = FlyState.Walking;
    public double StateTimer { get; set; }
    public double StateAge { get; set; }
    public double ScareCooldown { get; set; }
    public double DartCooldown { get; set; }
    public double BackwardTimer { get; set; }
    public double DartTimer { get; set; }
    public IReadOnlyList<Ledge> Terrain { get; set; } = [];
    public Ledge? AttachedLedge { get; set; }

    public Point FlightFrom { get; private set; }
    public Point FlightTo { get; private set; }
    public double FlightT { get; private set; }
    public double FlightDuration { get; private set; } = 1;
    public double FlightEffort { get; private set; } = .6;
    public double EffortCurrent { get; private set; } = .6;
    public double Altitude { get; private set; }
    public double Pitch { get; private set; }
    public double LiveArousal { get; private set; }
    public double LiveWing { get; private set; }
    public double Time { get; private set; }

    public double GaitPhase => Visual.GaitPhase;
    public double WalkingIntensity => State == FlyState.Walking
        ? Math.Clamp(Math.Abs(BackwardTimer > 0 ? 22 : Speed) / 60.0, 0, 1)
        : 0;

    public Fly(Point at, int? seed = null)
    {
        _rng = seed.HasValue ? new Random(seed.Value) : new Random();
        Visual = new FlyVisual3D();
        Position = at;
        Heading = Rnd(0, 2 * Math.PI);
        StateTimer = Rnd(1.5, 4);
        Time = Rnd(0, 100);
    }

    public void StartFlight(Rect bounds, Point? awayFrom = null, bool escape = false, double? effort = null)
    {
        State = FlyState.Flying;
        AttachedLedge = null;
        FlightEffort = Math.Clamp(effort ?? (escape ? 1.0 : Rnd(.4, .75)), .25, 1);
        EffortCurrent = FlightEffort;
        FlightFrom = Position;
        var left = bounds.Left + EdgeMargin;
        var right = bounds.Right - EdgeMargin;
        var top = bounds.Top + EdgeMargin;
        var bottom = bounds.Bottom - EdgeMargin;
        var target = Position;
        var chosen = false;

        if (!escape && awayFrom is null && Terrain.Count > 0 && Rnd(0, 1) < .45)
        {
            var ledge = Terrain[_rng.Next(Terrain.Count)];
            if (ledge.X1 - ledge.X0 > 90)
            {
                target = new Point(Rnd(ledge.X0 + 25, ledge.X1 - 25), ledge.Y);
                chosen = Distance(target, Position) > 180;
            }
        }

        if (!chosen)
        {
            for (var attempt = 0; attempt < 16; attempt++)
            {
                target = new Point(Rnd(left, right), Rnd(top, bottom));
                var far = Distance(target, Position) > (escape ? 350 : 260);
                if (!far) continue;
                if (awayFrom is Point threat)
                {
                    var tx = target.X - Position.X;
                    var ty = target.Y - Position.Y;
                    var ax = threat.X - Position.X;
                    var ay = threat.Y - Position.Y;
                    if (tx * ax + ty * ay > 0) continue;
                }
                chosen = true;
                break;
            }
        }

        FlightTo = target;
        var dist = Distance(target, Position);
        FlightDuration = escape ? Math.Clamp(dist / 650, .45, 1.2) : Math.Clamp(dist / 420, .7, 2.0);
        FlightT = 0;
        ScareCooldown = escape ? 2.0 : 2.5;
    }

    public void Update(double dt, Rect bounds, Point? mouse, BrainSignals? signals, Rect? renderBounds = null)
    {
        Time += dt;
        ScareCooldown = Math.Max(0, ScareCooldown - dt);
        DartCooldown = Math.Max(0, DartCooldown - dt);
        BackwardTimer = Math.Max(0, BackwardTimer - dt);
        DartTimer = Math.Max(0, DartTimer - dt);
        StateAge += dt;

        LiveArousal = signals?.Arousal ?? 0;
        LiveWing = signals?.WingDrive ?? 0;

        if (State == FlyState.Flying)
        {
            UpdateFlight(dt);
        }
        else if (signals is BrainSignals brain)
        {
            BrainBehavior(brain, dt, bounds, mouse);
            if (State == FlyState.Walking) UpdateWalk(dt, bounds);
        }
        else
        {
            LegacyBehavior(dt, bounds, mouse);
        }

        var visualBounds = renderBounds ?? bounds;
        var worldX = Position.X - (visualBounds.Left + visualBounds.Width / 2);
        var worldY = (visualBounds.Top + visualBounds.Height / 2) - Position.Y;
        Visual.Update(dt, worldX, worldY, Heading, Altitude, Pitch, State.ToString(), Speed,
            BackwardTimer, LiveWing, LiveArousal, FlightEffort);
    }

    private void LegacyBehavior(double dt, Rect bounds, Point? mouse)
    {
        if (ScareCooldown <= 0 && mouse is Point m)
        {
            var d = Distance(m, Position);
            if (d < ScareRadius)
            {
                StartFlight(bounds, m);
            }
            else if (d < NervousRadius && State != FlyState.Walking)
            {
                SetState(FlyState.Walking);
                Heading = Math.Atan2(Position.Y - m.Y, Position.X - m.X) + Rnd(-.4, .4);
                Speed = Rnd(110, 150);
                StateTimer = Rnd(.4, .9);
                ScareCooldown = 1;
            }
        }

        if (State == FlyState.Flying) { UpdateFlight(dt); return; }
        StateTimer -= dt;
        if (StateTimer <= 0)
        {
            if (State == FlyState.Walking && Rnd(0, 1) < .10) StartFlight(bounds);
            else PickNextState();
        }
        if (State == FlyState.Walking) UpdateWalk(dt, bounds);
    }

    private void BrainBehavior(BrainSignals s, double dt, Rect bounds, Point? mouse)
    {
        if (s.Escape && ScareCooldown <= 0)
        {
            StartFlight(bounds, mouse, escape: true);
            return;
        }

        if (s.Sleep)
        {
            if (State != FlyState.Sleeping)
            {
                SetState(FlyState.Sleeping);
                Speed = 0;
                DartTimer = 0;
                BackwardTimer = 0;
            }
            return;
        }
        if (State == FlyState.Sleeping)
        {
            SetState(FlyState.Grooming);
            return;
        }

        if (s.Nervous > .40 && DartCooldown <= 0)
        {
            AttachedLedge = null;
            SetState(FlyState.Walking);
            Heading = mouse is Point m
                ? Math.Atan2(Position.Y - m.Y, Position.X - m.X) + Rnd(-.4, .4)
                : Heading + Rnd(-1.5, 1.5);
            Speed = Rnd(110, 155);
            DartTimer = Rnd(.4, .9);
            DartCooldown = 1.2;
        }

        if (State != FlyState.Walking || DartTimer <= 0)
        {
            if (State != FlyState.Grooming && s.GroomDrive > .5 && s.Nervous < .3 && StateAge > .4)
                SetState(FlyState.Grooming);
            else if (State == FlyState.Grooming && s.GroomDrive < .3 && StateAge > .6)
                SetState(FlyState.Idle);
        }

        if (State == FlyState.Idle && s.WalkDrive > .22 && StateAge > .4)
        {
            SetState(FlyState.Walking);
            Heading += Rnd(-.8, .8);
        }
        else if (State == FlyState.Walking && DartTimer <= 0 && s.WalkDrive < .08 && StateAge > .5)
        {
            SetState(FlyState.Idle);
            Speed = 0;
        }

        if (s.Backward && BackwardTimer <= 0 && DartTimer <= 0)
        {
            if (State != FlyState.Walking) { SetState(FlyState.Walking); Speed = 0; }
            BackwardTimer = .5;
        }

        if (State == FlyState.Walking)
        {
            if (DartTimer <= 0 && BackwardTimer <= 0)
            {
                var target = (14 + s.WalkDrive * 55) * s.Tempo;
                Speed += (target - Speed) * Math.Min(1, 3 * dt);
            }
            if (AttachedLedge is null) Heading += s.TurnBias * dt;
        }

        var flightChance = s.Arousal > .5 ? .6 : .005;
        if (State == FlyState.Walking && Rnd(0, 1) < flightChance * dt)
            StartFlight(bounds, effort: .35 + s.Arousal * .6);
    }

    private void UpdateWalk(double dt, Rect bounds)
    {
        if (AttachedLedge is Ledge attached)
        {
            var current = Terrain.FirstOrDefault(l => l.Id == attached.Id);
            if (current.Id != IntPtr.Zero && Math.Abs(current.Y - attached.Y) < 40)
                AttachedLedge = current;
            else
            {
                AttachedLedge = null;
                StartFlight(bounds);
                return;
            }
        }

        var effectiveSpeed = BackwardTimer > 0 ? -22 : Speed;
        if (AttachedLedge is Ledge ledge)
        {
            Heading += Rnd(-1, 1) * .2 * dt;
            var along = Math.Cos(Heading) >= 0 ? 0 : Math.PI;
            Heading += AngleDiff(Heading, along) * Math.Min(1, 6 * dt);
            Position = new Point(Position.X + Math.Cos(Heading) * effectiveSpeed * dt,
                Position.Y + (ledge.Y - Position.Y) * Math.Min(1, 10 * dt));
            if (Position.X <= ledge.X0 + 6 && Math.Cos(Heading) < 0) Heading = 0;
            if (Position.X >= ledge.X1 - 6 && Math.Cos(Heading) > 0) Heading = Math.PI;
            Position = new Point(Math.Clamp(Position.X, ledge.X0, ledge.X1), Position.Y);
            if (Rnd(0, 1) < .05 * dt) AttachedLedge = null;
        }
        else
        {
            Heading += Rnd(-1, 1) * 1.6 * dt;
            var inner = new Rect(bounds.Left + EdgeMargin, bounds.Top + EdgeMargin,
                Math.Max(1, bounds.Width - 2 * EdgeMargin), Math.Max(1, bounds.Height - 2 * EdgeMargin));
            if (!inner.Contains(Position))
            {
                var center = new Point(bounds.Left + bounds.Width / 2, bounds.Top + bounds.Height / 2);
                var toCenter = Math.Atan2(center.Y - Position.Y, center.X - Position.X);
                Heading += AngleDiff(Heading, toCenter) * Math.Min(1, 4 * dt);
            }
            Position = new Point(
                Position.X + Math.Cos(Heading) * effectiveSpeed * dt,
                Position.Y + Math.Sin(Heading) * effectiveSpeed * dt);
            Position = new Point(
                Math.Clamp(Position.X, bounds.Left + 20, bounds.Right - 20),
                Math.Clamp(Position.Y, bounds.Top + 20, bounds.Bottom - 20));

            foreach (var ledge in Terrain)
            {
                if (Position.X > ledge.X0 - 8 && Position.X < ledge.X1 + 8 && Math.Abs(Position.Y - ledge.Y) < 20 && Rnd(0, 1) < .9 * dt)
                {
                    AttachedLedge = ledge;
                    Heading = Math.Cos(Heading) >= 0 ? 0 : Math.PI;
                    break;
                }
            }
        }
    }

    private void UpdateFlight(double dt)
    {
        FlightT = Math.Min(1, FlightT + dt / FlightDuration);
        if (FlightT >= 1)
        {
            Position = new Point(FlightTo.X + Math.Sin(Time * 26) * 1.2,
                FlightTo.Y + Math.Cos(Time * 22) * 1.0);
            Pitch = Math.Clamp(Altitude * .4, 0, .35);
            Altitude += (0 - Altitude) * Math.Min(1, 9 * dt);
            if (Altitude < .035) { Position = FlightTo; Land(); }
            return;
        }

        var e = SmoothStep(FlightT);
        var dx = FlightTo.X - FlightFrom.X;
        var dy = FlightTo.Y - FlightFrom.Y;
        var len = Math.Max(1, Math.Sqrt(dx * dx + dy * dy));
        var px = -dy / len;
        var py = dx / len;
        var wobble = Math.Sin(Time * 32) * 4 * Math.Sin(FlightT * Math.PI);
        Position = new Point(FlightFrom.X + dx * e + px * wobble,
            FlightFrom.Y + dy * e + py * wobble);
        Heading = Math.Atan2(dy, dx) + Math.Sin(Time * 18) * .12;

        EffortCurrent = Math.Clamp(Math.Max(FlightEffort,
            FlightEffort * .55 + LiveArousal * .25 + LiveWing * .6), .25, 1.3);
        var rise = Math.Min(FlightT / .25, 1);
        var fall = Math.Min((1 - FlightT) / .3, 1);
        var target = EffortCurrent * Math.Min(rise, fall) * (.85 + .15 * Math.Sin(Time * 7));
        Pitch = Math.Clamp((target - Altitude) * 2.5, -.45, .45);
        Altitude += (target - Altitude) * Math.Min(1, 6 * dt);
    }

    private void Land()
    {
        State = FlyState.Idle;
        StateTimer = Rnd(.3, .8);
        Speed = 0;
        Altitude = 0;
        Pitch = 0;
    }

    private void PickNextState()
    {
        switch (State)
        {
            case FlyState.Walking:
                var r = Rnd(0, 1);
                if (r < .30) { State = FlyState.Idle; StateTimer = Rnd(.8, 3); Speed = 0; }
                else if (r < .55) { StateTimer = Rnd(.3, .8); Speed = Rnd(95, 150); Heading += Rnd(-1.2, 1.2); }
                else { StateTimer = Rnd(1.5, 5); Speed = Rnd(18, 45); }
                break;
            case FlyState.Idle:
                if (Rnd(0, 1) < .35) { State = FlyState.Grooming; StateTimer = Rnd(1, 2.5); }
                else { State = FlyState.Walking; StateTimer = Rnd(1.5, 5); Speed = Rnd(18, 45); Heading += Rnd(-1.5, 1.5); }
                break;
            case FlyState.Grooming:
                State = FlyState.Idle; StateTimer = Rnd(.3, 1); break;
        }
        StateAge = 0;
    }

    private void SetState(FlyState state)
    {
        if (State == state) return;
        State = state;
        StateAge = 0;
    }

    private double Rnd(double lo, double hi) => lo + _rng.NextDouble() * (hi - lo);
    private static double Distance(Point a, Point b) => Math.Sqrt((a.X - b.X) * (a.X - b.X) + (a.Y - b.Y) * (a.Y - b.Y));
    private static double SmoothStep(double t) { var x = Math.Clamp(t, 0, 1); return x * x * (3 - 2 * x); }
    private static double AngleDiff(double from, double to)
    {
        var d = (to - from) % (2 * Math.PI);
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        return d;
    }
}
