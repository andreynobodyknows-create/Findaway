namespace DesktopFly.Windows.Core;

public sealed class LifSimulation
{
    private readonly int _n;
    private readonly string[] _roles;
    private readonly string[] _types;
    private readonly float[] _v;
    private readonly int[] _refractory;
    private readonly float[] _baseline;
    private readonly List<(int Post, float Weight)>[] _out;
    private readonly Queue<(int DeliverAt, int Post, float Weight)> _delayed = new();
    private readonly Random _rng = new();

    private readonly List<int> _loomLeft = [];
    private readonly List<int> _loomRight = [];
    private readonly HashSet<int> _gf = [];
    private readonly HashSet<int> _dnaLeft = [];
    private readonly HashSet<int> _dnaRight = [];
    private readonly HashSet<int> _fwd = [];
    private readonly HashSet<int> _groom = [];
    private readonly HashSet<int> _mdn = [];

    private float _rateLoom;
    private float _rateDnaLeft;
    private float _rateDnaRight;
    private float _rateFwd;
    private float _rateGroom;
    private float _rateMdn;
    private float _ratePop;
    private bool _gfLatch;
    private int _ms;
    private float _dnaAdapt;

    private const float Decay = 0.9512f; // exp(-1/20ms)
    private const float Threshold = 1.0f;
    private const int RefractoryMs = 2;
    private const float WeightScale = 0.0008f;
    private const float GapBoost = 6.0f;
    private const float RateAlpha = 1f / 120f;

    public float LoomLeft { get; set; }
    public float LoomRight { get; set; }
    public float AirPuff { get; set; }

    public int NeuronCount => _n;

    public LifSimulation(CircuitFile circuit)
    {
        _n = circuit.Neurons.Count;
        _roles = circuit.Neurons.Select(x => x.Role).ToArray();
        _types = circuit.Neurons.Select(x => x.Type).ToArray();
        _v = new float[_n];
        _refractory = new int[_n];
        _baseline = new float[_n];
        _out = Enumerable.Range(0, _n).Select(_ => new List<(int, float)>()).ToArray();

        for (var i = 0; i < _n; i++)
        {
            var n = circuit.Neurons[i];
            switch (n.Role)
            {
                case "lc4":
                case "lplc2":
                    (n.Side == "left" ? _loomLeft : _loomRight).Add(i);
                    _baseline[i] = 0.004f;
                    break;
                case "gf": _gf.Add(i); _baseline[i] = 0.002f; break;
                case "dna01":
                case "dna02":
                    (n.Side == "left" ? _dnaLeft : _dnaRight).Add(i);
                    _baseline[i] = 0.036f;
                    break;
                case "dnp09": _fwd.Add(i); _baseline[i] = 0.038f; break;
                case "dng11": _groom.Add(i); _baseline[i] = 0.036f; break;
                case "mdn": _mdn.Add(i); _baseline[i] = 0.036f; break;
                case "other": _baseline[i] = 0.01f + (float)_rng.NextDouble() * 0.06f; break;
                default: _baseline[i] = 0.02f; break;
            }
        }

        foreach (var e in circuit.Edges)
        {
            if (e.Length < 3) continue;
            var pre = (int)e[0];
            var post = (int)e[1];
            if ((uint)pre >= _n || (uint)post >= _n) continue;

            var weight = e[2] * WeightScale;
            var electrical = _roles[pre] is "lc4" or "lplc2" ||
                             (_roles[pre] == "other" && _types[pre] == "sensory");
            if (electrical && _roles[post] == "gf") weight *= GapBoost;
            _out[pre].Add((post, weight));
        }
    }

    public BrainSignals Step(int milliseconds, float dtSeconds)
    {
        for (var step = 0; step < milliseconds; step++)
        {
            _ms++;
            for (var i = 0; i < _n; i++)
            {
                if (_refractory[i] > 0)
                {
                    _refractory[i]--;
                    _v[i] *= Decay;
                    continue;
                }

                _v[i] = _v[i] * Decay + _baseline[i];
                if (_rng.NextDouble() < 0.0022) _v[i] += 0.42f;
            }

            foreach (var i in _loomLeft) _v[i] += LoomLeft * 0.30f;
            foreach (var i in _loomRight) _v[i] += LoomRight * 0.30f;

            if (AirPuff > 0.001f)
            {
                for (var i = 0; i < _n; i++)
                    if (_roles[i] == "other" && _types[i] == "sensory")
                        _v[i] += AirPuff * 0.12f;
            }

            while (_delayed.Count > 0 && _delayed.Peek().DeliverAt <= _ms)
            {
                var d = _delayed.Dequeue();
                _v[d.Post] = Math.Max(-2f, _v[d.Post] + d.Weight);
            }

            var spikes = new List<int>();
            for (var i = 0; i < _n; i++)
            {
                if (_refractory[i] == 0 && _v[i] >= Threshold)
                {
                    _v[i] = 0;
                    _refractory[i] = RefractoryMs;
                    spikes.Add(i);
                }
            }

            foreach (var pre in spikes)
            {
                foreach (var (post, weight) in _out[pre])
                {
                    if (weight >= 0) _v[post] = Math.Max(-2f, _v[post] + weight);
                    else _delayed.Enqueue((_ms + 4, post, weight));
                }
            }

            var cLoom = 0; var cDl = 0; var cDr = 0; var cFwd = 0; var cGroom = 0; var cMdn = 0;
            foreach (var i in spikes)
            {
                if (_roles[i] is "lc4" or "lplc2") cLoom++;
                if (_dnaLeft.Contains(i)) cDl++;
                if (_dnaRight.Contains(i)) cDr++;
                if (_fwd.Contains(i)) cFwd++;
                if (_groom.Contains(i)) cGroom++;
                if (_mdn.Contains(i)) cMdn++;
                if (_gf.Contains(i)) _gfLatch = true;
            }

            _rateLoom = Ema(_rateLoom, Hz(cLoom, _loomLeft.Count + _loomRight.Count));
            _rateDnaLeft = Ema(_rateDnaLeft, Hz(cDl, _dnaLeft.Count));
            _rateDnaRight = Ema(_rateDnaRight, Hz(cDr, _dnaRight.Count));
            _rateFwd = Ema(_rateFwd, Hz(cFwd, _fwd.Count));
            _rateGroom = Ema(_rateGroom, Hz(cGroom, _groom.Count));
            _rateMdn = Ema(_rateMdn, Hz(cMdn, _mdn.Count));
            _ratePop = Ema(_ratePop, Hz(spikes.Count, _n));
        }

        var diff = _rateDnaLeft - _rateDnaRight;
        _dnaAdapt += (diff - _dnaAdapt) * Math.Min(1f, dtSeconds / 8f);
        var result = new BrainSignals(
            _gfLatch,
            Math.Clamp(_rateLoom / 80f, 0, 1),
            Math.Clamp((diff - _dnaAdapt) * 0.04f, -1f, 1f),
            Math.Clamp(_rateFwd / 10f, 0, 1.3f),
            _rateGroom / 8f,
            _rateMdn > 8f,
            Math.Clamp(_ratePop / 20f, 0, 1));
        _gfLatch = false;
        return result;
    }

    private static float Ema(float current, float sample) => current + (sample - current) * RateAlpha;
    private static float Hz(int spikes, int count) => spikes * 1000f / Math.Max(1, count);
}
