import { getDb } from '../db';

export type ModelStatus = 'not_downloaded' | 'downloading' | 'downloaded' | 'corrupted';

export interface ModelStateRow {
  id: string;
  status: ModelStatus;
  localPath: string | null;
  bytesDownloaded: number;
  checksumVerified: boolean;
}

interface Row {
  id: string;
  status: ModelStatus;
  local_path: string | null;
  bytes_downloaded: number;
  checksum_verified: number;
}

export async function getModelState(id: string): Promise<ModelStateRow | null> {
  const r = await getDb().getFirstAsync<Row>('SELECT * FROM model_state WHERE id = ?', id);
  if (!r) {
    return null;
  }
  return {
    id: r.id,
    status: r.status,
    localPath: r.local_path,
    bytesDownloaded: r.bytes_downloaded,
    checksumVerified: r.checksum_verified === 1,
  };
}

export async function setModelState(s: ModelStateRow) {
  await getDb().runAsync(
    'INSERT OR REPLACE INTO model_state (id, status, local_path, bytes_downloaded, checksum_verified, updated_at) VALUES (?,?,?,?,?,?)',
    s.id,
    s.status,
    s.localPath,
    s.bytesDownloaded,
    s.checksumVerified ? 1 : 0,
    Date.now(),
  );
}
