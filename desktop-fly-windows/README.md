# DesktopFly Windows MVP

Windows port of the DesktopFly concept: a click-through desktop fly whose high-level behavior is driven by a live spiking simulation of a FlyWire-derived Drosophila circuit.

## Current MVP

Implemented:

- transparent, topmost, click-through WPF desktop overlay;
- system tray controls (scare, diagnostics, quit);
- cursor kinematics converted to left/right looming input;
- air-puff input from fast nearby cursor movement;
- FlyWire `circuit.json` loader;
- 1 ms leaky-integrate-and-fire simulation using the same modeling constants as the macOS reference implementation;
- LC4/LPLC2 activity, Giant Fiber escape trigger, DNa steering and DNp09 locomotor drive;
- diagnostics overlay showing live neural signals.

Not yet implemented:

- procedural 3D body / wing and leg animation;
- interactive 3D brain point-cloud window;
- walking on top edges of real Windows application windows;
- click/tap, idle, circadian and thermal inputs;
- behavioral regression suite matching the macOS reference.

## Requirements

- Windows 10/11 x64
- .NET 8 SDK
- PowerShell

## Get FlyWire-derived data

The original source code is MIT licensed, but its derived FlyWire data is distributed separately under CC BY-NC 4.0. This repository therefore does not duplicate those data files automatically in git.

From PowerShell:

```powershell
cd desktop-fly-windows
.\scripts\fetch-data.ps1
```

This downloads `circuit.json`, `brain_points.json`, and the accompanying data license from the upstream DesktopFly repository.

## Build and run

```powershell
dotnet build -c Release
dotnet run -c Release
```

The fly appears on a transparent overlay and does not consume mouse clicks. Use the tray icon to toggle diagnostics or exit.

## Architecture

```text
Windows cursor
    |
    v
looming / air-puff transduction
    |
    v
FlyWire circuit.json
    |
    v
1 kHz LIF network
    |
    +--> Giant Fiber spike --> escape
    +--> DNa L-R rate ------> steering
    +--> DNp09 rate --------> walking speed
    +--> population rate ---> arousal (future behavior)
```

## Scientific scope

The graph topology, neuron identities, soma positions, synapse counts and neurotransmitter predictions originate from FlyWire-derived data. The LIF dynamics, synaptic scaling, inhibitory delay, gap-junction boost, sensory transduction and body mapping are modeling choices rather than measured physiology.

Reference project: `DenisSergeevitch/desktop-fly`.
