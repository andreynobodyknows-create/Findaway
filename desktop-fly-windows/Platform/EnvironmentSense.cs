using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows;

namespace DesktopFly.Windows.Platform;

public readonly record struct Ledge(double Y, double X0, double X1, nint Id);
public readonly record struct WindowLoom(Point Center, double Size);
public readonly record struct WindowSnapshot(IReadOnlyList<Ledge> Ledges, IReadOnlyList<WindowLoom> NewWindows);

public sealed class WindowSense
{
    private readonly HashSet<nint> _known = [];
    private bool _first = true;
    private readonly uint _myPid = (uint)Environment.ProcessId;

    public WindowSnapshot Poll(Rect virtualBounds)
    {
        var ledges = new List<Ledge>(12);
        var fresh = new List<WindowLoom>();
        var ids = new HashSet<nint>();

        EnumWindows((hwnd, _) =>
        {
            if (!IsWindowVisible(hwnd) || hwnd == IntPtr.Zero) return true;
            GetWindowThreadProcessId(hwnd, out var pid);
            if (pid == _myPid) return true;
            if (DwmGetWindowAttribute(hwnd, 14, out int cloaked, sizeof(int)) == 0 && cloaked != 0) return true;
            if (!GetWindowRect(hwnd, out var r)) return true;

            var width = r.Right - r.Left;
            var height = r.Bottom - r.Top;
            if (width < 160 || height < 60) return true;
            if (r.Right < virtualBounds.Left || r.Left > virtualBounds.Right ||
                r.Bottom < virtualBounds.Top || r.Top > virtualBounds.Bottom) return true;

            var cls = new StringBuilder(128);
            GetClassName(hwnd, cls, cls.Capacity);
            var className = cls.ToString();
            if (className is "Progman" or "WorkerW" or "Shell_TrayWnd" or "Shell_SecondaryTrayWnd") return true;

            var exStyle = GetWindowLongPtr(hwnd, -20).ToInt64();
            if ((exStyle & 0x80L) != 0) return true;

            ids.Add(hwnd);
            var topY = Math.Clamp((double)r.Top, virtualBounds.Top + 8, virtualBounds.Bottom - 8);
            var x0 = Math.Max(r.Left, virtualBounds.Left + 15);
            var x1 = Math.Min(r.Right, virtualBounds.Right - 15);
            if (x1 - x0 > 100 && ledges.Count < 12)
                ledges.Add(new Ledge(topY, x0, x1, hwnd));

            if (!_first && !_known.Contains(hwnd))
            {
                fresh.Add(new WindowLoom(
                    new Point((r.Left + r.Right) / 2.0, (r.Top + r.Bottom) / 2.0),
                    Math.Max(width, height)));
            }
            return true;
        }, IntPtr.Zero);

        _known.Clear();
        foreach (var id in ids) _known.Add(id);
        _first = false;
        return new WindowSnapshot(ledges, fresh);
    }

    public static float CircadianActivity(double hour)
    {
        (double H, float V)[] pts =
        [
            (0, .25f), (5, .25f), (8, 1f), (10, 1f), (13, .55f),
            (15, .55f), (17, 1f), (20, 1f), (23, .3f), (24, .25f)
        ];
        for (var i = 0; i < pts.Length - 1; i++)
        {
            if (hour < pts[i].H || hour > pts[i + 1].H) continue;
            var t = (float)((hour - pts[i].H) / Math.Max(.001, pts[i + 1].H - pts[i].H));
            return pts[i].V + (pts[i + 1].V - pts[i].V) * t;
        }
        return .25f;
    }

    public static double UserIdleSeconds()
    {
        var info = new LASTINPUTINFO { cbSize = (uint)Marshal.SizeOf<LASTINPUTINFO>() };
        if (!GetLastInputInfo(ref info)) return 0;
        var now = unchecked((uint)Environment.TickCount);
        return unchecked(now - info.dwTime) / 1000.0;
    }

    private static DateTime _nextThermalProbe = DateTime.MinValue;
    private static double _thermalTempo = 1.0;

    public static double ThermalTempo()
    {
        if (DateTime.UtcNow < _nextThermalProbe) return _thermalTempo;
        _nextThermalProbe = DateTime.UtcNow.AddSeconds(30);
        try
        {
            var locatorType = Type.GetTypeFromProgID("WbemScripting.SWbemLocator");
            if (locatorType is null) return _thermalTempo = 1.0;
            dynamic locator = Activator.CreateInstance(locatorType)!;
            dynamic service = locator.ConnectServer(".", @"root\WMI");
            dynamic results = service.ExecQuery("SELECT CurrentTemperature FROM MSAcpi_ThermalZoneTemperature");
            var hottest = double.MinValue;
            foreach (dynamic item in results)
            {
                double c = ((double)item.CurrentTemperature / 10.0) - 273.15;
                hottest = Math.Max(hottest, c);
            }
            _thermalTempo = hottest switch
            {
                > 75 => 1.50,
                > 60 => 1.35,
                > 45 => 1.15,
                _ => 1.0
            };
        }
        catch
        {
            _thermalTempo = 1.0;
        }
        return _thermalTempo;
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    private struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll")]
    private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern int GetWindowLong32(IntPtr hWnd, int nIndex);
    private static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex) =>
        IntPtr.Size == 8 ? GetWindowLongPtr64(hWnd, nIndex) : new IntPtr(GetWindowLong32(hWnd, nIndex));
}
