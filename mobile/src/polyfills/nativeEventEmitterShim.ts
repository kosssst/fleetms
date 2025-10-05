import { NativeModules } from 'react-native';

// List any modules that BackgroundTimer (or others) pass to NativeEventEmitter:
const maybePatch = (m: any) => {
  if (!m) return;
  if (!m.addListener) m.addListener = () => {};
  if (!m.removeListeners) m.removeListeners = () => {};
};

// Known names used by popular timers:
maybePatch((NativeModules as any).BackgroundTimer);
maybePatch((NativeModules as any).RNBackgroundTimer);
