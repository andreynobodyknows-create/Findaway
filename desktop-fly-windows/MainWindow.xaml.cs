using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using DesktopFly.Windows.Core;
using Forms = System.Windows.Forms;
using Point = System.Windows.Point;

namespace DesktopFly.Windows;

public partial class MainWindow : Window
{
    private const int GwlExStyle = -20;
    private const int WsExTransparent = 0x00000020;
    private const int WsExToolWindow = 0x00000080;
    private const int WsExNoActivate = 0x08000000;

    private readonly Stopwatch _clock = Stopwatch.StartNew();
    private readonly Forms.NotifyIcon _tray;
    private LifSimulation? _sim;
    private TimeSpan _last;
    private Point _pos;
    private Point _velocity = new(42, 15);
    private Point _lastCursor;
    private bool _haveCursor;
    private double _heading;
    private double _escapeTimer;
    private bool _debug;

    public MainWindow()
    {
        InitializeComponent();

        _tray = new Forms.NotifyIcon
        {
            Icon = System.Drawing.SystemIcons.Information,
            Visible = true,
            Text = "DesktopFly Windows"
        };
        var menu = new Forms.ContextMenuStrip();
        menu.Items.Add("Scare fly", null, (_, _) => _escapeTimer = 1.0);
        menu.Items.Add("Toggle diagnostics", null, (_, _) => ToggleDebug());
        menu.Items.Add("Quit", null, (_, _) => CloseApp());
        _tray.ContextMenuStrip = menu;

        Loaded += OnLoaded;
        Closed += (_, _) => { _tray.Dispose(); System.Windows.Application.Current.Shutdown(); };
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        Left = SystemParameters.VirtualScreenLeft;
        Top = SystemParameters.VirtualScreenTop;
        Width = SystemParameters.VirtualScreenWidth;
        Height = SystemParameters.VirtualScreenHeight;
        _pos = new Point(Width * 0.55, Height * 0.45);

        var hwnd = new WindowInteropHelper(this).Handle;
        var style = GetWindowLongPtr(hwnd, GwlExStyle).ToInt64();
        style |= WsExTransparent | WsExToolWindow | WsExNoActivate;
        SetWindowLongPtr(hwnd, GwlExStyle, new IntPtr(style));

        var dataPath = Path.Combine(AppContext.BaseDirectory, "data", "circuit.json");
        var circuit = CircuitFile.TryLoad(dataPath);
        if (circuit is { Neurons.Count: > 0 })
            _sim = new LifSimulation(circuit);
        else
        {
            _debug = true;
            DebugPanel.Visibility = Visibility.Visible;
            DebugText.Text = "No data/circuit.json\nRun scripts/fetch-data.ps1, then rebuild.";
        }

        CompositionTarget.Rendering += OnFrame;
    }

