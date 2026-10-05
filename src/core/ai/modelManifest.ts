export type ModelId = 'qwen3_fast' | 'qwen3' | 'whisper' | 'whisper_small' | 'kokoro';

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
    name: 'Qwen3 0.6B — Fast (recommended)',
    purpose: 'Quick replies and tool calling',
    version: 'Q4_K_M',
    platform: 'android',
    url: 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf',
    fileName: 'Qwen3-0.6B-Q4_K_M.gguf',
    sizeBytes: 396705472,
    sha256: 'ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a',
  },
  {
    id: 'qwen3',
    name: 'Qwen3 1.7B — Better quality',
    purpose: 'Smarter but slower replies',
    version: 'Q4_K_M',
    platform: 'android',
    // Official Qwen/Qwen3-1.7B-GGUF only ships Q8_0, so Q4_K_M comes from unsloth's conversion.
    url: 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf',
    fileName: 'Qwen3-1.7B-Q4_K_M.gguf',
    sizeBytes: 1107409472,
    sha256: 'b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897',
  },
  {
    id: 'whisper',
    name: 'Whisper base (speech recognition)',
    purpose: 'Offline speech-to-text',
    version: 'ggml base.en q5_1',
    platform: 'android',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin',
    fileName: 'ggml-base.en-q5_1.bin',
    sizeBytes: 59721011,
    sha256: '4baf70dd0d7c4247ba2b81fafd9c01005ac77c2f9ef064e00dcf195d0e2fdd2f',
  },
  {
    id: 'whisper_small',
    name: 'Whisper small — Better accuracy',
    purpose: 'More accurate speech recognition (optional)',
    version: 'ggml small.en q5_1',
    platform: 'android',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin',
    fileName: 'ggml-small.en-q5_1.bin',
    sizeBytes: 190098681,
    sha256: 'bfdff4894dcb76bbf647d56263ea2a96645423f1669176f4844a1bf8e478ad30',
  },
  {
    id: 'kokoro',
    name: 'Kokoro 82M',
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
