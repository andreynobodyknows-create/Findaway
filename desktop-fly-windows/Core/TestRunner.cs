using System;
using System.Windows;
using DesktopFly.Windows.Platform;

namespace DesktopFly.Windows.Core;

public static class TestRunner
{
    public static int RunSimTest()
    {
        var data = BrainDataLoader.TryLoad();
        if (data is null) { Console.Error.WriteLine("no data/ — run scripts/fetch-data.ps1 first"); return 2; }
        var sim = new LifSimulation(data.Circuit, seed: 42);
        Console.WriteLine($"circuit: {sim.NeuronCount} neurons | loom L/R: {sim.LoomLeftIndices.Count}/{sim.LoomRightIndices.Count}" +
                          $" | GF: {sim.GfIndices.Count} | DNa L/R: {sim.DnaLeftIndices.Count}/{sim.DnaRightIndices.Count}" +
                          $" | MDN: {sim.MdnIndices.Count} | DNp09: {sim.ForwardIndices.Count} | DNg11: {sim.GroomIndices.Count}" +
                          $" | escW: {sim.EscapeWingIndices.Count} | ascend: {sim.AscendingIndices.Count} | sens: {sim.SensoryIndices.Count}");

        sim.Step(4000);
        var spontaneousGf = sim.ConsumeGF();
        var popHz = sim.TotalSpikes / 4.0 / Math.Max(1, sim.NeuronCount);
        Console.WriteLine($"spontaneous 4s: pop {popHz:F2} Hz/neuron, LC {sim.RateLoom:F1} Hz, GF latch {(spontaneousGf ? "yes" : "no")}");

        var loomFired = false;
        var latency = -1;
        for (var ms = 0; ms < 400; ms++)
        {
            sim.LoomLeft = 1; sim.LoomRight = .5f; sim.Step(1);
            if (sim.ConsumeGF()) { loomFired = true; if (latency < 0) latency = ms; }
        }
        sim.LoomLeft = sim.LoomRight = 0;
        Console.WriteLine($"abrupt loom: GF={(loomFired ? "yes" : "NO")}, first={latency} ms, LC={sim.RateLoom:F1} Hz");

        sim.GaitDrive = .5f;
        for (var ms = 0; ms < 3000; ms++) { sim.GaitPhase = (ms % 125) / 125f; sim.Step(1); }
        sim.GaitDrive = 0;
        Console.WriteLine($"gait feedback: DNp09={sim.RateFwd:F1} Hz, pop={sim.RatePopulation:F1} Hz");

        sim.AirPuff = 1;
        sim.Step(500);
        var puffFired = sim.ConsumeGF();
        sim.AirPuff = 0;
        Console.WriteLine($"air puff: GF={(puffFired ? "yes" : "no")}");

        sim.Stimulate(sim.GfIndices, .5f, 40);
        sim.Step(60);
        var stimFired = sim.ConsumeGF();
        Console.WriteLine($"GF click probe: {(stimFired ? "spike" : "NO SPIKE")}");

        var structural = sim.NeuronCount >= 600 && sim.GfIndices.Count > 0 && sim.LoomLeftIndices.Count > 0 &&
                         sim.LoomRightIndices.Count > 0 && sim.AscendingIndices.Count > 0 && sim.SensoryIndices.Count > 0;
        var pass = structural && loomFired && stimFired;
        Console.WriteLine(pass ? "PASS: circuit, loom, body-feedback groups and stimulation operational" : "FAIL: circuit parity invariant failed");
        return pass ? 0 : 1;
    }

