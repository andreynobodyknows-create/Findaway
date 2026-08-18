using System;
using System.Collections.Generic;
using System.Linq;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Media3D;
using DesktopFly.Windows.Core;
using DesktopFly.Windows.Platform;
using DesktopFly.Windows.Rendering;
using Forms = System.Windows.Forms;
using WpfPoint = System.Windows.Point;
using WpfRect = System.Windows.Rect;

namespace DesktopFly.Windows;

public partial class MainWindow : Window
{
    private const int GwlExStyle = -20;
    private const int WsExTransparent = 0x00000020;
    private const int WsExToolWindow = 0x00000080;
    private const int WsExNoActivate = 0x08000000;

    private readonly Stopwatch _clock = Stopwatch.StartNew();
    private readonly Forms.NotifyIcon _tray;
    private readonly WindowSense _windowSense = new();
    private readonly InputSense _inputSense = new();
    private readonly List<Fly> _flies = [];
    private readonly SignalBuilder _signalBuilder = new();
    private readonly Random _rng = new();
    private LifSimulation? _sim;
    private BrainData? _data;
    private BrainWindow? _brainWindow;
    private OrthographicCamera? _camera;
    private TimeSpan _lastFrame;
    private double _lastWindowPoll;
    private double _msAccumulator;
    private WpfPoint? _previousMouse;
    private Vector _mouseVelocity;
    private double _loomOverride;
    private float _windowLoomLeft;
    private float _windowLoomRight;
    private double _typingLevel;
    private bool _paused;
    private bool _debug;
    private IReadOnlyList<Ledge> _terrain = [];
    private WpfRect _virtualBounds;
    private WpfRect _activeDisplayBounds;
    private string _dataInfo = "no data";

    public MainWindow()
    {
        InitializeComponent();
        _tray = BuildTray();
        Loaded += OnLoaded;
        Closed += OnClosed;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _virtualBounds = new WpfRect(SystemParameters.VirtualScreenLeft, SystemParameters.VirtualScreenTop,
            SystemParameters.VirtualScreenWidth, SystemParameters.VirtualScreenHeight);
        Left = _virtualBounds.Left;
        Top = _virtualBounds.Top;
        Width = _virtualBounds.Width;
        Height = _virtualBounds.Height;
        _activeDisplayBounds = ScreenRect(Forms.Screen.PrimaryScreen ?? Forms.Screen.AllScreens[0]);

        var hwnd = new WindowInteropHelper(this).Handle;
        var style = GetWindowLongPtr(hwnd, GwlExStyle).ToInt64();
        style |= WsExTransparent | WsExToolWindow | WsExNoActivate;
        SetWindowLongPtr(hwnd, GwlExStyle, new IntPtr(style));

        SetupScene();
        _data = BrainDataLoader.TryLoad();
        if (_data is not null)
        {
            _sim = new LifSimulation(_data.Circuit);
            _dataInfo = $"FlyWire v783 · {_data.Points.Points.Count:N0} somas · circuit {_data.Circuit.Neurons.Count}n/{_data.Circuit.Edges.Count}e";
            _brainWindow = CreateBrainWindow(_data.Points, _data.Circuit, _sim);
            _brainWindow.Show();
        }
        else
        {
            _debug = true;
            DebugPanel.Visibility = Visibility.Visible;
            DebugText.Text = "No data/circuit.json\nRun scripts/fetch-data.ps1, then restart.";
        }

        AddFlyNow();
        CompositionTarget.Rendering += OnFrame;
    }

    private void SetupScene()
    {
        _camera = new OrthographicCamera
        {
            Position = new Point3D(0, 0, 300),
            LookDirection = new Vector3D(0, 0, -1),
            UpDirection = new Vector3D(0, 1, 0),
            Width = Math.Max(1, _virtualBounds.Width)
        };
        Viewport.Camera = _camera;

        var ambient = new ModelVisual3D
        {
            Content = new AmbientLight(Color.FromRgb(185, 185, 185))
        };
        var directional = new ModelVisual3D
        {
            Content = new DirectionalLight(Colors.White, new Vector3D(-.3, .35, -1))
        };
        Viewport.Children.Add(ambient);
        Viewport.Children.Add(directional);
    }

