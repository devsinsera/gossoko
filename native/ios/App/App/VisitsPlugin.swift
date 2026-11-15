// Gossoko check-ins, arrival alerts and visit prompts (iPhone/iPad).
//
// The web app (sinsera.co/gossoko/admin/, src/lib/visits/) sends the venues, the user's settings and the
// rules (src/lib/visits/policy.ts, same numbers) through configure(). This file then runs on its own,
// also while Gossoko is closed: iOS region monitoring watches the nearest 20 venues (re-picked on
// significant location changes) and the alerts are local notifications:
//   enter → "At <venue>?" queued for +2 min, "How was <venue>?" for +20 min;
//   exit  → anything not yet shown is cancelled (drive-pasts never alert); leaving after ≥10 min sends
//           the review prompt then; a stay of ≥2 min is kept as a visit, uploaded by the web app later
//           as an 'auto' check-in (takeVisits).
// Positions stay on the phone; only venue + time leave it (as check-ins).

import Foundation
import Capacitor
import CoreLocation
import UserNotifications
import UIKit

// MARK: - Model (JSON from the web app; extra keys are ignored)

struct VisitSettings: Codable {
    var enabled = false
    var arrival = true
    var prompts = true
    var quietFrom = "20:00"
    var quietTo = "05:00"
}

struct VisitRules: Codable {
    var regionRadiusM: Double = 100
    var arrivalDwellS: Double = 120
    var reviewDwellS: Double = 1200
    var reviewOnLeaveMinS: Double = 600
    var arrivalGapH: Double = 20
    var reviewGapD: Double = 7
    var maxRegionsIos: Double = 20
}

struct VisitVenue: Codable {
    var id: String
    var name: String
    var lat: Double
    var lng: Double
    var arrivalTitle: String
    var arrivalBody: String
    var reviewTitle: String
    var reviewBody: String
    var arrivalPath: String
    var reviewPath: String
    var reviewedRecently: Bool
}

struct VisitConfig: Codable {
    var settings = VisitSettings()
    var rules = VisitRules()
    var venues: [VisitVenue] = []
}

struct VenueMemory: Codable {
    var lastArrivalAlert: Double?   // ms since 1970
    var lastReviewPrompt: Double?
}

struct Stay: Codable {
    var enteredAt: Double            // ms
    var lat: Double
    var lng: Double
    var accuracy: Double
    var arrivalQueued = false
    var prevArrival: Double?
    var reviewQueued = false
    var prevReview: Double?
}

struct Visit: Codable {
    var venueId: String
    var at: Double
    var leftAt: Double?
    var lat: Double
    var lng: Double
    var accuracy: Double
}

// MARK: - Engine (lives for the whole process, also when iOS relaunches Gossoko for a region event)

final class VisitsEngine: NSObject, CLLocationManagerDelegate, UNUserNotificationCenterDelegate, NotificationHandlerProtocol {
    static let shared = VisitsEngine()

    static let category = "GOSSOKO_VISIT"
    static let muteAction = "GOSSOKO_MUTE"
    private let regionPrefix = "gv:"
    private let defaults = UserDefaults.standard
    private let manager = CLLocationManager()
    private var authWaiters: [(CLAuthorizationStatus) -> Void] = []
    weak var plugin: VisitsPlugin?

    private enum Key {
        static let config = "gossoko.visits.config"
        static let memory = "gossoko.visits.memory"
        static let muted = "gossoko.visits.muted"
        static let stays = "gossoko.visits.stays"
        static let visits = "gossoko.visits.queue"
        static let open = "gossoko.visits.open"
    }

    // MARK: storage
    private func load<T: Decodable>(_ key: String, _ fallback: T) -> T {
        guard let d = defaults.data(forKey: key), let v = try? JSONDecoder().decode(T.self, from: d) else { return fallback }
        return v
    }
    private func save<T: Encodable>(_ key: String, _ value: T) {
        if let d = try? JSONEncoder().encode(value) { defaults.set(d, forKey: key) }
    }
    var config: VisitConfig { get { load(Key.config, VisitConfig()) } set { save(Key.config, newValue) } }
    private var memory: [String: VenueMemory] { get { load(Key.memory, [:]) } set { save(Key.memory, newValue) } }
    var muted: Set<String> { get { Set(load(Key.muted, [String]())) } set { save(Key.muted, Array(newValue)) } }
    private var stays: [String: Stay] { get { load(Key.stays, [:]) } set { save(Key.stays, newValue) } }
    private var queue: [Visit] { get { load(Key.visits, []) } set { save(Key.visits, Array(newValue.suffix(200))) } }

