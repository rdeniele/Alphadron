# Alphadron

Offline-first personal AI assistant ("Alphadex") for Android, built with Expo / React Native.

```
Voice / Text -> Whisper (STT) -> Qwen3 1.7B -> tools + memory -> SQLite -> Kokoro (TTS)
```

Everything runs on the phone. Internet is only needed once, to download the models.

## Run it

The AI engines (`llama.rn`, `whisper.rn`, sherpa-onnx) are native modules, so **Expo Go cannot run them**.
You need a development build (an APK of this app).

```bash
npm install
npm run typecheck
npm test                      # unit tests (date parsing, tool validation, model-output parsing)
```

**Build the APK in the cloud (no Android SDK needed):**

```bash
npx eas login                 # free Expo account
npx eas build --profile development --platform android
```

Install the APK on the phone, then:

```bash
npx expo start --dev-client
```

**Or build locally** (needs Android Studio, SDK 35+, NDK, CMake, `ANDROID_HOME`):

```bash
npx expo run:android
```

On first launch, open Settings (or the onboarding screen) and download the three models
(Qwen3 ~1.1 GB, Whisper ~60 MB, Kokoro ~100 MB). Nothing downloads automatically.

## Layout

```
src/core/ai          AIProvider, LocalQwenProvider (llama.rn), prompt, orchestrator, model manager
src/core/voice       SpeechToTextService (whisper.rn), TextToSpeechService (Kokoro via sherpa-onnx)
src/core/tools       validated tool registry + executor (the only path from model output to actions)
src/core/scheduling  deterministic natural-language date/time parser
src/core/memory      sensitive-content detection
src/database         expo-sqlite, migrations, repositories
src/platform         interfaces + Android implementation (notifications, device)
src/features         screens: assistant (home/chat), tasks (plan), memory, settings, onboarding
```

## Safety model

- The model emits JSON constrained by a grammar to the tool list; the app validates every
  argument against a schema, rejects unknown fields, and never evaluates model output as code.
- `open_app` uses a fixed allow-list; `open_url` accepts `https://` only. Both ask for confirmation.
- Sensitive text (passwords, card numbers, ...) is never saved to memory without explicit approval.
- Push-to-talk only: the microphone is open only while the button is held, and the UI turns red.
