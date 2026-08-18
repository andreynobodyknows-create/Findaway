using System;
using System.Threading;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows;

namespace DesktopFly.Windows.Platform;

public sealed class InputSense : IDisposable
{
    private const int WhMouseLl = 14;
    private const int WhKeyboardLl = 13;
    private const int WmLButtonDown = 0x0201;
    private const int WmRButtonDown = 0x0204;
    private const int WmKeyDown = 0x0100;
    private const int WmSysKeyDown = 0x0104;

    private readonly HookProc _mouseProc;
    private readonly HookProc _keyboardProc;
    private IntPtr _mouseHook;
    private IntPtr _keyboardHook;
    private long _lastClickTicks;
    private int _clickX;
    private int _clickY;
    private long _consumedClickTicks;
    private long _lastKeyTicks;

    public InputSense()
    {
        _mouseProc = MouseHook;
        _keyboardProc = KeyboardHook;
        using var process = Process.GetCurrentProcess();
        using var module = process.MainModule;
        var moduleHandle = GetModuleHandle(module?.ModuleName);
        _mouseHook = SetWindowsHookEx(WhMouseLl, _mouseProc, moduleHandle, 0);
        _keyboardHook = SetWindowsHookEx(WhKeyboardLl, _keyboardProc, moduleHandle, 0);
    }

    public double TypingLevel
    {
        get
        {
            var ticks = Interlocked.Read(ref _lastKeyTicks);
            if (ticks == 0) return 0;
            return (DateTime.UtcNow.Ticks - ticks) / (double)TimeSpan.TicksPerSecond < .6 ? 1.0 : 0.0;
        }
    }

    public bool TryConsumeClick(out Point point)
    {
        var ticks = Interlocked.Read(ref _lastClickTicks);
        if (ticks == 0 || ticks == Interlocked.Read(ref _consumedClickTicks))
        {
            point = default;
            return false;
        }
        Interlocked.Exchange(ref _consumedClickTicks, ticks);
        point = new Point(Volatile.Read(ref _clickX), Volatile.Read(ref _clickY));
        return true;
    }

    private IntPtr MouseHook(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0 && (wParam.ToInt32() == WmLButtonDown || wParam.ToInt32() == WmRButtonDown))
        {
            var data = Marshal.PtrToStructure<MSLLHOOKSTRUCT>(lParam);
            Volatile.Write(ref _clickX, data.pt.x);
            Volatile.Write(ref _clickY, data.pt.y);
            Interlocked.Exchange(ref _lastClickTicks, DateTime.UtcNow.Ticks);
        }
        return CallNextHookEx(_mouseHook, code, wParam, lParam);
    }

    private IntPtr KeyboardHook(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0 && (wParam.ToInt32() == WmKeyDown || wParam.ToInt32() == WmSysKeyDown))
            Interlocked.Exchange(ref _lastKeyTicks, DateTime.UtcNow.Ticks);
        return CallNextHookEx(_keyboardHook, code, wParam, lParam);
    }

    public void Dispose()
    {
        if (_mouseHook != IntPtr.Zero) { UnhookWindowsHookEx(_mouseHook); _mouseHook = IntPtr.Zero; }
        if (_keyboardHook != IntPtr.Zero) { UnhookWindowsHookEx(_keyboardHook); _keyboardHook = IntPtr.Zero; }
        GC.SuppressFinalize(this);
    }

    private delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)] private struct POINT { public int x, y; }
    [StructLayout(LayoutKind.Sequential)] private struct MSLLHOOKSTRUCT
    {
        public POINT pt;
        public uint mouseData, flags, time;
        public UIntPtr dwExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll")]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr GetModuleHandle(string? lpModuleName);
}
