/** Pure audio helpers (no React Native imports) so they can be unit-tested. */

export const SAMPLE_RATE = 16000;

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

/** 16-bit little-endian PCM chunks -> float32 samples in [-1, 1]. */
export function pcm16ToFloat32(chunks: Uint8Array[]): Float32Array {
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

/** RMS loudness (0..1) of one 16-bit PCM chunk, boosted for display. */
export function chunkLevel(bytes: Uint8Array): number {
  const n = Math.floor(bytes.length / 2);
  if (!n) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let v = bytes[2 * i] | (bytes[2 * i + 1] << 8);
    if (v & 0x8000) {
      v -= 0x10000;
    }
    sum += (v / 32768) ** 2;
  }
  return Math.min(1, Math.sqrt(sum / n) * 6);
}

/**
 * Prepares audio for Whisper: quiet recordings are normalised (many phones record
 * speech very quietly, which badly hurts accuracy) and short silence is added at
 * both ends so the first and last words are not clipped.
 */
export function prepareAudio(samples: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) {
      peak = a;
    }
  }
  const gain = peak > 0.001 && peak < 0.5 ? Math.min(0.9 / peak, 20) : 1;
  const lead = Math.round(SAMPLE_RATE * 0.25);
  const tail = Math.round(SAMPLE_RATE * 0.5);
  const out = new Float32Array(lead + samples.length + tail);
  for (let i = 0; i < samples.length; i++) {
    out[lead + i] = Math.max(-1, Math.min(1, samples[i] * gain));
  }
  return out;
}

/** Removes Whisper's non-speech annotations like [BLANK_AUDIO] or (music). */
export function cleanTranscript(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]|\([^)]*\)|♪[^♪]*♪/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

