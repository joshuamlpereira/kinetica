# Kinetica mobile

React Native (Expo bare workflow), TypeScript strict, iOS-first.

## First-time setup

```
pnpm install
pnpm --filter mobile prebuild
cd ios && pod install && cd -
pnpm --filter mobile ios
```

`expo prebuild` regenerates the `ios/` directory. The HealthKit bridge sources
in `ios-bridge/` are copied in and registered on the Xcode project by the
config plugin at `plugins/withHealthKit.js`, so they survive prebuild.

## Layout

```
src/
  db/         WatermelonDB adapter, schema, models
  health/     HealthKit TS wrapper over the native bridge
  state/      Zustand stores
  theme/      Design tokens
ios-bridge/   Native HealthKit bridge (Swift + ObjC), version-controlled
plugins/      Expo config plugins
```

## Phase 1 status

This phase scaffolds the app and the bridge but does no data ingestion. On
launch you see one button, "Authorize HealthKit", which triggers the system
authorization sheet for sleep, step count, and active energy.
