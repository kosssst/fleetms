import { NativeModules } from 'react-native';

type WakeLockModuleType = {
  acquire: () => Promise<boolean>;
  release: () => Promise<boolean>;
  isHeld: () => Promise<boolean>;
};

const { WakeLock } = NativeModules as { WakeLock: WakeLockModuleType };

export const wakeLock = {
  acquire: () => WakeLock.acquire(),
  release: () => WakeLock.release(),
  isHeld:  () => WakeLock.isHeld(),
};