    private Forms.NotifyIcon BuildTray()
    {
        var tray = new Forms.NotifyIcon
        {
            Icon = System.Drawing.SystemIcons.Information,
            Visible = true,
            Text = "DesktopFly Windows"
        };
        var menu = new Forms.ContextMenuStrip();
        menu.Items.Add("Pause / Resume", null, (_, _) => Dispatcher.Invoke(() => _paused = !_paused));
        menu.Items.Add("Show / Hide Brain", null, (_, _) => Dispatcher.Invoke(ToggleBrain));
        menu.Items.Add("Escape Test (loom)", null, (_, _) => Dispatcher.Invoke(() => _loomOverride = .6));
        menu.Items.Add("Move to Next Display", null, (_, _) => Dispatcher.Invoke(MoveToNextDisplay));
        menu.Items.Add(new Forms.ToolStripSeparator());
        menu.Items.Add("Add Fly", null, (_, _) => Dispatcher.Invoke(AddFlyNow));
        menu.Items.Add("Remove Fly", null, (_, _) => Dispatcher.Invoke(RemoveFly));
        menu.Items.Add("Scare Flies", null, (_, _) => Dispatcher.Invoke(ScareAll));
        menu.Items.Add("Toggle Diagnostics", null, (_, _) => Dispatcher.Invoke(ToggleDebug));
        menu.Items.Add(new Forms.ToolStripSeparator());
        menu.Items.Add("Quit", null, (_, _) => Dispatcher.Invoke(Close));
        tray.ContextMenuStrip = menu;
        return tray;
    }

    private void OnFrame(object? sender, EventArgs e)
    {
        var now = _clock.Elapsed;
        var dt = Math.Clamp((now - _lastFrame).TotalSeconds, 0, .05);
        _lastFrame = now;
        if (dt <= 0 || _paused) return;

        if (now.TotalSeconds - _lastWindowPoll >= .7)
        {
            _lastWindowPoll = now.TotalSeconds;
            PollWindows();
        }

        var mouse = GetMousePosition();
        ProcessTap();
        var signals = UpdateBrain(dt, mouse);

        for (var i = 0; i < _flies.Count; i++)
        {
            var fly = _flies[i];
            fly.Terrain = _terrain;
            fly.Update(dt, _activeDisplayBounds, mouse, i == 0 ? signals : null, _virtualBounds);
        }

        if (_debug) UpdateDiagnostics(signals);
    }

    private BrainSignals? UpdateBrain(double dt, WpfPoint mouse)
    {
        if (_sim is null || _flies.Count == 0) return null;
        var fly = _flies[0];
        var sensory = ComputeLoom(fly, mouse, dt);
        var decay = (float)Math.Exp(-4 * dt);
        _windowLoomLeft *= decay;
        _windowLoomRight *= decay;
        _sim.LoomLeft = Math.Max(sensory.L, _windowLoomLeft);
        _sim.LoomRight = Math.Max(sensory.R, _windowLoomRight);

        _typingLevel += (_inputSense.TypingLevel - _typingLevel) * .15;
        _sim.AirPuff = Math.Max(sensory.Puff, (float)(_typingLevel * .30));
        _sim.GaitDrive = (float)fly.WalkingIntensity;
        _sim.GaitPhase = (float)fly.GaitPhase;

        var idle = WindowSense.UserIdleSeconds();
        var local = DateTime.Now;
        var hour = local.Hour + local.Minute / 60.0;
        var sleepy = (idle > 600 && (hour >= 22 || hour < 6)) || idle > 1800;
        var activity = WindowSense.CircadianActivity(hour);
        _sim.ActivityScale = (1 - (1 - activity) * .35f) * (sleepy ? .75f : 1f);
        _sim.SensoryGate = sleepy ? .55f : 1f;

        _loomOverride = Math.Max(0, _loomOverride - dt * 1.2);
        _msAccumulator += dt * 1000;
        var steps = Math.Min(50, (int)_msAccumulator);
        _msAccumulator -= steps;
        _sim.Step(steps);
        return _signalBuilder.Make(_sim, dt, (float)WindowSense.ThermalTempo(), sleepy);
    }

