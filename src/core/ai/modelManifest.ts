export type ModelId = 'qwen3' | 'whisper' | 'kokoro';

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
  note?: string;
}

// Checksums/sizes taken from Hugging Face LFS metadata on 2026-10-02.
export const MODEL_MANIFEST: ModelSpec[] = [
  {
    id: 'qwen3',
    name: 'Qwen3 1.7B',
    purpose: 'Reasoning, conversation, tool calling',
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
    name: 'Whisper base.en (q5_1)',
    purpose: 'Offline speech-to-text',
    version: 'ggml base.en q5_1',
    platform: 'android',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin',
    fileName: 'ggml-base.en-q5_1.bin',
    sizeBytes: 59721011,
    sha256: '4baf70dd0d7c4247ba2b81fafd9c01005ac77c2f9ef064e00dcf195d0e2fdd2f',
  },
  {
    id: 'kokoro',
    name: 'Kokoro 82M',
    purpose: 'Offline text-to-speech',
    version: 'sherpa-onnx',
    platform: 'android',
    url: null,
    fileName: 'kokoro',
    sizeBytes: 0,
    sha256: null,
    note: 'Needs a multi-file sherpa-onnx bundle; wired up in Phase 3.',
  },
];
