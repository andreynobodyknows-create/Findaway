using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using DesktopFly.Windows.Core;

namespace DesktopFly.Windows.Rendering;

public sealed class BrainWindow : Window
{
    private readonly BrainCanvas _canvas;
    private bool _pausedRotation;
    private double _lastSeconds;
    private double _lastRenderSeconds;
    private const double RenderInterval = 1.0 / 15.0;

    public BrainWindow(BrainPointsFile points, CircuitFile circuit, LifSimulation sim)
    {
        Title = "DesktopFly — live FlyWire brain";
        Width = 720;
        Height = 560;
        MinWidth = 520;
        MinHeight = 400;
        Background = new SolidColorBrush(Color.FromRgb(10, 12, 17));
        WindowStartupLocation = WindowStartupLocation.Manual;
        ShowInTaskbar = true;
        _canvas = new BrainCanvas(points, circuit, sim);
        Content = _canvas;
        MouseEnter += (_, _) => _pausedRotation = true;
        MouseLeave += (_, _) => _pausedRotation = false;
        CompositionTarget.Rendering += RenderFrame;
        Closed += (_, _) => CompositionTarget.Rendering -= RenderFrame;
    }

    private void RenderFrame(object? sender, EventArgs e)
    {
        var now = Environment.TickCount64 / 1000.0;
        if (_lastSeconds == 0) _lastSeconds = now;
        if (now - _lastRenderSeconds < RenderInterval) return;
        var dt = Math.Clamp(now - _lastSeconds, 0, .1);
        _lastSeconds = now;
        _lastRenderSeconds = now;
        if (!_pausedRotation) _canvas.Yaw += dt * .22;
        _canvas.AdvanceFlashes();
        _canvas.InvalidateVisual();
    }
}

public sealed class BrainCanvas : FrameworkElement
{
    private readonly BrainPointsFile _points;
    private readonly CircuitFile _circuit;
    private readonly LifSimulation _sim;
    private readonly Dictionary<int, long> _flashes = [];
    private readonly HashSet<int> _gf;
    private readonly Color[] _classColors;
    private readonly Vector3 _center;
    private readonly float _range;
    private readonly Typeface _typeface = new("Segoe UI");
    private string _status = "hover pauses · click a region to stimulate ~60 nearby circuit neurons";
    private WriteableBitmap? _somaBitmap;
    private int[] _somaPixels = [];
    private int _bitmapWidth;
    private int _bitmapHeight;
    private double _rasterYaw = double.NaN;
    private double _rasterPitch = double.NaN;

    public double Yaw { get; set; } = .5;
    public double Pitch { get; set; } = -.15;

    public BrainCanvas(BrainPointsFile points, CircuitFile circuit, LifSimulation sim)
    {
        _points = points;
        _circuit = circuit;
        _sim = sim;
        _gf = circuit.Neurons.Select((n, i) => (n, i)).Where(x => x.n.Role == "gf").Select(x => x.i).ToHashSet();
        _classColors = BuildClassColors(points.Classes);
        (_center, _range) = ComputeBounds(points.Points);
        Cursor = Cursors.Cross;
        MouseLeftButtonDown += OnClick;
    }

    public void AdvanceFlashes()
    {
        foreach (var spike in _sim.DrainSpikes())
            _flashes[spike.Neuron] = Environment.TickCount64 + (spike.IsGf ? 480 : 220);
        var now = Environment.TickCount64;
        foreach (var key in _flashes.Where(x => x.Value < now).Select(x => x.Key).ToArray())
            _flashes.Remove(key);
    }

