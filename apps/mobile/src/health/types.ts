// Subset of HealthKit type identifiers Kinetica reads. Extend as new sources
// are wired up. The string values must match Apple's identifiers exactly so
// they can be passed through the bridge to native code.

export type HealthKitTypeIdentifier =
  | 'HKCategoryTypeIdentifierSleepAnalysis'
  | 'HKQuantityTypeIdentifierStepCount'
  | 'HKQuantityTypeIdentifierActiveEnergyBurned';

export interface AuthorizationResult {
  granted: HealthKitTypeIdentifier[];
}

export interface AnchoredQueryResult {
  samples: unknown[];
  newAnchor: string | null;
}

export type BackgroundDeliveryFrequency = 'immediate' | 'hourly' | 'daily';
