# DesktopFly macOS → Windows parity

This port intentionally mirrors the observable behavior of `DenisSergeevitch/desktop-fly` while replacing Cocoa/SceneKit APIs with WPF + Win32 equivalents.

| Original capability | Windows implementation |
|---|---|
| Transparent click-through desktop overlay | Borderless WPF overlay + `WS_EX_TRANSPARENT/NOACTIVATE` |
| Procedural 3D fly | WPF `Viewport3D`, procedural meshes, six articulated legs, wings and shadow |
| Tripod gait | Same stance fraction, phase offsets, amplitude/frequency equations |
| Grooming / idle / walking / flying / sleeping states | Ported state machine and thresholds |
| Altitude-scaled flight and smooth landing | Ported flight envelope, wobble, pitch, effort and descent |
| 668-neuron 1 kHz LIF network | Ported constants, groups, signed weights, delayed inhibition and gap boost |
| LC4/LPLC2 looming | Same cursor angular-expansion transduction |
| GF escape | Real simulated GF spike gates escape takeoff |
| DNa steering | Same L/R EMA difference and 8 s baseline adaptation |
| DNp09 walking | Same rate mapping and hysteresis |
| DNg11 grooming | Same rate mapping and hysteresis |
| MDN backward walking | Same burst threshold and 0.5 s backward command |
| DNp02/04/11 wing effort | `escw` population + same `wingDrive` mapping |
| Gait → ascending neurons | Same phase-modulated 0.09 proprioceptive injection |
| Cursor wind → sensory partners | Same 0.12 sensory drive |
| Live brain window | 23,210 FlyWire somas + circuit overlay + live spike flashes |
| Interactive brain stimulation | nearest-region selection, max 60 neurons, 400 ms stimulation |
| Window ledges | `EnumWindows` + visible top edges; dragged windows update the ledge |
| New-window looming | newly observed Win32 windows inject side-specific loom |
| Window closes under fly | missing ledge causes takeoff |
| Clicks as substrate taps | low-level mouse hook → sensory-cluster stimulus |
| Typing as vibration | low-level keyboard hook stores timing only, never key identity |
| Circadian rhythm | same piecewise activity curve |
| Sleep gating | same idle/night rules, baseline compression and sensory gate |
| Thermal tempo | ACPI/WMI thermal-zone temperature when firmware exposes it; safe 1.0 fallback |
| Multiple flies | fly #1 owns the brain; added flies use legacy distance fear |
| Move to next display | WinForms screen enumeration; active terrain retargets to next display |
| Pause / brain / escape test / add / remove / scare / quit | tray menu parity |
| `--simtest` | Windows circuit regression test |
| `--behaviortest` | 17 Windows end-to-end behavior checks |
| `--snapshot` | offscreen PNG render of the procedural fly |
| `--brainshot` | offscreen PNG render of brain data + spike activity |

## Platform-specific note

macOS exposes a single coarse `ProcessInfo.thermalState`. Windows has no universal equivalent. The port queries ACPI thermal-zone telemetry through WMI when a machine exposes it and falls back to neutral tempo (`1.0`) when it does not. This preserves the behavior without requiring administrator rights or vendor-specific drivers.
