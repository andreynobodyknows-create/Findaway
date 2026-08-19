# DesktopFly Windows parity map

This port targets functional parity with `DenisSergeevitch/desktop-fly` while replacing macOS-only Cocoa/SceneKit APIs with WPF/Win32 equivalents.

| macOS capability | Windows implementation |
|---|---|
| transparent click-through overlay | borderless transparent topmost WPF window + `WS_EX_TRANSPARENT/NOACTIVATE` |
| procedural SceneKit fly | procedural WPF `Viewport3D` fly with articulated legs, wings, shadow and animation |
| FlyWire circuit loading | same compact `circuit.json` format |
| 1 kHz LIF simulation | C# LIF port with same principal model constants and role mappings |
| LC4/LPLC2 looming | cursor/window looming split by anatomical left/right; Windows screen handedness corrected |
| GF escape | GF spike latch -> escape takeoff |
| DNa steering | DNa01/02 transient L-R rate -> steering, directionally regression-tested |
| DNp09 walking | rate -> walking hysteresis/speed |
| DNg11 grooming | rate -> grooming hysteresis |
| MDN backward | rate burst -> backward timer |
| DNp02/04/11 wings | live wing-drive / threat posture / flight effort |
| gait -> ascending feedback | rhythmic proprioceptive current into ascending partners |
| fast cursor -> sensory | air-puff current into sensory partners |
| interactive live brain | 23,210-soma rotating raster layer + 668 dynamic circuit neurons/spikes; click stimulation |
| window ledges | `EnumWindows`/`GetWindowRect` top edges |
| new-window loom | newly observed Win32 windows -> looming drive |
| global clicks | low-level mouse hook -> substrate tap |
| typing timing | low-level keyboard timing only; key identity is not recorded |
| circadian/sleep | same activity curve + Windows last-input idle time |
| thermal tempo | non-blocking ACPI/WMI probe with neutral fallback |
| multiple flies | additional brainless flies; fly #1 owns the connectome |
| multi-display hop | Windows `Screen` enumeration |
| menu-bar controls | Windows notification-area tray menu |
| `--simtest` | supported and CI-gated |
| `--behaviortest` | 17 CI-gated checks |
| `--snapshot` | supported and smoke-tested |
| `--brainshot` | supported and smoke-tested |
| built app smoke test | published self-contained EXE is launched in Windows CI; overlay + brain visibility verified |

## Validation boundary

The automated gate verifies compilation, neural/behavior regressions, visual snapshot generation, package contents/licenses, and startup of the published executable. Hardware-specific behavior such as mixed-DPI multi-monitor layouts, vendor-specific thermal telemetry, corporate SmartScreen/App Control policy, and graphics-driver performance must still be rehearsed on the exact presentation machine.
