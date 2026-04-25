import Foundation
import HealthKit

@objc(HealthKitBridge)
final class HealthKitBridge: NSObject {
  private let store = HKHealthStore()
  private var anchors: [String: HKQueryAnchor] = [:]

  @objc static func requiresMainQueueSetup() -> Bool { false }

  // MARK: - Authorization

  @objc(requestAuthorization:resolver:rejecter:)
  func requestAuthorization(
    _ identifiers: [String],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard HKHealthStore.isHealthDataAvailable() else {
      reject("E_HK_UNAVAILABLE", "HealthKit is not available on this device.", nil)
      return
    }

    var requested: Set<HKObjectType> = []
    for identifier in identifiers {
      guard let type = Self.objectType(for: identifier) else {
        reject("E_HK_UNKNOWN_TYPE", "Unknown HealthKit type: \(identifier)", nil)
        return
      }
      requested.insert(type)
    }

    store.requestAuthorization(toShare: nil, read: requested) { success, error in
      if let error = error {
        reject("E_HK_AUTH", error.localizedDescription, error)
        return
      }
      // HealthKit deliberately does not tell us which read permissions were
      // granted. We surface the authorizationStatus per type and treat
      // anything other than .sharingDenied as "granted" for UI purposes.
      //
      // Consequence: the user can dismiss the sheet without granting reads
      // and we'll still report the type as granted. The Phase 4 sync worker
      // must handle "authorized but anchored query returns no samples
      // indefinitely" — see apps/mobile/src/sync/healthkit_worker.ts TODO.
      let granted = identifiers.filter { id in
        guard let type = Self.objectType(for: id) else { return false }
        return self.store.authorizationStatus(for: type) != .sharingDenied
      }
      resolve(["granted": granted, "succeeded": success])
    }
  }

  // MARK: - Anchored queries

  @objc(queryAnchored:anchor:resolver:rejecter:)
  func queryAnchored(
    _ identifier: String,
    anchor anchorString: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let sampleType = Self.sampleType(for: identifier) else {
      reject("E_HK_UNKNOWN_TYPE", "Unknown or non-sample HealthKit type: \(identifier)", nil)
      return
    }

    let anchor = Self.decodeAnchor(anchorString)

    let query = HKAnchoredObjectQuery(
      type: sampleType,
      predicate: nil,
      anchor: anchor,
      limit: HKObjectQueryNoLimit
    ) { [weak self] _, samples, _, newAnchor, error in
      if let error = error {
        reject("E_HK_QUERY", error.localizedDescription, error)
        return
      }
      let payload = (samples ?? []).map(Self.serialize)
      let encodedAnchor = Self.encodeAnchor(newAnchor)
      if let newAnchor = newAnchor {
        self?.anchors[identifier] = newAnchor
      }
      resolve(["samples": payload, "newAnchor": encodedAnchor as Any])
    }

    store.execute(query)
  }

  // MARK: - Background delivery

  @objc(enableBackgroundDelivery:frequency:resolver:rejecter:)
  func enableBackgroundDelivery(
    _ identifier: String,
    frequency: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let sampleType = Self.sampleType(for: identifier) else {
      reject("E_HK_UNKNOWN_TYPE", "Unknown or non-sample HealthKit type: \(identifier)", nil)
      return
    }
    let updateFrequency: HKUpdateFrequency
    switch frequency {
    case "immediate": updateFrequency = .immediate
    case "hourly": updateFrequency = .hourly
    case "daily": updateFrequency = .daily
    default:
      reject("E_HK_FREQ", "Unknown frequency: \(frequency)", nil)
      return
    }
    store.enableBackgroundDelivery(for: sampleType, frequency: updateFrequency) { success, error in
      if let error = error {
        reject("E_HK_BG", error.localizedDescription, error)
        return
      }
      if success {
        resolve(nil)
      } else {
        reject("E_HK_BG", "Background delivery enable returned false.", nil)
      }
    }
  }

  // MARK: - Type mapping

  private static func objectType(for identifier: String) -> HKObjectType? {
    if let id = HKQuantityTypeIdentifier.from(identifier) {
      return HKObjectType.quantityType(forIdentifier: id)
    }
    if let id = HKCategoryTypeIdentifier.from(identifier) {
      return HKObjectType.categoryType(forIdentifier: id)
    }
    return nil
  }

  private static func sampleType(for identifier: String) -> HKSampleType? {
    if let id = HKQuantityTypeIdentifier.from(identifier) {
      return HKObjectType.quantityType(forIdentifier: id)
    }
    if let id = HKCategoryTypeIdentifier.from(identifier) {
      return HKObjectType.categoryType(forIdentifier: id)
    }
    return nil
  }

  // MARK: - Anchor encoding

  private static func decodeAnchor(_ raw: String?) -> HKQueryAnchor? {
    guard let raw = raw, let data = Data(base64Encoded: raw) else { return nil }
    return try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: data)
  }

  private static func encodeAnchor(_ anchor: HKQueryAnchor?) -> String? {
    guard let anchor = anchor else { return nil }
    let data = try? NSKeyedArchiver.archivedData(withRootObject: anchor, requiringSecureCoding: true)
    return data?.base64EncodedString()
  }

  // MARK: - Serialization

  private static func serialize(_ sample: HKSample) -> [String: Any] {
    var base: [String: Any] = [
      "uuid": sample.uuid.uuidString,
      "startDate": sample.startDate.timeIntervalSince1970,
      "endDate": sample.endDate.timeIntervalSince1970,
      "sourceBundleIdentifier": sample.sourceRevision.source.bundleIdentifier,
    ]
    if let q = sample as? HKQuantitySample {
      base["kind"] = "quantity"
      base["quantityTypeIdentifier"] = q.quantityType.identifier
      base["count"] = q.quantity.doubleValue(for: HKUnit.count())
    } else if let c = sample as? HKCategorySample {
      base["kind"] = "category"
      base["categoryTypeIdentifier"] = c.categoryType.identifier
      base["value"] = c.value
    }
    return base
  }
}

private extension HKQuantityTypeIdentifier {
  static func from(_ raw: String) -> HKQuantityTypeIdentifier? {
    let known: [String: HKQuantityTypeIdentifier] = [
      "HKQuantityTypeIdentifierStepCount": .stepCount,
      "HKQuantityTypeIdentifierActiveEnergyBurned": .activeEnergyBurned,
    ]
    return known[raw]
  }
}

private extension HKCategoryTypeIdentifier {
  static func from(_ raw: String) -> HKCategoryTypeIdentifier? {
    let known: [String: HKCategoryTypeIdentifier] = [
      "HKCategoryTypeIdentifierSleepAnalysis": .sleepAnalysis,
    ]
    return known[raw]
  }
}
