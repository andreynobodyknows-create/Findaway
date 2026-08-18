using System;

namespace DesktopFly.Windows.Core;

public sealed class SignalBuilder
{
    private float _dnaBaseline;

    public BrainSignals Make(LifSimulation sim, double dt, float tempo = 1f, bool sleep = false)
    {
        var diff = sim.RateDnaLeft - sim.RateDnaRight;
        _dnaBaseline += (diff - _dnaBaseline) * (float)Math.Min(1, dt / 8.0);
        return new BrainSignals(
            Escape: sim.ConsumeGF(),
            Nervous: Math.Clamp(sim.RateLoom / 80f, 0, 1),
            TurnBias: Math.Clamp((diff - _dnaBaseline) * 0.04f, -1f, 1f),
            Backward: sim.RateMdn > 8f,
            WalkDrive: Math.Clamp(sim.RateFwd / 10f, 0, 1.3f),
            GroomDrive: sim.RateGroom / 8f,
            WingDrive: Math.Clamp(sim.RateEscW / 10f, 0, 1.3f),
            Arousal: Math.Clamp(sim.RatePopulation / 20f, 0, 1),
            Tempo: tempo,
            Sleep: sleep);
    }
}