    protected override void OnRender(DrawingContext dc)
    {
        base.OnRender(dc);
        dc.DrawRectangle(new SolidColorBrush(Color.FromRgb(10, 12, 17)), null, new Rect(0, 0, ActualWidth, ActualHeight));
        if (ActualWidth < 2 || ActualHeight < 2) return;

        var pixelsPerDip = VisualTreeHelper.GetDpi(this).PixelsPerDip;
        var header = new FormattedText(
            $"FlyWire v783 · {_points.Points.Count:N0} somas · {_circuit.Neurons.Count} simulated neurons",
            System.Globalization.CultureInfo.InvariantCulture, FlowDirection.LeftToRight, _typeface, 16,
            Brushes.White, pixelsPerDip);
        dc.DrawText(header, new Point(18, 12));
        var status = new FormattedText(_status, System.Globalization.CultureInfo.InvariantCulture,
            FlowDirection.LeftToRight, _typeface, 11, new SolidColorBrush(Color.FromRgb(160, 174, 195)), pixelsPerDip);
        dc.DrawText(status, new Point(18, 35));

        var usable = new Rect(15, 58, Math.Max(1, ActualWidth - 30), Math.Max(1, ActualHeight - 73));
        EnsureSomaRaster(usable);
        if (_somaBitmap is not null) dc.DrawImage(_somaBitmap, usable);

        for (var i = 0; i < _circuit.Neurons.Count; i++)
        {
            var pos = _circuit.Neurons[i].Pos;
            if (pos.Length < 3) continue;
            var screen = Project(new Vector3(pos[0], pos[1], pos[2]), usable);
            var roleBrush = RoleBrush(_circuit.Neurons[i].Role);
            var r = _gf.Contains(i) ? 3.2 : 1.7;
            dc.DrawEllipse(roleBrush, null, screen, r, r);
            if (_gf.Contains(i)) dc.DrawEllipse(null, new Pen(Brushes.Gold, 1.2), screen, 6, 6);
            if (_flashes.ContainsKey(i))
            {
                var brush = _gf.Contains(i) ? Brushes.Yellow : Brushes.White;
                dc.DrawEllipse(brush, null, screen, _gf.Contains(i) ? 7 : 4, _gf.Contains(i) ? 7 : 4);
            }
        }
    }

    private void EnsureSomaRaster(Rect usable)
    {
        var w = Math.Max(1, (int)Math.Ceiling(usable.Width));
        var h = Math.Max(1, (int)Math.Ceiling(usable.Height));
        if (_somaBitmap is not null && w == _bitmapWidth && h == _bitmapHeight &&
            Math.Abs(Yaw - _rasterYaw) < .001 && Math.Abs(Pitch - _rasterPitch) < .001) return;

        if (_somaBitmap is null || w != _bitmapWidth || h != _bitmapHeight)
        {
            _bitmapWidth = w;
            _bitmapHeight = h;
            _somaBitmap = new WriteableBitmap(w, h, 96, 96, PixelFormats.Bgra32, null);
            _somaPixels = new int[w * h];
        }
        else
        {
            Array.Clear(_somaPixels, 0, _somaPixels.Length);
        }

        var rasterRect = new Rect(0, 0, w, h);
        foreach (var p in _points.Points)
        {
            if (p.Length < 4) continue;
            var screen = Project(new Vector3(p[0], p[1], p[2]), rasterRect);
            var x = (int)Math.Round(screen.X);
            var y = (int)Math.Round(screen.Y);
            if ((uint)x >= (uint)w || (uint)y >= (uint)h) continue;
            var ci = Math.Clamp((int)p[3], 0, _classColors.Length - 1);
            var c = _classColors[ci];
            var argb = (c.A << 24) | (c.R << 16) | (c.G << 8) | c.B;
            PutPixel(x, y, argb, w, h);
            if (x + 1 < w) PutPixel(x + 1, y, argb, w, h);
            if (y + 1 < h) PutPixel(x, y + 1, argb, w, h);
        }

        _somaBitmap.WritePixels(new Int32Rect(0, 0, w, h), _somaPixels, w * 4, 0);
        _rasterYaw = Yaw;
        _rasterPitch = Pitch;
    }

    private void PutPixel(int x, int y, int argb, int w, int h)
    {
        if ((uint)x < (uint)w && (uint)y < (uint)h) _somaPixels[y * w + x] = argb;
    }

