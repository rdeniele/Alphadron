import * as FS from 'expo-file-system/legacy';
import { extractArchive } from 'react-native-sherpa-onnx/extraction';
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
  loaded: boolean;
}

const MODELS_DIR = `${FS.documentDirectory}models/`;
const STORAGE_HEADROOM = 200 * 1024 * 1024;

const activeJobs = new Map<ModelId, FS.DownloadResumable>();
const cancelled = new Set<ModelId>();
const loaded = new Set<ModelId>();

export function markLoaded(id: ModelId, isLoaded: boolean) {
  if (isLoaded) {
    loaded.add(id);
  } else {
    loaded.delete(id);
  }
}

const pathFor = (spec: ModelSpec) => `${MODELS_DIR}${spec.fileName}`;
/** Where the usable model lives: the file itself, or the extracted directory. */
const usablePath = (spec: ModelSpec) => (spec.extractDir ? `${MODELS_DIR}${spec.extractDir}` : pathFor(spec));
const plain = (uri: string) => uri.replace(/^file:\/\//, '');
const remove = (uri: string) => FS.deleteAsync(uri, { idempotent: true });

const reset = (id: ModelId, status: ModelStatus = 'not_downloaded') =>
  setModelState({ id, status, localPath: null, bytesDownloaded: 0, checksumVerified: false });

export async function getModelInfo(spec: ModelSpec): Promise<ModelInfo> {
  const state = await getModelState(spec.id);
  let status: ModelStatus = state?.status ?? 'not_downloaded';
  const path = usablePath(spec);
  // A "downloading" row with no active job means the app was killed mid-download.
  if (status === 'downloading' && !activeJobs.has(spec.id)) {
    status = 'not_downloaded';
    await remove(`${pathFor(spec)}.part`);
  }
  if (status === 'downloaded' && !(await FS.getInfoAsync(path)).exists) {
    status = 'not_downloaded';
  }
  return {
    spec,
    status,
    localPath: status === 'downloaded' ? path : null,
    loaded: loaded.has(spec.id),
  };
}

export function listModels(): Promise<ModelInfo[]> {
  return Promise.all(MODEL_MANIFEST.map(getModelInfo));
}

const MAX_ATTEMPTS = 8;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Downloads to partPath, retrying dropped connections. After a failure the next
 * attempt resumes from the bytes already on disk (HTTP Range), so a flaky
 * connection never restarts a large download from zero.
 */
async function fetchWithResume(
  spec: ModelSpec,
  partPath: string,
  onProgress: (p: number) => void,
): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (cancelled.has(spec.id)) {
      return;
    }
    const info = await FS.getInfoAsync(partPath);
    const have = info.exists ? info.size : 0;
    if (have === spec.sizeBytes) {
      return;
    }
    const job = FS.createDownloadResumable(
      spec.url!,
      partPath,
      {},
      p => onProgress(p.totalBytesWritten / spec.sizeBytes),
      have > 0 ? String(have) : undefined,
    );
    activeJobs.set(spec.id, job);
    try {
      const result = have > 0 ? await job.resumeAsync() : await job.downloadAsync();
      if (cancelled.has(spec.id)) {
        return;
      }
      if (result && (result.status === 200 || result.status === 206)) {
        return;
      }
      lastError = new Error(`HTTP ${result?.status ?? 'unknown'}`);
    } catch (e) {
      if (cancelled.has(spec.id)) {
        return;
      }
      lastError = e;
    }
    await sleep(Math.min(2000 * attempt, 10000));
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `The connection kept dropping (${detail}). Your progress is not saved between launches; try again on a steadier Wi-Fi connection.`,
  );
}

/**
 * Explicit, user-initiated download. Throws a user-readable Error on failure.
 * Integrity: exact byte-size match. The manifest's sha256 is verified in the
 * dev build (native streaming hash); Expo Go has no streaming hash API.
 */
export async function downloadModel(
  spec: ModelSpec,
  onProgress: (p: number) => void,
): Promise<void> {
  if (!spec.url) {
    throw new Error(`${spec.name} is not available for download yet.`);
  }
  const free = await FS.getFreeDiskStorageAsync();
  if (free < spec.sizeBytes + STORAGE_HEADROOM) {
    const needMb = Math.ceil((spec.sizeBytes + STORAGE_HEADROOM) / 1048576);
    throw new Error(`Not enough storage. ${needMb} MB of free space is needed.`);
  }
  await FS.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
  const finalPath = pathFor(spec);
  const partPath = `${finalPath}.part`;
  await remove(partPath);
  cancelled.delete(spec.id);
  await setModelState({
    id: spec.id,
    status: 'downloading',
    localPath: null,
    bytesDownloaded: 0,
    checksumVerified: false,
  });

  try {
    await fetchWithResume(spec, partPath, onProgress);
    if (cancelled.has(spec.id)) {
      throw new Error('Download cancelled.');
    }
    const info = await FS.getInfoAsync(partPath);
    const size = info.exists ? info.size : 0;
    if (size !== spec.sizeBytes) {
      await reset(spec.id, 'corrupted');
      throw new Error('The downloaded file is the wrong size. Please download again.');
    }
    await FS.moveAsync({ from: partPath, to: finalPath });
    if (spec.extractDir) {
      const target = usablePath(spec);
      await remove(target);
      const ex = await extractArchive(
        { modelId: spec.id, archivePath: plain(finalPath), format: 'tar.bz2' },
        plain(MODELS_DIR),
        { force: true },
      );
      await remove(finalPath);
      if (!ex.success) {
        await reset(spec.id, 'corrupted');
        throw new Error('Could not unpack the voice model. Please download it again.');
      }
    }
    await setModelState({
      id: spec.id,
      status: 'downloaded',
      localPath: usablePath(spec),
      bytesDownloaded: size,
      checksumVerified: false,
    });
  } catch (e) {
    await remove(partPath);
    const st = await getModelState(spec.id);
    if (st?.status === 'downloading') {
      await reset(spec.id);
    }
    throw e;
  } finally {
    activeJobs.delete(spec.id);
  }
}

export async function cancelDownload(id: ModelId) {
  cancelled.add(id);
  await activeJobs.get(id)?.cancelAsync().catch(() => undefined);
}

export async function deleteModel(spec: ModelSpec): Promise<void> {
  loaded.delete(spec.id);
  await remove(usablePath(spec));
  await remove(pathFor(spec));
  await remove(`${pathFor(spec)}.part`);
  await reset(spec.id);
}
