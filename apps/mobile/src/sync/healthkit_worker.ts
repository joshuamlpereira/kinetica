// Phase 4 lands here: HealthKit anchored-query sync worker.
//
// TODO(phase-4, healthkit-auth-quirk): the bridge cannot truthfully report
// which read permissions HealthKit granted — Apple intentionally omits this
// to prevent app fingerprinting. The bridge returns a "granted" list that
// only excludes types the user explicitly denied; a user who dismisses the
// authorization sheet still reads as granted.
//
// This worker must therefore tolerate "authorized but anchored query never
// returns samples." Concretely:
//   - Do not gate UI ("wear your watch to sleep" prompt etc.) on the
//     authorization status alone.
//   - After N consecutive empty anchored queries spanning > 24h with the
//     device known to be the user's primary, surface a passive re-prompt
//     suggesting they re-grant via Settings -> Privacy -> Health.
//   - Never assume zero samples means the user has no data — assume it
//     means we cannot read it.
//
// See apps/mobile/ios-bridge/HealthKitBridge.swift requestAuthorization for
// the upstream reason.

export {};