    private (float L, float R, float Puff) ComputeLoom(Fly fly, WpfPoint mouse, double dt)
    {
        if (_previousMouse is WpfPoint pm && dt > 0)
        {
            var v = (mouse - pm) / dt;
            _mouseVelocity.X += (v.X - _mouseVelocity.X) * .4;
            _mouseVelocity.Y += (v.Y - _mouseVelocity.Y) * .4;
        }
        _previousMouse = mouse;
        var rel = mouse - fly.Position;
        var dist = Math.Max(20, rel.Length);
        var approach = -(rel.X * _mouseVelocity.X + rel.Y * _mouseVelocity.Y) / dist;
        var loom = Math.Clamp(approach / dist * 6, 0, 1) * Math.Clamp(1 - dist / 800, 0, 1);
        loom += Math.Clamp((130 - dist) / 130, 0, 1) * .5;
        loom = Math.Clamp(loom + _loomOverride, 0, 1);
        var fx = Math.Cos(fly.Heading); var fy = Math.Sin(fly.Heading);
        var rdx = rel.X / dist; var rdy = rel.Y / dist;
        var cross = fx * rdy - fy * rdx;
        var lw = Math.Clamp(.5 + .5 * cross, .12, 1);
        var rw = Math.Clamp(.5 - .5 * cross, .12, 1);
        var puff = Math.Clamp(_mouseVelocity.Length / 1500, 0, 1) * Math.Clamp(1 - dist / 500, 0, 1);
        return ((float)(loom * lw), (float)(loom * rw), (float)puff);
    }

    private void PollWindows()
    {
        var snap = _windowSense.Poll(_activeDisplayBounds);
        _terrain = snap.Ledges;
        if (_flies.Count == 0) return;
        var fly = _flies[0];
        foreach (var window in snap.NewWindows)
        {
            var rel = window.Center - fly.Position;
            var dist = Math.Max(1, rel.Length);
            var strength = Math.Clamp(1 - dist / 480, 0, 1) * .75;
            if (strength <= .08) continue;
            var fx = Math.Cos(fly.Heading); var fy = Math.Sin(fly.Heading);
            var cross = (fx * rel.Y - fy * rel.X) / dist;
            _windowLoomLeft = Math.Max(_windowLoomLeft, (float)(strength * Math.Clamp(.5 + .5 * cross, .12, 1)));
            _windowLoomRight = Math.Max(_windowLoomRight, (float)(strength * Math.Clamp(.5 - .5 * cross, .12, 1)));
        }
    }

    private void ProcessTap()
    {
        if (_sim is null || _flies.Count == 0 || !_inputSense.TryConsumeClick(out var p)) return;
        var d = (p - _flies[0].Position).Length;
        var strength = (float)Math.Clamp(1 - d / 520, 0, 1);
        if (strength > .05f)
            _sim.Stimulate(_sim.SensoryIndices, .15f + strength * .35f, 130);
    }

    private void AddFlyNow()
    {
        var p = new WpfPoint(
            Rnd(_activeDisplayBounds.Left + 100, _activeDisplayBounds.Right - 100),
            Rnd(_activeDisplayBounds.Top + 100, _activeDisplayBounds.Bottom - 100));
        var fly = new Fly(p);
        _flies.Add(fly);
        Viewport.Children.Add(fly.Visual.Shadow);
        Viewport.Children.Add(fly.Visual.Root);
    }

    private void RemoveFly()
    {
        if (_flies.Count <= 1) return;
        var fly = _flies[^1];
        Viewport.Children.Remove(fly.Visual.Root);
        Viewport.Children.Remove(fly.Visual.Shadow);
        _flies.RemoveAt(_flies.Count - 1);
    }

    private void ScareAll()
    {
        _loomOverride = .6;
        foreach (var fly in _flies.Skip(1))
            if (fly.State != Fly.FlyState.Flying) fly.StartFlight(_activeDisplayBounds);
    }

