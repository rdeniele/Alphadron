import { initLlama, type LlamaContext } from 'llama.rn';
import { ModelNotReadyError, type AIProvider, type ChatTurn } from './AIProvider';
import { MODEL_MANIFEST } from './modelManifest';
import { getModelInfo, markLoaded } from './modelManager';

const toPath = (uri: string) => uri.replace(/^file:\/\//, '');

export class LocalQwenProvider implements AIProvider {
  readonly id = 'local-qwen3';
  private ctx: LlamaContext | null = null;
  private loading: Promise<void> | null = null;

  isLoaded() {
    return this.ctx !== null;
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

  private async doLoad() {
    const spec = MODEL_MANIFEST.find(m => m.id === 'qwen3')!;
    const info = await getModelInfo(spec);
    if (info.status !== 'downloaded' || !info.localPath) {
      throw new ModelNotReadyError();
    }
    try {
      this.ctx = await initLlama({
        model: toPath(info.localPath),
        n_ctx: 2048,
        n_batch: 256,
        n_threads: 4,
        n_gpu_layers: 0, // CPU: the most compatible choice across phones
        use_mlock: false,
      });
      markLoaded('qwen3', true);
    } catch (e) {
      throw new Error(`Couldn't load the AI model (${(e as Error).message}). The file may be corrupted or the phone is low on memory. Try redownloading it in Settings.`);
    }
  }

  async unload() {
    const c = this.ctx;
    this.ctx = null;
    markLoaded('qwen3', false);
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

  async generateJson(messages: ChatTurn[], schema: object, opts?: { maxTokens?: number }) {
    const res = await this.requireCtx().completion({
      messages,
      jinja: true,
      chat_template_kwargs: { enable_thinking: false },
      response_format: { type: 'json_schema', json_schema: { strict: true, schema } },
      n_predict: opts?.maxTokens ?? 300,
      temperature: 0.1,
      top_k: 20,
      top_p: 0.9,
    });
    return res.content ?? res.text;
  }

  async generateText(messages: ChatTurn[], opts?: { maxTokens?: number }) {
    const res = await this.requireCtx().completion({
      messages,
      jinja: true,
      chat_template_kwargs: { enable_thinking: false },
      n_predict: opts?.maxTokens ?? 256,
      temperature: 0.5,
      top_k: 40,
      top_p: 0.9,
    });
    return (res.content ?? res.text).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  async stop() {
    await this.ctx?.stopCompletion().catch(() => undefined);
  }
}
