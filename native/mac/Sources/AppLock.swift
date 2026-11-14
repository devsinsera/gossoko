import SwiftUI
import LocalAuthentication

/// Touch ID at launch, opt-in from the app menu. Falls back to the Mac password
/// (.deviceOwnerAuthentication). Cancelling keeps the lock up until it passes.
@MainActor
final class AppLock: ObservableObject {
    @Published var locked = false
    @Published var message: String?

    func lockIfNeeded(enabled: Bool) {
        locked = enabled
        if enabled { Task { await unlock() } }
    }

    func unlock() async {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            message = error?.localizedDescription ?? "Touch ID isn't available on this Mac."
            locked = false   // nothing to check against: don't trap the person
            return
        }
        do {
            try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Open Gossoko")
            locked = false
            message = nil
        } catch {
            message = "Unlock to continue."
        }
    }
}
