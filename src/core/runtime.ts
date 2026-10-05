import * as Device from 'expo-device';
import { LocalQwenProvider } from './ai/LocalQwenProvider';
import type { AIProvider } from './ai/AIProvider';
import { runTurn, type TurnResult } from './ai/assistant';
import { SpeechToTextService } from './voice/SpeechToTextService';
import { KokoroTtsService, type TextToSpeechService } from './voice/TextToSpeechService';
import { confirmAction } from './permissions/confirm';
import { platform } from '../platform';

export type Phase = 'idle' | 'listening' | 'transcribing' | 'checking' | 'loading' | 'thinking' | 'acting' | 'speaking';

const LOW_MEMORY_BYTES = 4 * 1024 ** 3;

/**
 * Owns the three engines and the memory policy.
 * Low-RAM phones: STT -> release -> Qwen -> release -> TTS -> release.
 * Others: Qwen stays resident (faster); STT and TTS are still released after use.
 */
export class Runtime {
  readonly provider: AIProvider = new LocalQwenProvider();
  readonly stt = new SpeechToTextService();
  readonly tts: TextToSpeechService = new KokoroTtsService();
  phase: Phase = 'idle';
  onPhase?: (p: Phase) => void;

  private busy = false;

  private setPhase(p: Phase) {
    this.phase = p;
    this.onPhase?.(p);
  }

  private get lowMemory() {
    return (Device.totalMemory ?? 0) < LOW_MEMORY_BYTES;
  }

  /** Loads Qwen in the background so the first model-answered message isn't slow. */
  async warmUp(): Promise<void> {
    if (this.busy || this.provider.isLoaded()) {
      return;
    }
    await this.provider.load().catch(() => undefined);
  }

  /** Text chat. Optionally speaks the reply (when voice output is wanted). */
  async sendText(text: string, opts: { memoryEnabled: boolean; speak: boolean }): Promise<TurnResult> {
    if (this.busy) {
      throw new Error('Alphadron is still working on the previous request.');
    }
    this.busy = true;
    try {
      await this.tts.stop();
      const result = await runTurn(text, {
        provider: this.provider,
        ctx: { platform, memoryEnabled: opts.memoryEnabled, confirm: confirmAction },
        onStatus: s => this.setPhase(s),
      });
      if (this.lowMemory && opts.speak) {
        await this.provider.unload(); // free RAM before loading TTS
      }
      if (opts.speak && (await this.tts.isReady())) {
        this.setPhase('speaking');
        await this.tts.speak(result.assistantMessage.content).catch(() => undefined);
        await this.tts.release();
      }
      return result;
    } finally {
      this.busy = false;
      this.setPhase('idle');
    }
  }

  /** Push-to-talk: press. */
  async startTalking(): Promise<void> {
    await this.tts.stop();
    await this.stt.startListening();
    this.setPhase('listening');
  }

  /** Push-to-talk: release. Returns the transcript ('' if nothing was heard). */
  async stopTalking(): Promise<string> {
    this.setPhase('transcribing');
    try {
      return await this.stt.stopAndTranscribe();
    } finally {
      this.setPhase('idle');
    }
  }

  async cancelTalking() {
    await this.stt.cancel();
    this.setPhase('idle');
  }

  async stopSpeaking() {
    await this.tts.stop();
  }

  async stopThinking() {
    await this.provider.stop();
  }

  async releaseAll() {
    await Promise.all([this.provider.unload(), this.stt.release(), this.tts.release()]);
  }
}

export const runtime = new Runtime();