    private void OnFrame(object? sender, EventArgs e)
    {
        var now = _clock.Elapsed;
        var dt = Math.Clamp((now - _last).TotalSeconds, 0.001, 0.05);
        _last = now;

        if (!GetCursorPos(out var cursorNative)) return;
        var cursor = new Point(cursorNative.X - Left, cursorNative.Y - Top);
        var cursorVelocity = new Vector();
        if (_haveCursor)
            cursorVelocity = (cursor - _lastCursor) / dt;
        _lastCursor = cursor;
        _haveCursor = true;

        var rel = cursor - _pos;
        var dist = Math.Max(20, rel.Length);
        var approach = -(rel.X * cursorVelocity.X + rel.Y * cursorVelocity.Y) / dist;
        var loom = Math.Clamp(approach / dist * 6, 0, 1) * Math.Clamp(1 - dist / 800, 0, 1);
        loom += Math.Clamp((130 - dist) / 130, 0, 1) * 0.5;
        loom = Math.Clamp(loom, 0, 1);

        var forward = new Vector(Math.Cos(_heading), Math.Sin(_heading));
        var rd = rel / dist;
        var cross = forward.X * rd.Y - forward.Y * rd.X;
        var leftWeight = Math.Clamp(0.5 + 0.5 * cross, 0.12, 1);
        var rightWeight = Math.Clamp(0.5 - 0.5 * cross, 0.12, 1);
        var puff = Math.Clamp(cursorVelocity.Length / 1500, 0, 1) * Math.Clamp(1 - dist / 500, 0, 1);

        BrainSignals signals = default;
        if (_sim is not null)
        {
            _sim.LoomLeft = (float)(loom * leftWeight);
            _sim.LoomRight = (float)(loom * rightWeight);
            _sim.AirPuff = (float)puff;
            signals = _sim.Step(Math.Max(1, (int)Math.Round(dt * 1000)), (float)dt);
        }

        if (signals.Escape || _escapeTimer > 0)
        {
            if (signals.Escape) _escapeTimer = 0.85;
            var away = _pos - cursor;
            if (away.LengthSquared < 1) away = new Vector(1, 0);
            away.Normalize();
            _velocity = new Point(away.X * 680, away.Y * 680);
        }
        else
        {
            var targetSpeed = 26 + signals.WalkDrive * 58;
            _heading += signals.TurnBias * dt + (Random.Shared.NextDouble() - 0.5) * 0.9 * dt;
            var target = new Vector(Math.Cos(_heading), Math.Sin(_heading)) * targetSpeed;
            _velocity = new Point(
                _velocity.X + (target.X - _velocity.X) * Math.Min(1, 2.8 * dt),
                _velocity.Y + (target.Y - _velocity.Y) * Math.Min(1, 2.8 * dt));
        }

        _escapeTimer = Math.Max(0, _escapeTimer - dt);
        _pos.X += _velocity.X * dt;
        _pos.Y += _velocity.Y * dt;
        BounceInsideScreen();

        var speed = Math.Sqrt(_velocity.X * _velocity.X + _velocity.Y * _velocity.Y);
        if (speed > 1) _heading = Math.Atan2(_velocity.Y, _velocity.X);
        FlyRotate.Angle = _heading * 180 / Math.PI + 90;
        var scale = _escapeTimer > 0 ? 1.22 : 1.0;
        FlyScale.ScaleX = scale;
        FlyScale.ScaleY = scale;
        Canvas.SetLeft(FlyVisual, _pos.X - FlyVisual.Width / 2);
        Canvas.SetTop(FlyVisual, _pos.Y - FlyVisual.Height / 2);

        if (_debug && _sim is not null)
        {
            DebugText.Text = $"FlyWire circuit: {_sim.NeuronCount} neurons\n" +
                             $"loom {loom:F2}  nervous {signals.Nervous:F2}\n" +
                             $"walk {signals.WalkDrive:F2}  turn {signals.TurnBias:+0.00;-0.00}\n" +
                             $"escape {(signals.Escape ? "SPIKE" : "-")}";
        }
    }

    private void BounceInsideScreen()
    {
        const double margin = 28;
        if (_pos.X < margin) { _pos.X = margin; _velocity.X = Math.Abs(_velocity.X); }
        if (_pos.X > Width - margin) { _pos.X = Width - margin; _velocity.X = -Math.Abs(_velocity.X); }
        if (_pos.Y < margin) { _pos.Y = margin; _velocity.Y = Math.Abs(_velocity.Y); }
        if (_pos.Y > Height - margin) { _pos.Y = Height - margin; _velocity.Y = -Math.Abs(_velocity.Y); }
    }

    private void ToggleDebug()
    {
        Dispatcher.Invoke(() =>
        {
            _debug = !_debug;
            DebugPanel.Visibility = _debug ? Visibility.Visible : Visibility.Collapsed;
        });
    }

    private void CloseApp() => Dispatcher.Invoke(Close);

    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint { public int X; public int Y; }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetCursorPos(out NativePoint point);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern int GetWindowLong32(IntPtr hWnd, int nIndex);

    private static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex) =>
        IntPtr.Size == 8 ? GetWindowLongPtr64(hWnd, nIndex) : new IntPtr(GetWindowLong32(hWnd, nIndex));

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")]
    private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongW")]
    private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

    private static IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr value) =>
        IntPtr.Size == 8 ? SetWindowLongPtr64(hWnd, nIndex, value) : new IntPtr(SetWindowLong32(hWnd, nIndex, value.ToInt32()));
}
