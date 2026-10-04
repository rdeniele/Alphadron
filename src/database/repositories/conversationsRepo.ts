import { getDb } from '../db';

export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  id: number;
  conversationId: number;
  role: Role;
  content: string;
  /** JSON: executed tool call + result, shown as an action chip in the UI. */
  toolJson: string | null;
  createdAt: number;
}

interface Row {
  id: number;
  conversation_id: number;
  role: Role;
  content: string;
  tool_json: string | null;
  created_at: number;
}

const map = (r: Row): ChatMessage => ({
  id: r.id,
  conversationId: r.conversation_id,
  role: r.role,
  content: r.content,
  toolJson: r.tool_json,
  createdAt: r.created_at,
});

export async function createConversation(title?: string): Promise<number> {
  const res = await getDb().runAsync(
    'INSERT INTO conversations (title, created_at) VALUES (?, ?)',
    title ?? null,
    Date.now(),
  );
  return res.lastInsertRowId;
}

/** The most recent conversation, or a new one. */
export async function currentConversationId(): Promise<number> {
  const r = await getDb().getFirstAsync<{ id: number }>(
    'SELECT id FROM conversations ORDER BY id DESC LIMIT 1',
  );
  return r ? r.id : createConversation('Chat');
}

export async function addMessage(
  conversationId: number,
  role: Role,
  content: string,
  toolJson?: string | null,
): Promise<ChatMessage> {
  const res = await getDb().runAsync(
    'INSERT INTO messages (conversation_id, role, content, tool_json, created_at) VALUES (?,?,?,?,?)',
    conversationId,
    role,
    content,
    toolJson ?? null,
    Date.now(),
  );
  const r = await getDb().getFirstAsync<Row>('SELECT * FROM messages WHERE id = ?', res.lastInsertRowId);
  return map(r!);
}

export async function listMessages(conversationId: number, limit = 100): Promise<ChatMessage[]> {
  const rows = await getDb().getAllAsync<Row>(
    'SELECT * FROM (SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC',
    conversationId,
    limit,
  );
  return rows.map(map);
}

export async function clearAllConversations() {
  await getDb().runAsync('DELETE FROM conversations');
}

export async function logActivity(action: string, detail?: string) {
  await getDb().runAsync(
    'INSERT INTO activity_logs (action, detail, created_at) VALUES (?,?,?)',
    action,
    detail ?? null,
    Date.now(),
  );
}

export async function recentActivity(limit = 8): Promise<{ id: number; action: string; detail: string | null; createdAt: number }[]> {
  const rows = await getDb().getAllAsync<{ id: number; action: string; detail: string | null; created_at: number }>(
    'SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?',
    limit,
  );
  return rows.map(r => ({ id: r.id, action: r.action, detail: r.detail, createdAt: r.created_at }));
}
