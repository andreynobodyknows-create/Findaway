using System;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Threading;

namespace DesktopFly.Windows.Rendering;

public static class GuiSmokeRunner
{
    private static readonly string LogPath = Path.Combine(Environment.CurrentDirectory, "guismoke.log");

    private static void Log(string message)
    {
        try { File.AppendAllText(LogPath, $"{DateTime.UtcNow:O} {message}{Environment.NewLine}"); }
        catch { }
    }

    public static void Start()
    {
        try { if (File.Exists(LogPath)) File.Delete(LogPath); } catch { }
        Log("runner start");
        var app = Application.Current;
        Log("before MainWindow ctor");
        var window = new MainWindow();
        Log("after MainWindow ctor");
        app.MainWindow = window;
        Log("before MainWindow.Show");
        window.Show();
        Log("after MainWindow.Show");

        var timer = new DispatcherTimer(DispatcherPriority.Send)
        {
            Interval = TimeSpan.FromSeconds(2)
        };

        timer.Tick += (_, _) =>
        {
            timer.Stop();
            Log("timer tick");
            var brainVisible = app.Windows.OfType<BrainWindow>().Any(w => w.IsLoaded && w.IsVisible);
            var ok = window.IsLoaded && window.IsVisible && brainVisible;
            Log($"overlay loaded={window.IsLoaded}, visible={window.IsVisible}, brain visible={brainVisible}");
            Environment.ExitCode = ok ? 0 : 1;
            window.Close();
            Log("window closed; shutting down");
            app.Shutdown(Environment.ExitCode);
        };

        timer.Start();
        Log("timer started");
    }
}