    private void OnClick(object sender, MouseButtonEventArgs e)
    {
        var mouse = e.GetPosition(this);
        var usable = new Rect(15, 58, Math.Max(1, ActualWidth - 30), Math.Max(1, ActualHeight - 73));
        var nearest = -1;
        var best = double.MaxValue;
        for (var i = 0; i < _circuit.Neurons.Count; i++)
        {
            var p = _circuit.Neurons[i].Pos;
            if (p.Length < 3) continue;
            var s = Project(new Vector3(p[0], p[1], p[2]), usable);
            var d = (s - mouse).LengthSquared;
            if (d < best) { best = d; nearest = i; }
        }
        if (nearest < 0) return;

        var originArray = _circuit.Neurons[nearest].Pos;
        var origin = new Vector3(originArray[0], originArray[1], originArray[2]);
        var ranked = _circuit.Neurons.Select((n, i) =>
        {
            var p = n.Pos.Length >= 3 ? new Vector3(n.Pos[0], n.Pos[1], n.Pos[2]) : Vector3.Zero;
            return (Index: i, D: Vector3.Distance(origin, p));
        }).OrderBy(x => x.D).ToList();
        var selected = ranked.Where(x => x.D <= 2.2f).Take(60).Select(x => x.Index).ToList();
        if (selected.Count < 6) selected = ranked.Take(Math.Min(60, Math.Max(6, ranked.Count))).Select(x => x.Index).ToList();
        _sim.Stimulate(selected, .25f, 400);
        foreach (var i in selected.Take(16)) _flashes[i] = Environment.TickCount64 + 300;
        var neuron = _circuit.Neurons[nearest];
        _status = $"stimulating {selected.Count} neurons near {neuron.Role}/{neuron.Type} · root {neuron.Id}";
    }

    private Point Project(Vector3 p, Rect rect)
    {
        var v = p - _center;
        var cy = (float)Math.Cos(Yaw); var sy = (float)Math.Sin(Yaw);
        var cp = (float)Math.Cos(Pitch); var sp = (float)Math.Sin(Pitch);
        var x1 = v.X * cy + v.Z * sy;
        var z1 = -v.X * sy + v.Z * cy;
        var y2 = v.Y * cp - z1 * sp;
        var z2 = v.Y * sp + z1 * cp;
        var scale = Math.Min(rect.Width, rect.Height) * .43 / Math.Max(.001, _range);
        var perspective = 1.0 + z2 / Math.Max(.001, _range) * .12;
        return new Point(rect.X + rect.Width / 2 + x1 * scale * perspective,
            rect.Y + rect.Height / 2 - y2 * scale * perspective);
    }

    private static (Vector3 Center, float Range) ComputeBounds(IEnumerable<float[]> points)
    {
        var min = new Vector3(float.MaxValue);
        var max = new Vector3(float.MinValue);
        foreach (var p in points)
        {
            if (p.Length < 3) continue;
            var v = new Vector3(p[0], p[1], p[2]);
            min = Vector3.Min(min, v); max = Vector3.Max(max, v);
        }
        var center = (min + max) / 2;
        var range = Math.Max(max.X - min.X, Math.Max(max.Y - min.Y, max.Z - min.Z));
        return (center, Math.Max(range, .001f));
    }

    private static Color[] BuildClassColors(IReadOnlyList<string> classes)
    {
        var palette = new[]
        {
            Color.FromArgb(145, 66, 165, 245), Color.FromArgb(145, 91, 213, 164),
            Color.FromArgb(145, 238, 138, 75), Color.FromArgb(145, 193, 115, 235),
            Color.FromArgb(145, 244, 211, 94), Color.FromArgb(145, 232, 93, 117),
            Color.FromArgb(145, 95, 207, 226), Color.FromArgb(145, 175, 185, 200)
        };
        return Enumerable.Range(0, Math.Max(1, classes.Count)).Select(i => palette[i % palette.Length]).ToArray();
    }

    private static Brush RoleBrush(string role) => role switch
    {
        "gf" => Brushes.Gold,
        "lc4" or "lplc2" => new SolidColorBrush(Color.FromRgb(78, 180, 255)),
        "dna01" or "dna02" => new SolidColorBrush(Color.FromRgb(102, 224, 165)),
        "dnp09" => new SolidColorBrush(Color.FromRgb(244, 211, 94)),
        "dng11" => new SolidColorBrush(Color.FromRgb(193, 115, 235)),
        "mdn" => new SolidColorBrush(Color.FromRgb(238, 138, 75)),
        "escw" => new SolidColorBrush(Color.FromRgb(232, 93, 117)),
        _ => new SolidColorBrush(Color.FromRgb(185, 196, 215))
    };
}
