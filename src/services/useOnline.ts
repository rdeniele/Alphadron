import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/** Connectivity is informational only; the core assistant never depends on it. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener(s => setOnline(!!s.isConnected)), []);
  return online;
}
