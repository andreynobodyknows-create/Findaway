using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;

namespace DesktopFly.Windows.Core;

public sealed class LifSimulation
{
    public readonly record struct SpikeEvent(int Neuron, bool IsGf);
    private sealed class Stimulus
    {
        public required int[] Indices { get; init; }
        public required float Strength { get; init; }
        public required int DurationMs { get; init; }
        public int UntilMs { get; set; }
    }

    private readonly int _n;
    private readonly string[] _roles;
    private readonly string[] _types;
    private readonly Vector3[] _positions;
    private readonly float[] _v;
    private readonly int[] _refractory;
    private readonly float[] _baseline;
    private readonly List<(int Post, float Weight)>[] _out;
    private readonly float[][] _inhQueue;
    private int _qHead;
    private readonly Random _rng;

    private readonly List<int> _loomLeft = [];
    private readonly List<int> _loomRight = [];
    private readonly List<int> _gf = [];
    private readonly List<int> _dnaLeft = [];
    private readonly List<int> _dnaRight = [];
    private readonly List<int> _fwd = [];
    private readonly List<int> _groom = [];
    private readonly List<int> _mdn = [];
    private readonly List<int> _escw = [];
    private readonly List<int> _ascending = [];
    private readonly List<int> _sensory = [];
    private readonly float[] _ascendingPhase;

    private readonly object _stimLock = new();
    private readonly List<Stimulus> _pendingStims = [];
    private readonly List<Stimulus> _activeStims = [];
    private readonly object _spikeLock = new();
    private readonly List<SpikeEvent> _spikeEvents = [];

    private bool _gfLatch;
    private int _ms;
    private int _burstUntil;
    private int _burstNext = 12_000;

    private const float Decay = 0.9512f;
    private const float Threshold = 1.0f;
    private const int RefractoryMs = 2;
    private const float WeightScale = 0.0008f;
    private const float PNoise = 0.0022f;
    private const float NoiseKick = 0.42f;
    private const float LoomGain = 0.30f;
    private const float RateAlpha = 1f / 120f;
    private const int InhibitoryDelayMs = 4;
    private const float GapJunctionBoost = 6.0f;

    public float LoomLeft { get; set; }
    public float LoomRight { get; set; }
    public float GaitDrive { get; set; }
    public float GaitPhase { get; set; }
    public float AirPuff { get; set; }
    public float ActivityScale { get; set; } = 1f;
    public float SensoryGate { get; set; } = 1f;

    public float RateLoom { get; private set; }
    public float RateDnaLeft { get; private set; }
    public float RateDnaRight { get; private set; }
    public float RateMdn { get; private set; }
    public float RateFwd { get; private set; }
    public float RateGroom { get; private set; }
    public float RateEscW { get; private set; }
    public float RatePopulation { get; private set; }
    public int SimMilliseconds => _ms;
    public int TotalSpikes { get; private set; }
    public int NeuronCount => _n;

    public IReadOnlyList<int> LoomLeftIndices => _loomLeft;
    public IReadOnlyList<int> LoomRightIndices => _loomRight;
    public IReadOnlyList<int> GfIndices => _gf;
    public IReadOnlyList<int> DnaLeftIndices => _dnaLeft;
    public IReadOnlyList<int> DnaRightIndices => _dnaRight;
    public IReadOnlyList<int> ForwardIndices => _fwd;
    public IReadOnlyList<int> GroomIndices => _groom;
    public IReadOnlyList<int> MdnIndices => _mdn;
    public IReadOnlyList<int> EscapeWingIndices => _escw;
    public IReadOnlyList<int> AscendingIndices => _ascending;
    public IReadOnlyList<int> SensoryIndices => _sensory;
    public IReadOnlyList<Vector3> Positions => _positions;
    public IReadOnlyList<string> Roles => _roles;
    public IReadOnlyList<string> Types => _types;

