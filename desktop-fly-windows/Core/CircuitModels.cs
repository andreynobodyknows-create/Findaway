using System.Text.Json;
using System.Text.Json.Serialization;

namespace DesktopFly.Windows.Core;

public sealed class CircuitFile
{
    [JsonPropertyName("neurons")]
    public List<CircuitNeuron> Neurons { get; set; } = [];

    [JsonPropertyName("edges")]
    public List<float[]> Edges { get; set; } = [];

    [JsonPropertyName("source")]
    public string? Source { get; set; }

    public static CircuitFile? TryLoad(string path)
    {
        if (!File.Exists(path)) return null;
        try
        {
            return JsonSerializer.Deserialize<CircuitFile>(File.ReadAllText(path));
        }
        catch
        {
            return null;
        }
    }
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

public readonly record struct BrainSignals(
    bool Escape,
    float Nervous,
    float TurnBias,
    float WalkDrive,
    float GroomDrive,
    bool Backward,
    float Arousal);
