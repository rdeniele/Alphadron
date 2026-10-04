import { PermissionsAndroid, Platform } from 'react-native';
import AudioRecord from '@fugood/react-native-audio-pcm-stream';
import { initWhisper, type WhisperContext } from 'whisper.rn/index';
import { MODEL_MANIFEST } from '../ai/modelManifest';
import { getModelInfo, markLoaded } from '../ai/modelManager';

const SAMPLE_RATE = 16000;
const MAX_SECONDS = 30;
const toPath = (uri: string) => uri.replace(/^file:\/\//, '');

export type SttState = 'idle' | 'listening' | 'transcribing';

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

/** 16-bit little-endian PCM chunks -> float32 samples in [-1, 1]. */
function pcm16ToFloat32(chunks: Uint8Array[]): Float32Array {
  let bytes = 0;
  for (const c of chunks) {
    bytes += c.length;
  }
  const samples = new Float32Array(Math.floor(bytes / 2));
  let i = 0;
  let carry = -1;
  for (const c of chunks) {
    for (let j = 0; j < c.length; j++) {
      if (carry < 0) {
        carry = c[j];
      } else {
        let v = carry | (c[j] << 8);
        if (v & 0x8000) {
          v -= 0x10000;
        }
        samples[i++] = v / 32768;
        carry = -1;
      }
    }
  }
  return samples;
}

/**
 * Push-to-talk speech recognition using Whisper (whisper.cpp) on-device.
 * The microphone is only open between startListening() and stopAndTranscribe().
 * Whisper is loaded for the transcription and released afterwards to save RAM.
 */
export class SpeechToTextService {
  private chunks: Uint8Array[] = [];
  private bytes = 0;
  private wired = false;
  private autoStop: ReturnType<typeof setTimeout> | null = null;
  private ctx: WhisperContext | null = null;
  state: SttState = 'idle';
  onStateChange?: (s: SttState) => void;
  /** Fired if the recording hit the maximum length and stopped by itself. */
  onAutoStop?: () => void;

  private set(s: SttState) {
    this.state = s;
    this.onStateChange?.(s);
  }

  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: 'Microphone',
      message: 'Alphadron uses the microphone only while you hold the talk button. Audio stays on your phone.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });
    return res === PermissionsAndroid.RESULTS.GRANTED;
  }

  async isReady(): Promise<boolean> {
    const info = await getModelInfo(MODEL_MANIFEST.find(m => m.id === 'whisper')!);
    return info.status === 'downloaded';
  }

  async startListening(): Promise<void> {
    if (this.state !== 'idle') {
      return;
    }
    if (!(await this.isReady())) {
      throw new Error('The speech model is not downloaded yet. Open Settings to download Whisper.');
    }
    if (!(await this.requestPermission())) {
      throw new Error('Microphone permission was denied.');
    }
    this.chunks = [];
    this.bytes = 0;
    AudioRecord.init({ sampleRate: SAMPLE_RATE, channels: 1, bitsPerSample: 16, audioSource: 6, bufferSize: 4096, wavFile: '' });
    if (!this.wired) {
      AudioRecord.on('data', b64 => {
        if (this.state !== 'listening') {
          return;
        }
        const bytes = base64ToBytes(b64);
        this.chunks.push(bytes);
        this.bytes += bytes.length;
      });
      this.wired = true;
    }
    AudioRecord.start();
    this.set('listening');
    this.autoStop = setTimeout(() => this.onAutoStop?.(), MAX_SECONDS * 1000);
  }

  /** Stops recording and returns the transcript ('' if nothing was said). */
  async stopAndTranscribe(): Promise<string> {
    if (this.state !== 'listening') {
      return '';
    }
    if (this.autoStop) {
      clearTimeout(this.autoStop);
      this.autoStop = null;
    }
    await AudioRecord.stop().catch(() => undefined);
    this.set('transcribing');
    try {
      const seconds = this.bytes / 2 / SAMPLE_RATE;
      if (seconds < 0.4) {
        return '';
      }
      const samples = pcm16ToFloat32(this.chunks);
      this.chunks = [];
      const ctx = await this.loadWhisper();
      const { promise } = ctx.transcribeData(samples.buffer as ArrayBuffer, { language: 'en' });
      const res = await promise;
      return res.result.replace(/\[[^\]]*\]|\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    } finally {
      await this.release();
      this.set('idle');
    }
  }

  async cancel(): Promise<void> {
    if (this.autoStop) {
      clearTimeout(this.autoStop);
      this.autoStop = null;
    }
    if (this.state === 'listening') {
      await AudioRecord.stop().catch(() => undefined);
    }
    this.chunks = [];
    this.set('idle');
  }

  private async loadWhisper(): Promise<WhisperContext> {
    if (this.ctx) {
      return this.ctx;
    }
    const info = await getModelInfo(MODEL_MANIFEST.find(m => m.id === 'whisper')!);
    if (!info.localPath) {
      throw new Error('The speech model is not downloaded yet.');
    }
    this.ctx = await initWhisper({ filePath: toPath(info.localPath) });
    markLoaded('whisper', true);
    return this.ctx;
  }

  async release(): Promise<void> {
    const c = this.ctx;
    this.ctx = null;
    markLoaded('whisper', false);
    await c?.release().catch(() => undefined);
  }
}