    public LifSimulation(CircuitFile circuit, int? seed = null)
    {
        _rng = seed.HasValue ? new Random(seed.Value) : new Random();
        _n = circuit.Neurons.Count;
        _roles = circuit.Neurons.Select(x => x.Role).ToArray();
        _types = circuit.Neurons.Select(x => x.Type).ToArray();
        _positions = circuit.Neurons.Select(x => x.Pos.Length >= 3
            ? new Vector3(x.Pos[0], x.Pos[1], x.Pos[2])
            : Vector3.Zero).ToArray();
        _v = new float[_n];
        _refractory = new int[_n];
        _baseline = new float[_n];
        _out = Enumerable.Range(0, _n).Select(_ => new List<(int, float)>()).ToArray();
        _inhQueue = Enumerable.Range(0, 5).Select(_ => new float[_n]).ToArray();

        for (var i = 0; i < _n; i++)
        {
            var neuron = circuit.Neurons[i];
            switch (neuron.Role)
            {
                case "lc4":
                case "lplc2":
                    (neuron.Side == "left" ? _loomLeft : _loomRight).Add(i);
                    _baseline[i] = 0.004f;
                    break;
                case "gf":
                    _gf.Add(i);
                    _baseline[i] = 0.002f;
                    break;
                case "dna01":
                case "dna02":
                    (neuron.Side == "left" ? _dnaLeft : _dnaRight).Add(i);
                    _baseline[i] = 0.036f;
                    break;
                case "dnp09":
                    _fwd.Add(i);
                    _baseline[i] = 0.038f;
                    break;
                case "dng11":
                    _groom.Add(i);
                    _baseline[i] = 0.036f;
                    break;
                case "mdn":
                    _mdn.Add(i);
                    _baseline[i] = 0.036f;
                    break;
                case "escw":
                    _escw.Add(i);
                    _baseline[i] = 0.036f;
                    break;
                case "other":
                    if (neuron.Type == "ascending") _ascending.Add(i);
                    else if (neuron.Type == "sensory") _sensory.Add(i);
                    _baseline[i] = 0.010f + (float)_rng.NextDouble() * 0.060f;
                    break;
                default:
                    _baseline[i] = 0.002f;
                    break;
            }
        }

        _ascendingPhase = _ascending.Select(_ => (float)(_rng.NextDouble() * Math.PI * 2)).ToArray();

        foreach (var edge in circuit.Edges)
        {
            if (edge.Length < 3) continue;
            var pre = (int)edge[0];
            var post = (int)edge[1];
            if ((uint)pre >= _n || (uint)post >= _n) continue;
            var weight = edge[2] * WeightScale;
            var electrical = _roles[pre] is "lc4" or "lplc2" ||
                             (_roles[pre] == "other" && _types[pre] == "sensory");
            if (electrical && _roles[post] == "gf") weight *= GapJunctionBoost;
            _out[pre].Add((post, weight));
        }
    }

    public void Stimulate(IEnumerable<int> indices, float strength, int durationMs)
    {
        var selected = indices.Where(i => (uint)i < _n).Distinct().ToArray();
        if (selected.Length == 0) return;
        lock (_stimLock)
        {
            _pendingStims.Add(new Stimulus
            {
                Indices = selected,
                Strength = strength,
                DurationMs = durationMs
            });
            if (_pendingStims.Count > 8) _pendingStims.RemoveAt(0);
        }
    }

    public bool ConsumeGF()
    {
        var result = _gfLatch;
        _gfLatch = false;
        return result;
    }

    public SpikeEvent[] DrainSpikes()
    {
        lock (_spikeLock)
        {
            var result = _spikeEvents.ToArray();
            _spikeEvents.Clear();
            return result;
        }
    }

