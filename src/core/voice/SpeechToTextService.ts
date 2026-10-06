import { PermissionsAndroid, Platform } from 'react-native';
import AudioRecord from '@fugood/react-native-audio-pcm-stream';
import { initWhisper, type WhisperContext } from 'whisper.rn/index';
import { MODEL_MANIFEST, type ModelId } from '../ai/modelManifest';
import { getModelInfo, markLoaded } from '../ai/modelManager';
import { micSourceId, type MicSource } from './micOptions';
import { SILENCE_LEVEL, isPromptEcho, SAMPLE_RATE, base64ToBytes, chunkLevel, cleanTranscript, pcm16ToFloat32, prepareAudio } from './audioUtils';

const MAX_SECONDS = 120;
const toPath = (uri: string) => uri.replace(/^file:\/\//, '');

/** Words the user is likely to say; nudges Whisper toward them (fewer "remind me" -> "remain me" errors). */
const VOCAB_PROMPT =
  'Alphadex, remind me tomorrow at 9 AM to work on my project. Add a task. Create a note. What do I have today? Schedule a meeting on Friday at 3 PM.';

export type SttState = 'idle' | 'listening' | 'transcribing';

/** AudioRecord.stop() returns a promise on some platforms and undefined on others. */
async function stopRecorder(): Promise<void> {
  try {
    await Promise.resolve(AudioRecord.stop());
  } catch {
    // already stopped
  }
}

/**
 * Tap-to-record speech recognition using Whisper (whisper.cpp) on-device.
 * The microphone is open only between startListening() and stopAndTranscribe()/cancel().
 * Whisper is loaded for the transcription and released afterwards to save RAM.
 */
export class SpeechToTextService {
  private chunks: Uint8Array[] = [];
  private bytes = 0;
  private wired = false;
  private autoStop: ReturnType<typeof setTimeout> | null = null;
  private ctx: WhisperContext | null = null;
  state: SttState = 'idle';
  /** Android audio source to record from (user-selectable in Settings). */
  micSource: MicSource = 'mic';
  /** Loudness stats of the last recording, to tell "silent mic" from "unclear speech". */
  lastRecording: { seconds: number; peak: number } = { seconds: 0, peak: 0 };
  private peak = 0;
  onStateChange?: (s: SttState) => void;
  /** Live input loudness 0..1 while recording (drives the level meter). */
  onLevel?: (level: number) => void;
  /** Fired if the recording hit the maximum length. */
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
      message: 'Alphadron uses the microphone only while you are recording. Audio stays on your phone.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });
    return res === PermissionsAndroid.RESULTS.GRANTED;
  }

  /** Prefers the more accurate "small" model when it has been downloaded. */
  private async resolveModel(): Promise<{ id: ModelId; path: string } | null> {
    for (const id of ['whisper_small', 'whisper'] as ModelId[]) {
      const info = await getModelInfo(MODEL_MANIFEST.find(m => m.id === id)!);
      if (info.status === 'downloaded' && info.localPath) {
        return { id, path: info.localPath };
      }
    }
    return null;
  }

  async isReady(): Promise<boolean> {
    return (await this.resolveModel()) !== null;
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
    this.peak = 0;
    AudioRecord.init({ sampleRate: SAMPLE_RATE, channels: 1, bitsPerSample: 16, audioSource: micSourceId(this.micSource), bufferSize: 4096, wavFile: '' });
    if (!this.wired) {
      AudioRecord.on('data', b64 => {
        if (this.state !== 'listening') {
          return;
        }
        const bytes = base64ToBytes(b64);
        this.chunks.push(bytes);
        this.bytes += bytes.length;
        const lvl = chunkLevel(bytes);
        if (lvl > this.peak) {
          this.peak = lvl;
        }
        this.onLevel?.(lvl);
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
    await stopRecorder();
    this.set('transcribing');
    try {
      const seconds = this.bytes / 2 / SAMPLE_RATE;
      this.lastRecording = { seconds, peak: this.peak };
      if (seconds < 0.5 || this.peak < SILENCE_LEVEL) {
        return ''; // too short or silent: nothing to transcribe
      }
      const samples = prepareAudio(pcm16ToFloat32(this.chunks));
      this.chunks = [];
      const ctx = await this.loadWhisper();
      const { promise } = ctx.transcribeData(samples.buffer as ArrayBuffer, {
        language: 'en',
        translate: false,
        temperature: 0,
        beamSize: 3,
        prompt: VOCAB_PROMPT,
        maxThreads: 4,
      });
      const res = await promise;
      const text = cleanTranscript(res.result);
      return isPromptEcho(text, VOCAB_PROMPT) ? '' : text;
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
      await stopRecorder();
    }
    this.chunks = [];
    this.bytes = 0;
    this.set('idle');
  }

  private async loadWhisper(): Promise<WhisperContext> {
    if (this.ctx) {
      return this.ctx;
    }
    const found = await this.resolveModel();
    if (!found) {
      throw new Error('The speech model is not downloaded yet.');
    }
    this.ctx = await initWhisper({ filePath: toPath(found.path) });
    markLoaded(found.id, true);
    return this.ctx;
  }

  async release(): Promise<void> {
    const c = this.ctx;
    this.ctx = null;
    markLoaded('whisper', false);
    markLoaded('whisper_small', false);
    await c?.release().catch(() => undefined);
  }
}
