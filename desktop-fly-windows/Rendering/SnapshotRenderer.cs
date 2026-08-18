using System;
using System.Linq;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Media.Media3D;
using DesktopFly.Windows.Core;

namespace DesktopFly.Windows.Rendering;

public static class SnapshotRenderer
{
    public static int RenderFly(string path)
    {
        try
        {
            const int w = 720, h = 720;
            var viewport = new Viewport3D { Width = w, Height = h };
            viewport.Camera = new PerspectiveCamera(new Point3D(30, -58, 42), new Vector3D(-30, 58, -36), new Vector3D(0, 0, 1), 42);
            viewport.Children.Add(new ModelVisual3D { Content = new AmbientLight(Color.FromRgb(150, 150, 150)) });
            viewport.Children.Add(new ModelVisual3D { Content = new DirectionalLight(Colors.White, new Vector3D(-.6, .5, -1)) });
            var fly = new Fly(new Point(w / 2, h / 2), 2) { State = Fly.FlyState.Walking, Speed = 45, Heading = Math.PI / 2 };
            fly.Update(.05, new Rect(0, 0, w, h), null, new BrainSignals(WalkDrive: .8f));
            viewport.Children.Add(fly.Visual.Shadow); viewport.Children.Add(fly.Visual.Root);
            var grid = new Grid { Width = w, Height = h, Background = new SolidColorBrush(Color.FromRgb(240, 240, 240)) };
            grid.Children.Add(viewport);
            SaveVisual(grid, w, h, path);
            Console.WriteLine($"snapshot written to {path}");
            return 0;
        }
        catch (Exception ex) { Console.Error.WriteLine($"snapshot: {ex.Message}"); return 1; }
    }

    public static int RenderBrain(string path)
    {
        try
        {
            var data = BrainDataLoader.TryLoad();
            if (data is null) { Console.Error.WriteLine("no data/"); return 2; }
            var sim = new LifSimulation(data.Circuit, 3);
            sim.Stimulate(Enumerable.Range(0, Math.Min(40, sim.NeuronCount)), .35f, 60); sim.Step(40);
            var canvas = new BrainCanvas(data.Points, data.Circuit, sim) { Width = 720, Height = 560, Yaw = .5, Pitch = -.15 };
            canvas.AdvanceFlashes();
            SaveVisual(canvas, 720, 560, path);
            Console.WriteLine($"brainshot written to {path}");
            return 0;
        }
        catch (Exception ex) { Console.Error.WriteLine($"brainshot: {ex.Message}"); return 1; }
    }

    private static void SaveVisual(FrameworkElement visual, int width, int height, string path)
    {
        visual.Measure(new Size(width, height));
        visual.Arrange(new Rect(0, 0, width, height));
        visual.UpdateLayout();
        var bitmap = new RenderTargetBitmap(width, height, 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(visual);
        var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var fs = File.Create(path); encoder.Save(fs);
    }
}
