import SwiftUI
import WebKit

/// Gossoko's Mac app: a native window around the live site. Sign-in, Remember me and
/// Password AutoFill are the website's own, kept in the app's persistent WebKit store.
@main
struct GossokoApp: App {
    @StateObject private var shell = ShellModel()
    @AppStorage("requireBiometrics") private var requireBiometrics = false

    var body: some Scene {
        WindowGroup {
            ShellView(model: shell)
                .environmentObject(shell)
                .frame(minWidth: 640, minHeight: 480)   // minimum stays small (rule: ≤ 640×480)
                .background(MacWindowSizer())           // opens at 7/9 of the screen, centred (MacWindowSize.swift)
        }
        .defaultSize(width: 1000, height: 640)           // fallback only: MacWindowSizer sets the real opening size
        .windowStyle(.hiddenTitleBar)                     // transparent top bar: the page runs up behind the buttons
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandGroup(after: .appSettings) {
                Toggle("Require Touch ID at Launch", isOn: $requireBiometrics)
            }
            CommandGroup(after: .sidebar) {
                Button("Reload") { shell.webView?.reload() }
                    .keyboardShortcut("r", modifiers: [.command])
            }
        }
    }
}