    // MARK: boot (AppDelegate didFinishLaunching)
    func boot() {
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        let center = UNUserNotificationCenter.current()
        // Until the Capacitor bridge loads (or when iOS wakes Gossoko in the background without a UI),
        // this engine answers notification taps itself; the bridge's router then forwards local ones here.
        if center.delegate == nil { center.delegate = self }
        let mute = UNNotificationAction(identifier: Self.muteAction, title: "Don't ask for this place", options: [.destructive])
        center.setNotificationCategories([UNNotificationCategory(identifier: Self.category, actions: [mute], intentIdentifiers: [], options: [])])
        refreshMonitoring()
    }

    // MARK: permissions
    var authStatus: CLAuthorizationStatus { manager.authorizationStatus }

    func statusDict(_ done: @escaping ([String: Any]) -> Void) {
        let loc: String
        switch authStatus {
        case .authorizedAlways: loc = "always"
        case .authorizedWhenInUse: loc = "whenInUse"
        case .denied, .restricted: loc = "denied"
        default: loc = "none"
        }
        UNUserNotificationCenter.current().getNotificationSettings { s in
            let n: String
            switch s.authorizationStatus {
            case .authorized, .provisional, .ephemeral: n = "granted"
            case .denied: n = "denied"
            default: n = "prompt"
            }
            DispatchQueue.main.async { done(["location": loc, "notifications": n]) }
        }
    }

