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
                .frame(minWidth: 640, minHeight: 480)   // never above the 1000×640 first-launch size
        }
        .defaultSize(width: 1000, height: 640)           // every Sinsera Mac app opens at 1000×640
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
