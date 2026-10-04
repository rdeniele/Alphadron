import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as FS from 'expo-file-system/legacy';
import { createTTS, saveAudioToFile, type TtsEngine } from 'react-native-sherpa-onnx/tts';
import { MODEL_MANIFEST } from '../ai/modelManifest';
import { getModelInfo, markLoaded } from '../ai/modelManager';

const toPath = (uri: string) => uri.replace(/^file:\/\//, '');

/**
 * Engine-agnostic TTS interface. Kokoro is the implementation now; Piper or
 * another offline engine can implement the same interface later.
 */
export interface TextToSpeechService {
  isReady(): Promise<boolean>;
  speak(text: string): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
  resume(): void;
  release(): Promise<void>;
}

export class KokoroTtsService implements TextToSpeechService {
  private engine: TtsEngine | null = null;
  private player: AudioPlayer | null = null;
  private done: (() => void) | null = null;
  private generation = 0;

  async isReady(): Promise<boolean> {
    const info = await getModelInfo(MODEL_MANIFEST.find(m => m.id === 'kokoro')!);
    return info.status === 'downloaded';
  }

  private async load(): Promise<TtsEngine> {
    if (this.engine) {
      return this.engine;
    }
    const info = await getModelInfo(MODEL_MANIFEST.find(m => m.id === 'kokoro')!);
    if (!info.localPath) {
      throw new Error('The voice model is not downloaded yet. Open Settings to download Kokoro.');
    }
    this.engine = await createTTS({
      modelPath: { type: 'file', path: toPath(info.localPath) },
      modelType: 'kokoro',
      numThreads: 2,
    });
    markLoaded('kokoro', true);
    return this.engine;
  }

  /** Speaks the text and resolves when playback finishes (or is stopped). */
  async speak(text: string): Promise<void> {
    await this.stop();
    const myGen = ++this.generation;
    const clean = text.replace(/[*_`#]/g, '').trim();
    if (!clean) {
      return;
    }
    const engine = await this.load();
    const audio = await engine.generateSpeech(clean, { sid: 0, speed: 1.0 });
    if (myGen !== this.generation) {
      return; // stopped while generating
    }
    const file = `${FS.cacheDirectory}alphadron-tts-${myGen}.wav`;
    await saveAudioToFile(audio, toPath(file));
    if (myGen !== this.generation) {
      return;
    }
    await new Promise<void>(resolve => {
      const player = createAudioPlayer(file);
      this.player = player;
      this.done = resolve;
      const sub = player.addListener('playbackStatusUpdate', st => {
        if (st.didJustFinish) {
          sub.remove();
          this.finish();
        }
      });
      player.play();
    });
    await FS.deleteAsync(file, { idempotent: true }).catch(() => undefined);
  }

  private finish() {
    const p = this.player;
    this.player = null;
    p?.remove();
    const d = this.done;
    this.done = null;
    d?.();
  }

  async stop(): Promise<void> {
    this.generation++;
    this.player?.pause();
    this.finish();
  }

  pause() {
    this.player?.pause();
  }

  resume() {
    this.player?.play();
  }

  async release(): Promise<void> {
    await this.stop();
    const e = this.engine;
    this.engine = null;
    markLoaded('kokoro', false);
    await e?.destroy().catch(() => undefined);
  }
}
