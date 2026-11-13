import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/** True unless the device is known to be offline. "Unknown" counts as online so the UI never cries wolf at start-up. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(
    () => NetInfo.addEventListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false)),
    [],
  );
  return online;
}
