# DesktopFly Windows 🪰

A native Windows port of **DesktopFly**: a procedural 3D fruit fly living on the desktop whose high-level behavior is driven by a live 1 kHz spiking simulation of a FlyWire-derived Drosophila circuit.

The Windows port targets feature parity with `DenisSergeevitch/desktop-fly`. See [PARITY.md](PARITY.md) for the macOS → Windows mapping.

## What is implemented

- transparent topmost click-through desktop overlay;
- procedural 3D fly with body, compound eyes, antennae, six articulated legs and translucent wings;
- tripod gait, grooming, backward walking, nervous darting, wing raising, flight effort, altitude scaling, smooth landing and sleep breathing;
- 668-neuron FlyWire circuit at 1 ms LIF resolution with the original model constants;
- LC4/LPLC2 looming, GF escape, DNa steering, DNp09 walking, DNg11 grooming, MDN backward locomotion and DNp02/04/11 wing effort;
- body → brain gait feedback through ascending partners and cursor wind through sensory partners;
- live rotating brain window with 23,210 FlyWire soma positions and simulated spike flashes;
- click a brain region to stimulate nearby circuit neurons for 400 ms;
- real Windows window edges as ledges, moving-window tracking, lost-ledge takeoff and new-window looming;
- mouse clicks as substrate taps and keyboard timing as vibration (the app never records which key was pressed);
- circadian activity, idle-driven sleep and thermal tempo where Windows firmware exposes ACPI thermal telemetry;
- multiple flies: only fly #1 carries the connectome simulation, matching the reference project;
- multi-monitor display hopping;
- tray controls: Pause/Resume, Show/Hide Brain, Escape Test, Move Display, Add/Remove Fly, Scare Flies, Diagnostics, Quit;
- `--simtest`, `--behaviortest`, `--snapshot` and `--brainshot` diagnostic modes.

## Requirements for source launch

- Windows 10 or Windows 11 x64
- .NET 8 SDK
- Git
- PowerShell

## Run from source

```powershell
git clone https://github.com/andreynobodyknows-create/Findaway.git
cd Findaway
git switch agent/desktop-fly-windows
cd desktop-fly-windows
.\scripts\fetch-data.ps1
dotnet run -c Release
```

The FlyWire-derived data are intentionally fetched separately because they are CC BY-NC 4.0 while the application code is MIT-compatible.

## Diagnostics

```powershell
dotnet run -c Release -- --simtest
dotnet run -c Release -- --behaviortest
dotnet run -c Release -- --snapshot fly.png
dotnet run -c Release -- --brainshot brain.png
```

## Build a portable Windows package

```powershell
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
```

Run `publish\DesktopFly.Windows.exe`. Keep the generated `publish\data` directory beside the executable.

GitHub Actions performs data retrieval, circuit/behavior tests, Release build and a self-contained `win-x64` publish. The resulting portable package is uploaded as the `DesktopFly-Windows-win-x64` workflow artifact.

## Scientific scope

The graph topology, neuron identities, soma positions, synapse counts and neurotransmitter predictions come from the FlyWire-derived dataset. LIF dynamics, neurotransmitter sign mapping, global weight scale, inhibitory delay, gap-junction boost, sensory transduction and body mapping remain model assumptions, exactly as in the reference project’s honesty section.

Reference: `DenisSergeevitch/desktop-fly` / FlyWire FAFB v783.
