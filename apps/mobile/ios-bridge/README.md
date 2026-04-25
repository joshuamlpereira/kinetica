# Native HealthKit bridge

These two source files (`HealthKitBridge.swift`, `HealthKitBridge.m`) are the
read-only HealthKit bridge consumed from JS via `src/health/bridge.ts`. They
are kept under version control here, outside the generated `ios/` directory,
so they survive `expo prebuild`.

The Expo config plugin at `apps/mobile/plugins/withHealthKit.js` copies these
files into `ios/Kinetica/HealthKitBridge/` and registers them on the Xcode
project during prebuild. After `expo prebuild` completes, run `pod install`
inside `ios/` and the next iOS build will include the bridge.

## Bridge surface

- `requestAuthorization(types: HKTypeId[]): Promise<{ granted: HKTypeId[] }>`
- `queryAnchored(type, anchor?): Promise<{ samples, newAnchor }>`
- `enableBackgroundDelivery(type, frequency): Promise<void>`

## Currently mapped HealthKit identifiers

- `HKCategoryTypeIdentifierSleepAnalysis`
- `HKQuantityTypeIdentifierStepCount`
- `HKQuantityTypeIdentifierActiveEnergyBurned`

To add a new type, extend the `from(_:)` helpers at the bottom of
`HealthKitBridge.swift` and the `HealthKitTypeIdentifier` union in
`src/health/types.ts`.
