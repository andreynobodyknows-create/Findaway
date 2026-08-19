# DesktopFly Windows

Native Windows port of the DesktopFly concept: a click-through desktop fruit fly whose high-level behavior is driven by a live spiking simulation of a FlyWire-derived Drosophila circuit.

## Demo-ready build

The portable `win-x64` package produced by GitHub Actions is self-contained: extract it and run `DesktopFly.Windows.exe`. No .NET SDK is required.

For a presentation, launch the app once on the exact machine/display setup before the meeting. The binary is currently unsigned, so Windows security policy may show a SmartScreen/unknown-publisher warning on first launch.

## Implemented parity

- transparent, topmost, click-through WPF desktop overlay;
- procedural 3D fly: body, eyes, antennae, six articulated legs, wings and shadow;
- tripod gait, grooming, backward walking, nervous darting, flight/altitude/landing and sleep breathing;
- FlyWire `circuit.json` + `brain_points.json` data loading;
- 668-neuron, 1 kHz LIF simulation with LC4/LPLC2, Giant Fiber, DNa01/02, DNp09, DNg11, MDN, DNp02/04/11, ascending and sensory partners;
- delayed inhibition, gap boost, noise/arousal bursts, gait proprioception and air-puff drive;
- cursor looming split by anatomical left/right, GF-gated escape, DNa steering and command-neuron behavior mapping;
- live brain view with 23,210 soma points, live spike flashes and click stimulation;
- Win32 application-window top edges as ledges, dragged-window tracking, lost-ledge takeoff and new-window looming;
- global clicks as substrate taps; keyboard timing only as vibration (key identity is never recorded);
- circadian activity, idle-driven sleep, sensory gating and non-blocking thermal telemetry with neutral fallback;
- multiple flies (connectome only on fly #1), multi-monitor hopping and tray controls;
- `--simtest`, `--behaviortest`, `--snapshot`, `--brainshot` diagnostics.

See `PARITY.md` for the macOS → Windows capability mapping.

## Validation

GitHub Actions on Windows runs the following gate before publishing the demo artifact:

1. fetch and structurally verify FlyWire data;
2. Release build;
3. circuit regression (`--simtest`);
4. 17 behavior regression checks (`--behaviortest`), including directional DNa-left steering;
5. fly PNG smoke render;
6. brain PNG smoke render;
7. self-contained single-file `win-x64` publish;
8. package-content/license verification with no debug PDB;
9. launch the **published EXE**, verify both overlay and live brain window become visible, then exit cleanly;
10. upload the portable artifact.

## Source/data licensing

The upstream DesktopFly source-code basis is MIT licensed; see `LICENSE`. FlyWire-derived files in `data/` are distributed separately under CC BY-NC 4.0; see `data/DATA_LICENSE.md`.

## Build from source

Requirements: Windows 10/11 x64, .NET 8 SDK, PowerShell.

```powershell
.\scripts\fetch-data.ps1
dotnet build -c Release
dotnet run -c Release
```

Diagnostics:

```powershell
dotnet run -c Release -- --simtest
dotnet run -c Release -- --behaviortest
dotnet run -c Release -- --snapshot fly.png
dotnet run -c Release -- --brainshot brain.png
```

Reference project: `DenisSergeevitch/desktop-fly`.
