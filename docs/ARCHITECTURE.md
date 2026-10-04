# Alphadex — Phase 1: Inspection & Architecture

## Project inspection
- Repo `D:\work\acqron\Alphadron` is empty: no commits, no files. Nothing to preserve or refactor; this is a greenfield scaffold.

## Environment (verified 2026-10-02)
| Item | Status |
|---|---|
| Node 24.13.1 / npm 11.8 | OK |
| JDK 17 | OK (RN Android requires 17) |
| Android SDK / ANDROID_HOME | **Missing** — install Android Studio, SDK 35+, NDK, CMake |
| Visual Studio 2022 + UWP/Desktop C++ workloads | **Unverified** (only legacy VS 14 registry key found) — required for React Native Windows |
| Disk | 106 GB free on D: (OK for ~3 GB of models) |

## Runtime research
| Capability | Runtime | Android | Windows | Notes |
|---|---|---|---|---|
| Qwen3 1.7B Q4_K_M | `llama.rn` (llama.cpp TurboModule) | Yes | **No** (iOS/Android only) | llama.cpp itself runs on Windows (prebuilt CPU/Vulkan builds), so Windows needs a custom native module or sidecar |
| Whisper | `whisper.rn` (whisper.cpp), ggml models | Yes | **No** | Same situation as llama.rn |
| Kokoro-82M | `react-native-sherpa-onnx` (sherpa-onnx, ONNX Kokoro models) | Yes (API 24+) | **Not confirmed** | sherpa-onnx has Windows C/C++ builds, but the RN binding's Windows support is unverified |
| SQLite | `op-sqlite` | Yes | **Unverified** | Fallback: a small custom RNW module over the SQLite amalgamation |
| React Native Windows | Latest stable found: 0.80 | n/a | Yes | Lags RN core, so the RN version is pinned to what RNW supports |

Note: these come from a quick search (secondary sources). Confirm each version and platform claim against the package READMEs and npm before pinning.

## Key incompatibility
No existing RN library covers Windows for LLM, STT or TTS. **Android is achievable with off-the-shelf libraries. Windows needs native C++ modules** that wrap llama.cpp, whisper.cpp and sherpa-onnx behind the same TypeScript interfaces. The same C++ libraries are used on both platforms, so this is a porting job, not a redesign.

## Tradeoffs / decisions
1. **Android first, Windows second.** Build and ship the MVP on Android with real inference. Windows reuses all TypeScript code (core/, database/, features/), and only the `platform/windows` native modules are new work.
2. **RN version pinned to RNW support** (0.80-ish), not RN latest.
3. **Qwen3 1.7B tool calling:** a 1.7B model is unreliable at free-form JSON. Use llama.cpp GBNF/JSON-schema constrained decoding, plus application-side validation. Deterministic date/time parsing (e.g. chrono-style) runs in app code, and Qwen picks the tool and gives a raw time phrase. Qwen3 "thinking" mode is disabled for latency.
4. **Memory budget:** Qwen3 1.7B Q4_K_M is ~1.1 GB, Whisper (base/small) 150-500 MB, Kokoro ~330 MB (ONNX). The sequential load/unload pipeline from the spec is kept; Qwen stays loaded when RAM allows.
5. **Reminders:** local notifications are scheduled with a native scheduler (Notifee on Android; Windows toast scheduling via native module). SQLite stays the source of truth.
6. **Icons:** `@phosphor-icons/react` is web-only. For RN use `phosphor-react-native` (same icon set, MIT).
7. **Models are never committed.** `.gitignore` covers `models/` and `*.gguf`/`*.onnx`/`*.bin`. A model manifest holds URL, size and SHA-256 for each model, and downloads are resumable and explicit.

## Module layout
```
src/core/{ai,voice,memory,tools,tasks,reminders,scheduling,permissions}
src/database/{schema,migrations,repositories}
src/features/{assistant,tasks,reminders,schedule,memory,settings,onboarding}
src/{components,navigation,services,utils}
src/platform/{android,windows}   // behind interfaces: DeviceService, NotificationService, ModelRuntime
```
Interfaces (`AIProvider`, `STTEngine`, `TTSEngine`, `DeviceService`) live in `core/`. Implementations are platform-specific.

## Plan
- **Phase 2** (done): Expo SDK 57 scaffold, expo-sqlite migrations, theme, navigation, settings, model manager. Switched from bare RN to Expo so it can be tested in Expo Go; Phase 3 native AI modules need an EAS dev build.
- **Phase 3:** `llama.rn`, `whisper.rn`, `react-native-sherpa-onnx` behind abstractions; each tested independently on a physical Android device. Emulators are not representative for inference speed.
- **Phases 4-9** as specified. Windows native modules are scheduled after the Android MVP.

## Prerequisites needed from you
1. Android Studio + SDK/NDK installed, and a physical Android device (or confirm emulator-only for now).
2. Confirm Visual Studio 2022 with the Desktop/UWP C++ workloads if Windows is to be built soon.

## Status (2026-10-04)

All phases are implemented in code: foundation, local AI (Qwen via llama.rn, Whisper via whisper.rn, Kokoro via sherpa-onnx),
text assistant with grammar-constrained tool calls, memory, tasks/reminders/schedule with local notifications,
push-to-talk voice, Android device tools, and basic personalization (name, memories).

Verified: TypeScript compiles; 25 unit tests pass; `expo export` bundles all native-module imports; `expo-doctor` passes.
**Not yet verified on a device:** model loading/inference speed, Whisper transcription accuracy, Kokoro playback,
notification delivery, the EAS build itself. Windows is not implemented.

Known limitations:
- Model integrity in Expo is checked by exact byte size only (no streaming SHA-256).
- Interrupted downloads restart from zero (no resume).
- Wake word and automatic listening are intentionally not implemented.
- Kokoro is the English int8 build (kokoro-int8-en-v0_19).
