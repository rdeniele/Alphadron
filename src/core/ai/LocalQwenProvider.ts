import { initLlama, type LlamaContext } from 'llama.rn';
import { ModelNotReadyError, type AIProvider, type ChatTurn, type GenStats } from './AIProvider';
import { MODEL_MANIFEST, type ModelId } from './modelManifest';
import { getModelInfo, markLoaded } from './modelManager';

const toPath = (uri: string) => uri.replace(/^file:\/\//, '');
const QWEN_IDS: ModelId[] = ['qwen3_fast', 'qwen3'];

type Timings = {
  prompt_n: number;
  cache_n: number;
  prompt_ms: number;
  predicted_n: number;
  predicted_ms: number;
  predicted_per_second: number;
};

export class LocalQwenProvider implements AIProvider {
  readonly id = 'local-qwen3';
  lastStats: GenStats | null = null;
  private ctx: LlamaContext | null = null;
  private loadedId: ModelId | null = null;
  private preferred: ModelId = 'qwen3_fast';
  private loading: Promise<void> | null = null;

  isLoaded() {
    return this.ctx !== null;
  }

  /** Switches which model is used; a loaded different model is released. */
  async setPreferred(id: ModelId) {
    if (!QWEN_IDS.includes(id) || id === this.preferred) {
      return;
    }
    this.preferred = id;
    if (this.ctx && this.loadedId !== id) {
      await this.unload();
    }
  }

  load(): Promise<void> {
    if (this.ctx) {
      return Promise.resolve();
    }
    if (!this.loading) {
      this.loading = this.doLoad().finally(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  /** Preferred model if downloaded, otherwise whichever Qwen is available. */
  private async resolveModel() {
    const order = [this.preferred, ...QWEN_IDS.filter(i => i !== this.preferred)];
    for (const id of order) {
      const info = await getModelInfo(MODEL_MANIFEST.find(m => m.id === id)!);
      if (info.status === 'downloaded' && info.localPath) {
        return { id, path: info.localPath };
      }
    }
    return null;
  }

  private async doLoad() {
    const found = await this.resolveModel();
    if (!found) {
      throw new ModelNotReadyError();
    }
    try {
      this.ctx = await initLlama({
        model: toPath(found.path),
        n_ctx: 1536,
        n_batch: 256,
        n_threads: 4,
        n_gpu_layers: 0, // CPU: the most compatible choice across phones
        use_mlock: false,
      });
      this.loadedId = found.id;
      markLoaded(found.id, true);
    } catch (e) {
      throw new Error(`Couldn't load the AI model (${(e as Error).message}). The file may be corrupted or the phone is low on memory. Try redownloading it in Settings.`);
    }
  }

  async unload() {
    const c = this.ctx;
    const id = this.loadedId;
    this.ctx = null;
    this.loadedId = null;
    if (id) {
      markLoaded(id, false);
    }
    if (c) {
      await c.release().catch(() => undefined);
    }
  }

  private requireCtx(): LlamaContext {
    if (!this.ctx) {
      throw new ModelNotReadyError('The AI model is not loaded.');
    }
    return this.ctx;
  }

  private record(t: Timings | undefined) {
    if (!t) {
      return;
    }
    this.lastStats = {
      promptTokens: t.prompt_n,
      cachedTokens: t.cache_n,
      promptMs: Math.round(t.prompt_ms),
      genTokens: t.predicted_n,
      genMs: Math.round(t.predicted_ms),
      tokensPerSecond: Math.round(t.predicted_per_second * 10) / 10,
    };
  }

  async generateJson(messages: ChatTurn[], schema: object, opts?: { maxTokens?: number }) {
    const res = await this.requireCtx().completion({
      messages,
      jinja: true,
      chat_template_kwargs: { enable_thinking: false },
      response_format: { type: 'json_schema', json_schema: { strict: true, schema } },
      n_predict: opts?.maxTokens ?? 120,
      temperature: 0, // deterministic: we want the most likely valid action
      top_k: 1,
    });
    this.record(res.timings);
    return res.content ?? res.text;
  }

  async generateText(messages: ChatTurn[], opts?: { maxTokens?: number }) {
    const res = await this.requireCtx().completion({
      messages,
      jinja: true,
      chat_template_kwargs: { enable_thinking: false },
      n_predict: opts?.maxTokens ?? 120,
      temperature: 0.4,
      top_k: 40,
      top_p: 0.9,
    });
    this.record(res.timings);
    return (res.content ?? res.text).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  async stop() {
    await this.ctx?.stopCompletion().catch(() => undefined);
  }
}
