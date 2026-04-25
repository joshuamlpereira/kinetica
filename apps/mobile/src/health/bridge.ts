import { NativeModules, Platform } from 'react-native';

import type {
  AnchoredQueryResult,
  AuthorizationResult,
  BackgroundDeliveryFrequency,
  HealthKitTypeIdentifier,
} from './types';

export type {
  AnchoredQueryResult,
  AuthorizationResult,
  BackgroundDeliveryFrequency,
  HealthKitTypeIdentifier,
};

interface HealthKitNativeModule {
  requestAuthorization(types: HealthKitTypeIdentifier[]): Promise<AuthorizationResult>;
  queryAnchored(
    type: HealthKitTypeIdentifier,
    anchor: string | null,
  ): Promise<AnchoredQueryResult>;
  enableBackgroundDelivery(
    type: HealthKitTypeIdentifier,
    frequency: BackgroundDeliveryFrequency,
  ): Promise<void>;
}

const LINKING_ERROR =
  "The native module 'HealthKitBridge' is not linked. Run `expo prebuild` then `pod install` and rebuild the iOS app.";

function loadNative(): HealthKitNativeModule {
  if (Platform.OS !== 'ios') {
    throw new Error('HealthKit is iOS-only.');
  }
  // reason: the module is registered from native and not typed by RN itself.
  const native = (NativeModules as Record<string, unknown>).HealthKitBridge as
    | HealthKitNativeModule
    | undefined;
  if (!native) {
    throw new Error(LINKING_ERROR);
  }
  return native;
}

export const HealthKitBridge: HealthKitNativeModule = {
  requestAuthorization: (types) => loadNative().requestAuthorization(types),
  queryAnchored: (type, anchor) => loadNative().queryAnchored(type, anchor),
  enableBackgroundDelivery: (type, frequency) =>
    loadNative().enableBackgroundDelivery(type, frequency),
};
