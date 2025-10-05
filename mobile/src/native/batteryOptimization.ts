import { NativeModules, Platform } from 'react-native';

type BatteryOptimizationModule = {
  isIgnoringOptimizations(): Promise<boolean>;
  requestIgnore(): void;
  openSettings(): void;
};

const mod: BatteryOptimizationModule =
  Platform.OS === 'android'
    ? (NativeModules.BatteryOptimization as BatteryOptimizationModule)
    : ({} as any);

export const BatteryOptimization = {
  async isWhitelisted(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      return await mod.isIgnoringOptimizations();
    } catch {
      return false;
    }
  },
  request(): void {
    if (Platform.OS === 'android') mod.requestIgnore();
  },
  openSettings(): void {
    if (Platform.OS === 'android') mod.openSettings();
  },
};
