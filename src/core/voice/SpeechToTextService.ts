import { PermissionsAndroid, Platform } from 'react-native';
import AudioRecord from '@fugood/react-native-audio-pcm-stream';
import { initWhisper, type WhisperContext } from 'whisper.rn/index';
import { MODEL_MANIFEST } from '../ai/modelManifest';
import { getModelInfo, markLoaded } from '../ai/modelManager';
import { micSourceId, nextMic, type MicSetting, type MicSource } from './micOptions';
import { floatToPcm16, SILENCE_LEVEL, isPromptEcho, SAMPLE_RATE, base64ToBytes, chunkLevel, cleanTranscript, pcm16ToFloat32, prepareAudio } from './audioUtils';

const MAX_SECONDS = 120;
/** A recording whose peak is at least this loud proves the microphone works. */
const WORKING_LEVEL = 0.08;
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
 *
 * Microphone source: Android phones differ in which AudioRecord source delivers audio.
 * In 'auto' mode, a silent recording rotates to the next source and a working one is
 * remembered, so every phone ends up on a microphone that works.
 */
export class SpeechToTextService {
  private chunks: Uint8Array[] = [];
  private bytes = 0;
  private wired = false;
  private autoStop: ReturnType<typeof setTimeout> | null = null;
  private ctx: WhisperContext | null = null;
  private peak = 0;
  state: SttState = 'idle';
  /** User's choice: 'auto' or a specific source. */
  setting: MicSetting = 'auto';
  /** Source used in auto mode (the last one that worked, or the next one to try). */
  resolved: MicSource = 'mic';
  /** Loudness stats of the last recording, to tell "silent mic" from "unclear speech". */
  lastRecording: { seconds: number; peak: number; source: MicSource; rotatedTo: MicSource | null } = {
    seconds: 0,
    peak: 0,
    source: 'mic',
    rotatedTo: null,
  };
  onStateChange?: (s: SttState) => void;
  /** Live input loudness 0..1 while recording (drives the level meter). */
  onLevel?: (level: number) => void;
  /** Fired if the recording hit the maximum length. */
  onAutoStop?: () => void;
  /** Fired when auto mode settles on / switches to a source (so it can be saved). */
  onResolved?: (source: MicSource) => void;

  private set(s: SttState) {
    this.state = s;
    this.onStateChange?.(s);
  }

  /** The source that will be used for the next recording. */
  currentSource(): MicSource {
    return this.setting === 'auto' ? this.resolved : this.setting;
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

  private async modelPath(): Promise<string | null> {
    const info = await getModelInfo(MODEL_MANIFEST.find(m => m.id === 'whisper')!);
    return info.status === 'downloaded' && info.localPath ? info.localPath : null;
  }

  async isReady(): Promise<boolean> {
    return (await this.modelPath()) !== null;
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
    AudioRecord.init({
      sampleRate: SAMPLE_RATE,
      channels: 1,
      bitsPerSample: 16,
      audioSource: micSourceId(this.currentSource()),
      bufferSize: 4096,
      wavFile: '',
    });
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

  /** Auto mode bookkeeping after a recording: lock in a working source, rotate off a silent one. */
  private learnFromRecording(source: MicSource, peak: number, seconds: number) {
    let rotatedTo: MicSource | null = null;
    if (this.setting === 'auto' && seconds >= 1) {
      if (peak >= WORKING_LEVEL) {
        this.onResolved?.(source);
      } else if (peak < SILENCE_LEVEL) {
        rotatedTo = nextMic(source);
        this.resolved = rotatedTo;
        this.onResolved?.(rotatedTo);
      }
    }
    this.lastRecording = { seconds, peak, source, rotatedTo };
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
    const source = this.currentSource();
    await stopRecorder();
    this.set('transcribing');
    try {
      const seconds = this.bytes / 2 / SAMPLE_RATE;
      this.learnFromRecording(source, this.peak, seconds);
      if (seconds < 0.5 || this.peak < SILENCE_LEVEL) {
        return ''; // too short or silent: nothing to transcribe
      }
      const pcm = floatToPcm16(prepareAudio(pcm16ToFloat32(this.chunks)));
      this.chunks = [];
      const ctx = await this.loadWhisper();
      const { promise } = ctx.transcribeData(pcm.buffer as ArrayBuffer, {
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
    const path = await this.modelPath();
    if (!path) {
      throw new Error('The speech model is not downloaded yet.');
    }
    this.ctx = await initWhisper({ filePath: toPath(path) });
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