    public void Step(int milliseconds)
    {
        if (milliseconds <= 0) return;
        ActivatePendingStimuli();
        var visualSpikes = new List<SpikeEvent>();

        for (var step = 0; step < milliseconds; step++)
        {
            _ms++;
            if (_ms >= _burstNext)
            {
                _burstUntil = _ms + 400;
                _burstNext = _ms + _rng.Next(15_000, 40_001);
            }
            var noiseProbability = (_ms < _burstUntil ? PNoise * 6f : PNoise) * ActivityScale;

            for (var i = 0; i < _n; i++)
            {
                if (_refractory[i] > 0)
                {
                    _refractory[i]--;
                    _v[i] *= Decay;
                    continue;
                }
                _v[i] = _v[i] * Decay + _baseline[i] * ActivityScale;
                if (_rng.NextDouble() < noiseProbability) _v[i] += NoiseKick;
            }

            if (LoomLeft > 0.001f)
                foreach (var i in _loomLeft) _v[i] += LoomLeft * LoomGain * SensoryGate;
            if (LoomRight > 0.001f)
                foreach (var i in _loomRight) _v[i] += LoomRight * LoomGain * SensoryGate;

            if (GaitDrive > 0.001f)
            {
                var phase = GaitPhase * MathF.PI * 2f;
                for (var k = 0; k < _ascending.Count; k++)
                {
                    _v[_ascending[k]] += GaitDrive * 0.09f *
                        (0.5f + 0.5f * MathF.Sin(phase + _ascendingPhase[k]));
                }
            }

            if (AirPuff > 0.001f)
                foreach (var i in _sensory) _v[i] += AirPuff * 0.12f * SensoryGate;

            for (var s = _activeStims.Count - 1; s >= 0; s--)
            {
                var stim = _activeStims[s];
                if (_ms >= stim.UntilMs)
                {
                    _activeStims.RemoveAt(s);
                    continue;
                }
                foreach (var i in stim.Indices) _v[i] += stim.Strength;
            }

            var bucket = _inhQueue[_qHead];
            for (var i = 0; i < _n; i++)
            {
                if (bucket[i] == 0) continue;
                _v[i] = Math.Max(-2f, _v[i] + bucket[i]);
                bucket[i] = 0;
            }

            var spiked = new List<int>();
            for (var i = 0; i < _n; i++)
            {
                if (_refractory[i] == 0 && _v[i] >= Threshold)
                {
                    _v[i] = 0;
                    _refractory[i] = RefractoryMs;
                    spiked.Add(i);
                }
            }
            TotalSpikes += spiked.Count;

            var inhSlot = (_qHead + InhibitoryDelayMs) % _inhQueue.Length;
            foreach (var pre in spiked)
            {
                foreach (var (post, weight) in _out[pre])
                {
                    if (weight >= 0) _v[post] = Math.Max(-2f, _v[post] + weight);
                    else _inhQueue[inhSlot][post] += weight;
                }
            }
            _qHead = (_qHead + 1) % _inhQueue.Length;

            var cLoom = 0;
            var cDl = 0;
            var cDr = 0;
            var cMdn = 0;
            var cFwd = 0;
            var cGroom = 0;
            var cEscW = 0;
            foreach (var i in spiked)
            {
                switch (_roles[i])
                {
                    case "lc4":
                    case "lplc2": cLoom++; break;
                    case "dna01":
                    case "dna02":
                        if (_dnaLeft.Contains(i)) cDl++; else cDr++;
                        break;
                    case "mdn": cMdn++; break;
                    case "dnp09": cFwd++; break;
                    case "dng11": cGroom++; break;
                    case "escw": cEscW++; break;
                    case "gf": _gfLatch = true; break;
                }
            }

            RateLoom = Ema(RateLoom, Hz(cLoom, _loomLeft.Count + _loomRight.Count));
            RateDnaLeft = Ema(RateDnaLeft, Hz(cDl, _dnaLeft.Count));
            RateDnaRight = Ema(RateDnaRight, Hz(cDr, _dnaRight.Count));
            RateMdn = Ema(RateMdn, Hz(cMdn, _mdn.Count));
            RateFwd = Ema(RateFwd, Hz(cFwd, _fwd.Count));
            RateGroom = Ema(RateGroom, Hz(cGroom, _groom.Count));
            RateEscW = Ema(RateEscW, Hz(cEscW, _escw.Count));
            RatePopulation = Ema(RatePopulation, Hz(spiked.Count, _n));

            if (spiked.Count > 0)
            {
                var stride = Math.Max(1, spiked.Count / 12);
                for (var i = 0; i < spiked.Count; i += stride)
                {
                    var neuron = spiked[i];
                    visualSpikes.Add(new SpikeEvent(neuron, _roles[neuron] == "gf"));
                }
            }
        }

        if (visualSpikes.Count > 0)
        {
            lock (_spikeLock)
            {
                _spikeEvents.AddRange(visualSpikes);
                if (_spikeEvents.Count > 256)
                    _spikeEvents.RemoveRange(0, _spikeEvents.Count - 256);
            }
        }
    }

    private void ActivatePendingStimuli()
    {
        lock (_stimLock)
        {
            foreach (var stimulus in _pendingStims)
            {
                stimulus.UntilMs = _ms + stimulus.DurationMs;
                _activeStims.Add(stimulus);
            }
            _pendingStims.Clear();
        }
    }

    private static float Ema(float current, float sample) => current + (sample - current) * RateAlpha;
    private static float Hz(int spikes, int count) => spikes * 1000f / Math.Max(1, count);
}