    public static int RunBehaviorTest()
    {
        var data = BrainDataLoader.TryLoad();
        if (data is null) { Console.Error.WriteLine("no data/ — run scripts/fetch-data.ps1 first"); return 2; }
        var failures = 0;
        var count = 0;
        var bounds = new Rect(0, 0, 1512, 982);
        const double dt = 1.0 / 60.0;

        void Check(string name, Func<(bool Ok, string Detail)> test)
        {
            count++;
            try
            {
                var (ok, detail) = test();
                if (!ok) failures++;
                Console.WriteLine($"{(ok ? "PASS" : "FAIL")} {count:00} {name}: {detail}");
            }
            catch (Exception ex)
            {
                failures++;
                Console.WriteLine($"FAIL {count:00} {name}: {ex.GetType().Name} {ex.Message}");
            }
        }

        Check("GF stim -> escape flight", () => NeuralScenario(data, bounds, dt, s => s.Stimulate(s.GfIndices, .55f, 80),
            f => f.State == Fly.FlyState.Flying, 1.0));
        Check("DNg11 stim -> grooming", () => NeuralScenario(data, bounds, dt, s => s.Stimulate(s.GroomIndices, .35f, 900),
            f => f.State == Fly.FlyState.Grooming, 1.8));
        Check("DNp09 stim -> forward walking", () => NeuralScenario(data, bounds, dt, s => s.Stimulate(s.ForwardIndices, .35f, 1200),
            f => f.State == Fly.FlyState.Walking && f.Speed > 25, 1.8));
        Check("MDN stim -> backward walking", () => NeuralScenario(data, bounds, dt, s => s.Stimulate(s.MdnIndices, .4f, 800),
            f => f.BackwardTimer > 0, 1.4));
        Check("DNa-left stim -> steering", () =>
        {
            var sim = new LifSimulation(data.Circuit, 5); var builder = new SignalBuilder(); var fly = FreshFly();
            fly.State = Fly.FlyState.Walking; fly.Speed = 35; fly.StateAge = 1; fly.Heading = 0;
            sim.Step(400); _ = sim.ConsumeGF(); sim.Stimulate(sim.DnaLeftIndices, .45f, 1000);
            var max = 0.0;
            for (var i = 0; i < 100; i++) { sim.Step(16); var sig = builder.Make(sim, dt); fly.Update(dt, bounds, null, sig); max = Math.Max(max, Math.Abs(fly.Heading)); }
            return (max > .12, $"|heading| max {max:F2} rad");
        });
        Check("moderate loom -> nervous response", () =>
        {
            var sim = new LifSimulation(data.Circuit, 6); sim.LoomLeft = .3f; sim.Step(500);
            return (sim.RateLoom > 1, $"LC {sim.RateLoom:F1} Hz");
        });
        Check("sleep command -> sleeping posture", () =>
        {
            var fly = FreshFly(); fly.State = Fly.FlyState.Idle; fly.Update(dt, bounds, null, new BrainSignals(Sleep: true));
            return (fly.State == Fly.FlyState.Sleeping, $"state={fly.State}");
        });
        Check("wake -> post-sleep grooming", () =>
        {
            var fly = FreshFly(); fly.State = Fly.FlyState.Sleeping; fly.Update(dt, bounds, null, new BrainSignals());
            return (fly.State == Fly.FlyState.Grooming, $"state={fly.State}");
        });
        Check("high LC without GF -> dart", () =>
        {
            var fly = FreshFly(); fly.State = Fly.FlyState.Idle; fly.StateAge = 1;
            fly.Update(dt, bounds, new Point(700, 490), new BrainSignals(Nervous: .7f, WalkDrive: .3f));
            return (fly.State == Fly.FlyState.Walking && fly.DartTimer > 0, $"state={fly.State} dart={fly.DartTimer:F2}");
        });
        Check("window ledge carries walking fly", () =>
        {
            var fly = FreshFly(); var ledge = new Ledge(300, 200, 800, (nint)123);
            fly.Position = new Point(500, 300); fly.State = Fly.FlyState.Walking; fly.Speed = 30; fly.AttachedLedge = ledge; fly.Terrain = [ledge];
            fly.Update(.1, bounds, null, new BrainSignals(WalkDrive: .6f));
            return (fly.AttachedLedge is not null && Math.Abs(fly.Position.Y - 300) < 1, $"pos={fly.Position.X:F0},{fly.Position.Y:F0}");
        });
        Check("closed ledge -> takeoff", () =>
        {
            var fly = FreshFly(); fly.Position = new Point(500, 300); fly.State = Fly.FlyState.Walking;
            fly.AttachedLedge = new Ledge(300, 200, 800, (nint)123); fly.Terrain = [];
            fly.Update(.1, bounds, null, new BrainSignals(WalkDrive: .6f));
            return (fly.State == Fly.FlyState.Flying, $"state={fly.State}");
        });
        Check("escape flight gains altitude", () =>
        {
            var fly = FreshFly(); fly.StartFlight(bounds, new Point(756, 491), escape: true);
            var max = 0.0; for (var i = 0; i < 45; i++) { fly.Update(dt, bounds, null, new BrainSignals(WingDrive: 1, Arousal: 1)); max = Math.Max(max, fly.Altitude); }
            return (max > .15, $"max altitude={max:F2}");
        });
        Check("flight lands smoothly", () =>
        {
            var fly = FreshFly(); fly.StartFlight(bounds, escape: true); var landed = false;
            for (var i = 0; i < 600; i++) { fly.Update(dt, bounds, null, new BrainSignals()); if (fly.State != Fly.FlyState.Flying) { landed = true; break; } }
            return (landed && fly.Altitude < .04, $"landed={landed} alt={fly.Altitude:F2}");
        });
        Check("tripod gait advances phase", () =>
        {
            var fly = FreshFly(); fly.State = Fly.FlyState.Walking; fly.Speed = 60; fly.StateAge = 1; var p0 = fly.GaitPhase;
            for (var i = 0; i < 10; i++) fly.Update(dt, bounds, null, new BrainSignals(WalkDrive: 1));
            return (Math.Abs(fly.GaitPhase - p0) > .05, $"phase {p0:F2}->{fly.GaitPhase:F2}");
        });
        Check("circadian curve has siesta/night dips", () =>
        {
            var n = WindowSense.CircadianActivity(3); var d = WindowSense.CircadianActivity(9);
            var s = WindowSense.CircadianActivity(14); var e = WindowSense.CircadianActivity(18);
            var ok = n < .4 && d > .9 && s is > .3f and < .7f && e > .9;
            return (ok, $"3h {n:F2}, 9h {d:F2}, 14h {s:F2}, 18h {e:F2}");
        });
        Check("sleep sensory gate reduces looming current", () =>
        {
            var awake = new LifSimulation(data.Circuit, 99) { LoomLeft = .5f, SensoryGate = 1 };
            var asleep = new LifSimulation(data.Circuit, 99) { LoomLeft = .5f, SensoryGate = .55f };
            awake.Step(200); asleep.Step(200);
            return (awake.RateLoom >= asleep.RateLoom, $"awake {awake.RateLoom:F1} vs sleep {asleep.RateLoom:F1} Hz");
        });
        Check("wing DNs expose live wing drive", () =>
        {
            var sim = new LifSimulation(data.Circuit, 11); var builder = new SignalBuilder();
            sim.Stimulate(sim.EscapeWingIndices, .4f, 600); sim.Step(400); var s = builder.Make(sim, .4);
            return (sim.EscapeWingIndices.Count > 0 && s.WingDrive > .05, $"escW={sim.EscapeWingIndices.Count}, drive={s.WingDrive:F2}");
        });

        Console.WriteLine(failures == 0 ? "ALL 17 BEHAVIOR TESTS PASS" : $"{failures} OF {count} TESTS FAILED");
        return failures == 0 ? 0 : 1;
    }

    private static (bool Ok, string Detail) NeuralScenario(BrainData data, Rect bounds, double dt,
        Action<LifSimulation> stimulus, Func<Fly, bool> predicate, double hold)
    {
        var sim = new LifSimulation(data.Circuit, 123);
        var builder = new SignalBuilder();
        var fly = FreshFly(); fly.State = Fly.FlyState.Idle; fly.Speed = 0; fly.StateAge = 1;
        sim.Step(400); _ = sim.ConsumeGF(); stimulus(sim);
        var frames = (int)(hold / dt);
        for (var i = 0; i < frames; i++)
        {
            sim.Step(16); var signals = builder.Make(sim, dt); fly.Update(dt, bounds, null, signals);
            if (predicate(fly)) return (true, $"state={fly.State}, speed={fly.Speed:F0}");
        }
        return (false, $"state={fly.State}, speed={fly.Speed:F0}");
    }

    private static Fly FreshFly() => new(new Point(756, 491), seed: 7);
}