    /// Ask, then answer once the person has replied (or straight away when iOS shows nothing).
    func request(always: Bool, _ done: @escaping () -> Void) {
        let before = authStatus
        if always ? before == .authorizedAlways : before != .notDetermined { askNotifications(done); return }
        var finished = false
        let finish = { [weak self] in
            guard !finished else { return }
            finished = true
            self?.askNotifications(done)
        }
        authWaiters.append { _ in finish() }
        // A system dialog makes the app resign active; answer when it comes back.
        final class Watch { var resigned = false; var tokens: [NSObjectProtocol] = [] }
        let w = Watch()
        let nc = NotificationCenter.default
        let end = { w.tokens.forEach(nc.removeObserver); w.tokens = [] }
        w.tokens.append(nc.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { _ in w.resigned = true })
        w.tokens.append(nc.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
            if w.resigned { end(); finish() }
        })
        if always { manager.requestAlwaysAuthorization() } else { manager.requestWhenInUseAuthorization() }
        // iOS shows nothing when it has been asked before: answer with what we have.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { if !w.resigned { end(); finish() } }
    }

    private func askNotifications(_ done: @escaping () -> Void) {
        UNUserNotificationCenter.current().getNotificationSettings { s in
            if s.authorizationStatus == .notDetermined {
                UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in DispatchQueue.main.async(execute: done) }
            } else {
                DispatchQueue.main.async(execute: done)
            }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let w = authWaiters; authWaiters = []
        w.forEach { $0(manager.authorizationStatus) }
        refreshMonitoring()
    }

    // MARK: monitoring
    func configure(_ c: VisitConfig) {
        config = c
        // Forget stays at venues no longer sent (deleted/hidden).
        let ids = Set(c.venues.map(\.id))
        stays = stays.filter { ids.contains($0.key) }
        refreshMonitoring()
    }

    func stop() {
        var c = config; c.settings.enabled = false; config = c
        stays = [:]
        refreshMonitoring()
        UNUserNotificationCenter.current().getPendingNotificationRequests { reqs in
            let ids = reqs.map(\.identifier).filter { $0.hasPrefix("arr-") || $0.hasPrefix("rev-") }
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ids)
        }
    }

    var watching: Int { manager.monitoredRegions.filter { $0.identifier.hasPrefix(regionPrefix) }.count }

    func refreshMonitoring(near: CLLocation? = nil) {
        let c = config
        let on = c.settings.enabled && authStatus == .authorizedAlways && CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self)
        let ours = manager.monitoredRegions.filter { $0.identifier.hasPrefix(regionPrefix) }
        guard on else {
            ours.forEach { manager.stopMonitoring(for: $0) }
            manager.stopMonitoringSignificantLocationChanges()
            return
        }
        manager.startMonitoringSignificantLocationChanges()
        let here = near ?? manager.location
        var venues = c.venues
        if let here {
            venues.sort { here.distance(from: CLLocation(latitude: $0.lat, longitude: $0.lng)) < here.distance(from: CLLocation(latitude: $1.lat, longitude: $1.lng)) }
        }
        let want = Array(venues.prefix(Int(c.rules.maxRegionsIos)))
        let wantIds = Set(want.map { regionPrefix + $0.id })
        ours.filter { !wantIds.contains($0.identifier) }.forEach { manager.stopMonitoring(for: $0) }
        let have = Set(ours.map(\.identifier))
        let radius = min(c.rules.regionRadiusM, manager.maximumRegionMonitoringDistance)
        for v in want where !have.contains(regionPrefix + v.id) {
            let r = CLCircularRegion(center: CLLocationCoordinate2D(latitude: v.lat, longitude: v.lng), radius: radius, identifier: regionPrefix + v.id)
            r.notifyOnEntry = true; r.notifyOnExit = true
            manager.startMonitoring(for: r)
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let last = locations.last { refreshMonitoring(near: last) }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}
    func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {}

    // MARK: rules (mirror src/lib/visits/policy.ts)
    private func minutes(_ hhmm: String) -> Int? {
        let p = hhmm.split(separator: ":"); guard p.count == 2, let h = Int(p[0]), let m = Int(p[1]), h < 24, m < 60 else { return nil }
        return h * 60 + m
    }
    func inQuietHours(_ d: Date, _ s: VisitSettings) -> Bool {
        guard let f = minutes(s.quietFrom), let t = minutes(s.quietTo), f != t else { return false }
        let c = Calendar.current.dateComponents([.hour, .minute], from: d)
        let now = (c.hour ?? 0) * 60 + (c.minute ?? 0)
        return f < t ? (now >= f && now < t) : (now >= f || now < t)
    }
    private func reviewAllowed(_ at: Date, _ c: VisitConfig, _ v: VisitVenue, _ m: VenueMemory) -> Bool {
        let s = c.settings
        guard s.enabled, s.prompts, !muted.contains(v.id), !v.reviewedRecently, !inQuietHours(at, s) else { return false }
        if let last = m.lastReviewPrompt, at.timeIntervalSince1970 * 1000 - last < c.rules.reviewGapD * 86_400_000 { return false }
        return true
    }

    private func venue(for region: CLRegion) -> VisitVenue? {
        guard region.identifier.hasPrefix(regionPrefix) else { return nil }
        let id = String(region.identifier.dropFirst(regionPrefix.count))
        return config.venues.first { $0.id == id }
    }

    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard let v = venue(for: region) else { return }
        let c = config
        guard c.settings.enabled, stays[v.id] == nil else { return }
        let now = Date(); let nowMs = now.timeIntervalSince1970 * 1000
        let fix = manager.location.flatMap { abs($0.timestamp.timeIntervalSinceNow) < 300 ? $0 : nil }
        var stay = Stay(enteredAt: nowMs, lat: fix?.coordinate.latitude ?? v.lat, lng: fix?.coordinate.longitude ?? v.lng,
                        accuracy: fix?.horizontalAccuracy ?? c.rules.regionRadiusM)
        var mem = memory[v.id] ?? VenueMemory()
        let isMuted = muted.contains(v.id)
        let arrivalAt = now.addingTimeInterval(c.rules.arrivalDwellS)
        if c.settings.arrival, !isMuted, !inQuietHours(arrivalAt, c.settings),
           mem.lastArrivalAlert.map({ nowMs - $0 >= c.rules.arrivalGapH * 3_600_000 }) ?? true {
            schedule(id: "arr-\(v.id)", title: v.arrivalTitle, body: v.arrivalBody, path: v.arrivalPath, venueId: v.id, after: c.rules.arrivalDwellS)
            stay.arrivalQueued = true; stay.prevArrival = mem.lastArrivalAlert
            mem.lastArrivalAlert = arrivalAt.timeIntervalSince1970 * 1000
        }
        let reviewAt = now.addingTimeInterval(c.rules.reviewDwellS)
        if !isMuted, reviewAllowed(reviewAt, c, v, mem) {
            schedule(id: "rev-\(v.id)", title: v.reviewTitle, body: v.reviewBody, path: v.reviewPath, venueId: v.id, after: c.rules.reviewDwellS)
            stay.reviewQueued = true; stay.prevReview = mem.lastReviewPrompt
            mem.lastReviewPrompt = reviewAt.timeIntervalSince1970 * 1000
        }
        var all = memory; all[v.id] = mem; memory = all
        var s = stays; s[v.id] = stay; stays = s
    }

    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        guard let v = venue(for: region), let stay = stays[v.id] else { return }
        var s = stays; s[v.id] = nil; stays = s
        let c = config
        let now = Date(); let nowMs = now.timeIntervalSince1970 * 1000
        let stayedS = (nowMs - stay.enteredAt) / 1000
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["arr-\(v.id)", "rev-\(v.id)"])
        var mem = memory[v.id] ?? VenueMemory()
        // The arrival alert never went out: it doesn't count towards "once a day".
        if stay.arrivalQueued && stayedS < c.rules.arrivalDwellS { mem.lastArrivalAlert = stay.prevArrival }
        let reviewSent = stay.reviewQueued && stayedS >= c.rules.reviewDwellS
        if stay.reviewQueued && !reviewSent { mem.lastReviewPrompt = stay.prevReview }
        if !reviewSent, stayedS >= c.rules.reviewOnLeaveMinS, reviewAllowed(now, c, v, mem) {
            schedule(id: "rev-\(v.id)", title: v.reviewTitle, body: v.reviewBody, path: v.reviewPath, venueId: v.id, after: 1)
            mem.lastReviewPrompt = nowMs
        }
        var all = memory; all[v.id] = mem; memory = all
        if stayedS >= c.rules.arrivalDwellS {
            var q = queue
            q.append(Visit(venueId: v.id, at: stay.enteredAt, leftAt: nowMs, lat: stay.lat, lng: stay.lng, accuracy: stay.accuracy))
            queue = q
        }
    }

    private func schedule(id: String, title: String, body: String, path: String, venueId: String, after: TimeInterval) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.categoryIdentifier = Self.category
        content.threadIdentifier = "gossoko-visits"
        content.userInfo = ["gossokoPath": path, "gossokoVenue": venueId]
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, after), repeats: false)
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
    }

    // MARK: visits + taps handed to the web app
    func takeVisits() -> [Visit] { let q = queue; queue = []; return q }
    func takeOpen() -> String? { let p = defaults.string(forKey: Key.open); defaults.removeObject(forKey: Key.open); return p }

    func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        notification.request.content.categoryIdentifier == Self.category ? [.banner, .list, .sound] : []
    }

    func didReceive(response: UNNotificationResponse) {
        let info = response.notification.request.content.userInfo
        guard response.notification.request.content.categoryIdentifier == Self.category else { return }
        if response.actionIdentifier == Self.muteAction {
            if let id = info["gossokoVenue"] as? String { var m = muted; m.insert(id); muted = m }
            return
        }
        guard response.actionIdentifier == UNNotificationDefaultActionIdentifier, let path = info["gossokoPath"] as? String else { return }
        if let p = plugin, p.hasListeners("open") {
            p.notifyListeners("open", data: ["path": path])
        } else {
            defaults.set(path, forKey: Key.open)
        }
    }

    // Before the bridge exists (UNUserNotificationCenterDelegate).
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler(willPresent(notification: notification))
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        didReceive(response: response)
        completionHandler()
    }
}

