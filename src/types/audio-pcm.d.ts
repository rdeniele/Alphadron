// The package ships typings under a different module name; declare the real one.
declare module '@fugood/react-native-audio-pcm-stream' {
  interface Options {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    audioSource?: number;
    wavFile: string;
    bufferSize?: number;
  }
  const AudioRecord: {
    init: (options: Options) => void;
    start: () => void;
    stop: () => Promise<string>;
    on: (event: 'data', callback: (base64: string) => void) => void;
  };
  export default AudioRecord;
}
