import type { AIProvider, ChatTurn } from './AIProvider';
import { parseModelAction } from './parseOutput';
import { buildResponseSchema, buildSystemPrompt } from './prompt';
import { executeTool, type ExecutedTool } from '../tools/executor';
import { TOOLS } from '../tools/tools';
import type { ToolContext } from '../tools/types';
import { searchMemories } from '../../database/repositories/memoriesRepo';
import { listTasks } from '../../database/repositories/tasksRepo';
import { getPreference } from '../../database/repositories/settingsRepo';
import {
  addMessage,
  currentConversationId,
  listMessages,
  type ChatMessage,
} from '../../database/repositories/conversationsRepo';

export interface TurnResult {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  action: ExecutedTool | null;
}

export interface TurnDeps {
  provider: AIProvider;
  ctx: Omit<ToolContext, 'now'>;
  onStatus?: (status: 'loading' | 'thinking' | 'acting') => void;
}

const schemaCache = buildResponseSchema(TOOLS);

/**
 * One full assistant turn: text -> local model -> tool/reply -> SQLite -> response.
 * Conversation history is stored; "permanent memory" is only written via save_memory.
 */
export async function runTurn(userText: string, deps: TurnDeps): Promise<TurnResult> {
  const now = new Date();
  const convId = await currentConversationId();
  const userMessage = await addMessage(convId, 'user', userText);

  const history = (await listMessages(convId, 8))
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.id !== userMessage.id)
    .slice(-6)
    .map<ChatTurn>(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const [memories, openTasks, userName] = await Promise.all([
    deps.ctx.memoryEnabled ? searchMemories(userText, 4) : Promise.resolve([]),
    listTasks({ status: 'open' }),
    getPreference('user_name'),
  ]);

  const system = buildSystemPrompt({
    tools: TOOLS,
    now,
    memories: memories.map(m => m.content),
    openTaskCount: openTasks.length,
    userName,
  });
  const messages: ChatTurn[] = [{ role: 'system', content: system }, ...history, { role: 'user', content: userText }];

  deps.onStatus?.('loading');
  await deps.provider.load();
  deps.onStatus?.('thinking');

  let replyText: string;
  let action: ExecutedTool | null = null;

  const raw = await deps.provider.generateJson(messages, schemaCache);
  const parsed = parseModelAction(raw);

  if (!parsed) {
    replyText = (await deps.provider.generateText(messages)) || "Sorry, I didn't understand that.";
  } else if (parsed.kind === 'reply') {
    replyText = parsed.reply.trim() || "I'm not sure how to help with that.";
  } else {
    deps.onStatus?.('acting');
    action = await executeTool(parsed.tool, parsed.arguments, { ...deps.ctx, now });
    if (action.readOnly && action.result.ok && action.result.data !== undefined) {
      // Second pass: phrase the answer using the real data, not the model's guess.
      const followUp: ChatTurn[] = [
        ...messages,
        { role: 'assistant', content: raw },
        {
          role: 'user',
          content: `Tool result (real data from the user's device): ${JSON.stringify(action.result.data)}\nAnswer my original question in 1-3 short sentences using only this data. If it is empty, say so.`,
        },
      ];
      deps.onStatus?.('thinking');
      replyText = (await deps.provider.generateText(followUp)) || action.result.summary;
    } else {
      replyText = action.result.summary;
    }
  }

  const toolJson = action
    ? JSON.stringify({ tool: action.tool, ok: action.result.ok, chip: action.result.chip })
    : null;
  const assistantMessage = await addMessage(convId, 'assistant', replyText, toolJson);
  return { userMessage, assistantMessage, action };
}