    private void MoveToNextDisplay()
    {
        var screens = Forms.Screen.AllScreens;
        if (screens.Length < 2 || _flies.Count == 0) return;
        var p = _flies[0].Position;
        var current = Array.FindIndex(screens, s => ScreenRect(s).Contains(p));
        if (current < 0) current = 0;
        var next = screens[(current + 1) % screens.Length];
        _activeDisplayBounds = ScreenRect(next);
        var center = new WpfPoint(_activeDisplayBounds.Left + _activeDisplayBounds.Width / 2,
            _activeDisplayBounds.Top + _activeDisplayBounds.Height / 2);
        for (var i = 0; i < _flies.Count; i++)
        {
            _flies[i].AttachedLedge = null;
            _flies[i].Position = new WpfPoint(center.X + (i - _flies.Count / 2.0) * 45, center.Y);
        }
        _terrain = [];
        _lastWindowPoll = 0;
    }

    private void ToggleBrain()
    {
        if (_brainWindow is null && _data is not null && _sim is not null)
        {
            _brainWindow = CreateBrainWindow(_data.Points, _data.Circuit, _sim);
            _brainWindow.Show();
        }
        else if (_brainWindow is not null)
        {
            if (_brainWindow.IsVisible) _brainWindow.Hide(); else _brainWindow.Show();
        }
    }

    private BrainWindow CreateBrainWindow(BrainPointsFile points, CircuitFile circuit, LifSimulation sim)
    {
        var window = new BrainWindow(points, circuit, sim);
        PlaceBrainWindow(window);
        window.Closed += (_, _) => _brainWindow = null;
        return window;
    }

    private static void PlaceBrainWindow(Window window)
    {
        var work = SystemParameters.WorkArea;
        window.Left = work.Right - window.Width - 30;
        window.Top = work.Top + 30;
    }

    private void ToggleDebug()
    {
        _debug = !_debug;
        DebugPanel.Visibility = _debug ? Visibility.Visible : Visibility.Collapsed;
    }

    private void UpdateDiagnostics(BrainSignals? s)
    {
        if (_sim is null)
        {
            DebugText.Text = "DesktopFly · no circuit data";
            return;
        }
        DebugText.Text = $"{_dataInfo}\n" +
                         $"flies {_flies.Count} · windows {_terrain.Count} · display {_activeDisplayBounds.Width:0}×{_activeDisplayBounds.Height:0}\n" +
                         $"LC {_sim.RateLoom,5:0.0} Hz · DNa {_sim.RateDnaLeft,5:0.0}/{_sim.RateDnaRight,5:0.0} · GF {(s?.Escape == true ? "SPIKE" : "-")}\n" +
                         $"walk {(s?.WalkDrive ?? 0):0.00} · groom {(s?.GroomDrive ?? 0):0.00} · wing {(s?.WingDrive ?? 0):0.00} · arousal {(s?.Arousal ?? 0):0.00}\n" +
                         $"state {_flies.FirstOrDefault()?.State} · sleep {s?.Sleep} · tempo {(s?.Tempo ?? 1):0.00}";
    }

    private WpfPoint GetMousePosition()
    {
        if (!GetCursorPos(out var p)) return _flies.Count > 0 ? _flies[0].Position : new WpfPoint();
        return new WpfPoint(p.X, p.Y);
    }

    private void OnClosed(object? sender, EventArgs e)
    {
        CompositionTarget.Rendering -= OnFrame;
        _brainWindow?.Close();
        _inputSense.Dispose();
        _tray.Dispose();
        Application.Current.Shutdown();
    }

    private double Rnd(double lo, double hi) => lo + _rng.NextDouble() * (hi - lo);
    private static WpfRect ScreenRect(Forms.Screen screen)
        => new(screen.Bounds.Left, screen.Bounds.Top, screen.Bounds.Width, screen.Bounds.Height);

    [StructLayout(LayoutKind.Sequential)] private struct NativePoint { public int X; public int Y; }
    [DllImport("user32.dll")][return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetCursorPos(out NativePoint point);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern int GetWindowLong32(IntPtr hWnd, int nIndex);
    private static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex) =>
        IntPtr.Size == 8 ? GetWindowLongPtr64(hWnd, nIndex) : new IntPtr(GetWindowLong32(hWnd, nIndex));
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")]
    private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr value);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongW")]
    private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int value);
    private static IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr value) =>
        IntPtr.Size == 8 ? SetWindowLongPtr64(hWnd, nIndex, value) : new IntPtr(SetWindowLong32(hWnd, nIndex, value.ToInt32()));
}
