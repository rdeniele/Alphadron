import { getDb } from '../db';

export type ModelStatus = 'not_downloaded' | 'downloading' | 'downloaded' | 'corrupted';

export interface ModelStateRow {
  id: string;
  status: ModelStatus;
  localPath: string | null;
  bytesDownloaded: number;
  checksumVerified: boolean;
}

export async function getModelState(id: string): Promise<ModelStateRow | null> {
  const res = await getDb().execute('SELECT * FROM model_state WHERE id = ?', [id]);
  const r = res.rows[0];
  if (!r) {
    return null;
  }
  return {
    id: String(r.id),
    status: r.status as ModelStatus,
    localPath: r.local_path ? String(r.local_path) : null,
    bytesDownloaded: Number(r.bytes_downloaded),
    checksumVerified: Number(r.checksum_verified) === 1,
  };
}

export async function setModelState(s: ModelStateRow) {
  await getDb().execute(
    'INSERT OR REPLACE INTO model_state (id, status, local_path, bytes_downloaded, checksum_verified, updated_at) VALUES (?,?,?,?,?,?)',
    [s.id, s.status, s.localPath, s.bytesDownloaded, s.checksumVerified ? 1 : 0, Date.now()],
  );
}
