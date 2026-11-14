import SwiftUI
import WebKit

let gossokoBackground = Color(red: 10 / 255, green: 9 / 255, blue: 8 / 255)   // #0a0908, the site's background
let gossokoStart = URL(string: "https://sinsera.co/gossoko/")!

@MainActor
final class ShellModel: ObservableObject {
    @Published var failure: String?
    weak var webView: WKWebView?

    func retry() {
        failure = nil
        webView?.load(URLRequest(url: gossokoStart))
    }
}

struct ShellView: View {
    @ObservedObject var model: ShellModel
    @AppStorage("requireBiometrics") private var requireBiometrics = false
    @StateObject private var lock = AppLock()

    var body: some View {
        ZStack {
            gossokoBackground.ignoresSafeArea()
            WebShell(model: model).ignoresSafeArea()
            if lock.locked {
                gossokoBackground.ignoresSafeArea()
                VStack(spacing: 14) {
                    Text("Gossoko is locked")
                        .font(.headline)
                        .foregroundStyle(.white)
                    if let message = lock.message {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    Button("Unlock") { Task { await lock.unlock() } }
                        .keyboardShortcut(.defaultAction)
                }
                .padding(32)
            }
            if let failure = model.failure {
                VStack(spacing: 12) {
                    Text("Can't reach Gossoko")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text(failure)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Try again") { model.retry() }
                        .keyboardShortcut(.defaultAction)
                }
                .padding(32)
                .frame(maxWidth: 420)
            }
        }
        .containerBackground(gossokoBackground, for: .window)
        .onAppear { lock.lockIfNeeded(enabled: requireBiometrics) }
    }
}
