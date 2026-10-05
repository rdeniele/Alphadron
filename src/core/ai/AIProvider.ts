export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Abstraction over the reasoning model. LocalQwenProvider is the only
 * implementation now; a CloudProvider can be added later without touching callers.
 */
export interface GenStats {
  promptTokens: number;
  cachedTokens: number;
  promptMs: number;
  genTokens: number;
  genMs: number;
  tokensPerSecond: number;
}

export interface AIProvider {
  /** Timing of the most recent generation (for diagnostics). */
  lastStats: GenStats | null;
  readonly id: string;
  isLoaded(): boolean;
  /** Loads the model into memory. Rejects with a user-readable Error. */
  load(): Promise<void>;
  /** Frees the model's memory. */
  unload(): Promise<void>;
  /** Output constrained to a JSON schema (grammar-enforced for local models). */
  generateJson(messages: ChatTurn[], schema: object, opts?: { maxTokens?: number }): Promise<string>;
  generateText(messages: ChatTurn[], opts?: { maxTokens?: number }): Promise<string>;
  stop(): Promise<void>;
}

export class ModelNotReadyError extends Error {
  constructor(message = 'The AI model is not downloaded yet. Open Settings to download Qwen3.') {
    super(message);
    this.name = 'ModelNotReadyError';
  }
}