// MARK: - Capacitor plugin "GossokoVisits"

@objc(VisitsPlugin)
public class VisitsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VisitsPlugin"
    public let jsName = "GossokoVisits"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestWhenInUse", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAlways", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeVisits", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeOpen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "mutedCount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearMuted", returnType: CAPPluginReturnPromise),
    ]
    private let engine = VisitsEngine.shared

    override public func load() {
        engine.plugin = self
        bridge?.notificationRouter.localNotificationHandler = engine
    }

    @objc func status(_ call: CAPPluginCall) { engine.statusDict { call.resolve($0) } }

    @objc func requestWhenInUse(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.engine.request(always: false) { self.engine.statusDict { call.resolve($0) } } }
    }

    @objc func requestAlways(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.engine.request(always: true) { self.engine.statusDict { call.resolve($0) } } }
    }

    @objc func configure(_ call: CAPPluginCall) {
        do {
            let raw: [String: Any] = [
                "settings": call.getObject("settings") ?? [:],
                "rules": call.getObject("rules") ?? [:],
                "venues": call.getArray("venues") ?? [],
            ]
            let data = try JSONSerialization.data(withJSONObject: raw)
            let c = try JSONDecoder().decode(VisitConfig.self, from: data)
            DispatchQueue.main.async {
                self.engine.configure(c)
                call.resolve(["watching": self.engine.watching])
            }
        } catch {
            call.reject("Bad visits config: \(error.localizedDescription)")
        }
    }

    @objc func stop(_ call: CAPPluginCall) { DispatchQueue.main.async { self.engine.stop(); call.resolve() } }

    @objc func takeVisits(_ call: CAPPluginCall) {
        let visits = engine.takeVisits().map { v -> [String: Any] in
            var d: [String: Any] = ["venueId": v.venueId, "at": v.at, "lat": v.lat, "lng": v.lng, "accuracy": v.accuracy]
            d["leftAt"] = v.leftAt ?? NSNull()
            return d
        }
        call.resolve(["visits": visits])
    }

    @objc func takeOpen(_ call: CAPPluginCall) {
        call.resolve(["path": engine.takeOpen() ?? NSNull()])
    }

    @objc func mutedCount(_ call: CAPPluginCall) { call.resolve(["count": engine.muted.count]) }
    @objc func clearMuted(_ call: CAPPluginCall) { engine.muted = []; call.resolve() }
}

/// The app's web view, with Gossoko's own plugin registered.
class GossokoBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(VisitsPlugin())
    }
}
