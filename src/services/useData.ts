import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAssistant } from '../features/assistant/AssistantProvider';

/** Loads data from SQLite; reloads on screen focus and after any assistant action. */
export function useData<T>(loader: () => Promise<T>, initial: T): [T, () => Promise<void>] {
  const { dataVersion } = useAssistant();
  const [data, setData] = useState<T>(initial);

  const reload = useCallback(async () => {
    setData(await loader());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  useEffect(() => {
    reload();
  }, [dataVersion, reload]);

  return [data, reload];
}
