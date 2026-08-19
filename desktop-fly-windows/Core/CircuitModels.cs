using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DesktopFly.Windows.Core;

public sealed class BrainPointsFile
{
    [JsonPropertyName("classes")]
    public List<string> Classes { get; set; } = [];

    [JsonPropertyName("points")]
    public List<float[]> Points { get; set; } = [];
}

public sealed class CircuitFile
{
    [JsonPropertyName("neurons")]
    public List<CircuitNeuron> Neurons { get; set; } = [];

    [JsonPropertyName("edges")]
    public List<float[]> Edges { get; set; } = [];

    [JsonPropertyName("source")]
    public string? Source { get; set; }
}

public sealed class CircuitNeuron
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    [JsonPropertyName("role")]
    public string Role { get; set; } = "other";

    [JsonPropertyName("side")]
    public string Side { get; set; } = "center";

    [JsonPropertyName("pos")]
    public float[] Pos { get; set; } = [];
}

public sealed record BrainData(BrainPointsFile Points, CircuitFile Circuit);

public static class BrainDataLoader
{
    public static string? FindDataDir()
    {
        var exe = AppContext.BaseDirectory;
        var cwd = Environment.CurrentDirectory;
        foreach (var dir in new[] { Path.Combine(exe, "data"), Path.Combine(cwd, "data") })
        {
            if (File.Exists(Path.Combine(dir, "circuit.json"))) return dir;
        }
        return null;
    }

    public static BrainData? TryLoad(string? explicitDir = null)
    {
        var dir = explicitDir ?? FindDataDir();
        if (dir is null) return null;
        try
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var circuit = JsonSerializer.Deserialize<CircuitFile>(File.ReadAllText(Path.Combine(dir, "circuit.json")), options);
            var points = JsonSerializer.Deserialize<BrainPointsFile>(File.ReadAllText(Path.Combine(dir, "brain_points.json")), options);
            return circuit is null || points is null ? null : new BrainData(points, circuit);
        }
        catch
        {
            return null;
        }
    }
}

public readonly record struct BrainSignals(
    bool Escape = false,
    float Nervous = 0,
    float TurnBias = 0,
    bool Backward = false,
    float WalkDrive = 0,
    float GroomDrive = 0,
    float WingDrive = 0,
    float Arousal = 0,
    float Tempo = 1,
    bool Sleep = false);
