using System;
using System.Windows;
using DesktopFly.Windows.Core;
using DesktopFly.Windows.Rendering;

namespace DesktopFly.Windows;

public partial class App : System.Windows.Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        if (e.Args.Length > 0)
        {
            if (e.Args[0] == "--guismoke")
            {
                GuiSmokeRunner.Start();
                return;
            }

            var code = e.Args[0] switch
            {
                "--simtest" => TestRunner.RunSimTest(),
                "--behaviortest" => TestRunner.RunBehaviorTest(),
                "--snapshot" when e.Args.Length > 1 => SnapshotRenderer.RenderFly(e.Args[1]),
                "--brainshot" when e.Args.Length > 1 => SnapshotRenderer.RenderBrain(e.Args[1]),
                _ => -1
            };
            if (code >= 0)
            {
                Environment.ExitCode = code;
                Shutdown(code);
                return;
            }
        }

        var window = new MainWindow();
        MainWindow = window;
        window.Show();
    }
}
