import * as RNFS from '@dr.pogodin/react-native-fs';
import { MODEL_MANIFEST, type ModelId, type ModelSpec } from './modelManifest';
import {
  getModelState,
  setModelState,
  type ModelStatus,
} from '../../database/repositories/modelStateRepo';

export interface ModelInfo {
  spec: ModelSpec;
  status: ModelStatus;
  localPath: string | null;
  progress: number; // 0..1
  loaded: boolean;
}

const MODELS_DIR = `${RNFS.DocumentDirectoryPath}/models`;
const STORAGE_HEADROOM = 200 * 1024 * 1024;

const activeJobs = new Map<ModelId, number>();
const loaded = new Set<ModelId>();

export function markLoaded(id: ModelId, isLoaded: boolean) {
  if (isLoaded) {
    loaded.add(id);
  } else {
    loaded.delete(id);
  }
}

function pathFor(spec: ModelSpec) {
  return `${MODELS_DIR}/${spec.fileName}`;
}

const reset = (id: ModelId, status: ModelStatus = 'not_downloaded') =>
  setModelState({ id, status, localPath: null, bytesDownloaded: 0, checksumVerified: false });

export async function getModelInfo(spec: ModelSpec): Promise<ModelInfo> {
  const state = await getModelState(spec.id);
  let status: ModelStatus = state?.status ?? 'not_downloaded';
  const path = pathFor(spec);
  // A "downloading" row with no active job means the app was killed mid-download.
  if (status === 'downloading' && !activeJobs.has(spec.id)) {
    status = 'not_downloaded';
    await RNFS.unlink(`${path}.part`).catch(() => undefined);
  }
  if (status === 'downloaded' && !(await RNFS.exists(path))) {
    status = 'not_downloaded';
  }
  return {
    spec,
    status,
    localPath: status === 'downloaded' ? path : null,
    progress: status === 'downloaded' ? 1 : 0,
    loaded: loaded.has(spec.id),
  };
}

export function listModels(): Promise<ModelInfo[]> {
  return Promise.all(MODEL_MANIFEST.map(getModelInfo));
}

/** Explicit, user-initiated download. Throws a user-readable Error on failure. */
export async function downloadModel(
  spec: ModelSpec,
  onProgress: (p: number) => void,
): Promise<void> {
  if (!spec.url || !spec.sha256) {
    throw new Error(`${spec.name} is not available for download yet.`);
  }
  const fs = await RNFS.getFSInfo();
  if (fs.freeSpace < spec.sizeBytes + STORAGE_HEADROOM) {
    const needMb = Math.ceil((spec.sizeBytes + STORAGE_HEADROOM) / 1048576);
    throw new Error(`Not enough storage. ${needMb} MB of free space is needed.`);
  }
  await RNFS.mkdir(MODELS_DIR);
  const finalPath = pathFor(spec);
  const partPath = `${finalPath}.part`;
  await RNFS.unlink(partPath).catch(() => undefined);
  await setModelState({
    id: spec.id,
    status: 'downloading',
    localPath: null,
    bytesDownloaded: 0,
    checksumVerified: false,
  });

  try {
    const job = RNFS.downloadFile({
      fromUrl: spec.url,
      toFile: partPath,
      progressInterval: 500,
      progress: r => onProgress(r.bytesWritten / spec.sizeBytes),
      background: true,
      discretionary: false,
    });
    activeJobs.set(spec.id, job.jobId);
    const result = await job.promise;
    if (result.statusCode !== 200) {
      throw new Error(`Download failed (HTTP ${result.statusCode}).`);
    }
    const size = Number((await RNFS.stat(partPath)).size);
    if (size !== spec.sizeBytes) {
      throw new Error('Download was incomplete. Please try again.');
    }
    const hash = await RNFS.hash(partPath, 'sha256');
    if (hash.toLowerCase() !== spec.sha256) {
      await RNFS.unlink(partPath).catch(() => undefined);
      await reset(spec.id, 'corrupted');
      throw new Error('Checksum mismatch: the file was corrupted. Please download again.');
    }
    await RNFS.moveFile(partPath, finalPath);
    await setModelState({
      id: spec.id,
      status: 'downloaded',
      localPath: finalPath,
      bytesDownloaded: size,
      checksumVerified: true,
    });
  } catch (e) {
    await RNFS.unlink(partPath).catch(() => undefined);
    const st = await getModelState(spec.id);
    if (st?.status === 'downloading') {
      await reset(spec.id);
    }
    throw e;
  } finally {
    activeJobs.delete(spec.id);
  }
}

export function cancelDownload(id: ModelId) {
  const job = activeJobs.get(id);
  if (job !== undefined) {
    RNFS.stopDownload(job);
  }
}

export async function deleteModel(spec: ModelSpec): Promise<void> {
  loaded.delete(spec.id);
  await RNFS.unlink(pathFor(spec)).catch(() => undefined);
  await RNFS.unlink(`${pathFor(spec)}.part`).catch(() => undefined);
  await reset(spec.id);
}
