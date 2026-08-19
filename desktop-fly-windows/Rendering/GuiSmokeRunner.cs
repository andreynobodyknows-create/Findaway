using System;
using System.Linq;
using System.Windows;
using System.Windows.Threading;

namespace DesktopFly.Windows.Rendering;

public static class GuiSmokeRunner
{
    public static void Start()
    {
        var app = Application.Current;
        var window = new MainWindow();
        app.MainWindow = window;
        window.Show();

        var timer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(2)
        };

        timer.Tick += (_, _) =>
        {
            timer.Stop();
            var brainVisible = app.Windows.OfType<BrainWindow>().Any(w => w.IsLoaded && w.IsVisible);
            var ok = window.IsLoaded && window.IsVisible && brainVisible;
            Console.WriteLine($"GUI smoke: overlay loaded={window.IsLoaded}, visible={window.IsVisible}, brain visible={brainVisible}");
            Environment.ExitCode = ok ? 0 : 1;
            window.Close();
            app.Shutdown(Environment.ExitCode);
        };

        timer.Start();
    }
}
