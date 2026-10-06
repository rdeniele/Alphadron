// A deliberately small set (~560 MB total): one brain, one ear, one voice.
export type ModelId = 'qwen3_fast' | 'whisper' | 'kokoro';

export interface ModelSpec {
  id: ModelId;
  name: string;
  purpose: string;
  version: string;
  platform: 'android';
  url: string | null; // null = not wired up yet
  fileName: string;
  sizeBytes: number;
  sha256: string | null;
  /** If set, the download is a .tar.bz2 extracted into this directory name under models/. */
  extractDir?: string;
  note?: string;
}

// Checksums/sizes taken from Hugging Face LFS metadata on 2026-10-02.
export const MODEL_MANIFEST: ModelSpec[] = [
  {
    id: 'qwen3_fast',
    name: 'Qwen3 0.6B — the brain',
    purpose: 'Chat and understanding',
    version: 'Q4_K_M',
    platform: 'android',
    url: 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf',
    fileName: 'Qwen3-0.6B-Q4_K_M.gguf',
    sizeBytes: 396705472,
    sha256: 'ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a',
  },
  {
    id: 'whisper',
    name: 'Whisper base — hearing',
    purpose: 'Offline speech recognition',
    version: 'ggml base.en q5_1',
    platform: 'android',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin',
    fileName: 'ggml-base.en-q5_1.bin',
    sizeBytes: 59721011,
    sha256: '4baf70dd0d7c4247ba2b81fafd9c01005ac77c2f9ef064e00dcf195d0e2fdd2f',
  },
  {
    id: 'kokoro',
    name: 'Kokoro 82M — voice',
    purpose: 'Offline text-to-speech',
    version: 'sherpa-onnx kokoro-int8-en-v0_19',
    platform: 'android',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-en-v0_19.tar.bz2',
    fileName: 'kokoro-int8-en-v0_19.tar.bz2',
    sizeBytes: 103248205,
    sha256: null,
    extractDir: 'kokoro-int8-en-v0_19',
  },
];

/** Files from models that were removed from the app; deleted on launch to free space. */
export const LEGACY_MODEL_FILES = ['Qwen3-1.7B-Q4_K_M.gguf', 'ggml-small.en-q5_1.bin'];
