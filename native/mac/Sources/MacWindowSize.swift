import SwiftUI
import AppKit

/// Every Sinsera Mac app opens its main window at 7/9 of the screen it opens on (width and height),
/// centred on that screen (Peta, 15 Nov 2026 — replaces the old fixed 1000×640). Applied once per
/// window, as it first appears, so it also wins over a frame macOS saved from the last run; after
/// that the window is the user's to move and resize. Attach with `.background(MacWindowSizer())`
/// on the root view of the main window only (players, sheets and child windows are not covered).
struct MacWindowSizer: NSViewRepresentable {
    func makeNSView(context: Context) -> SizerView { SizerView() }
    func updateNSView(_ nsView: SizerView, context: Context) {}

    final class SizerView: NSView {
        private var done = false
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            guard !done, let window else { return }
            done = true
            // One turn later: SwiftUI has finished its own first sizing (defaultSize / restored frame) by then.
            DispatchQueue.main.async { MacWindowSizer.apply(to: window) }
        }
    }

    /// 7/9 of the usable screen each way, centred in it. Whole points, so the window sits on pixel edges.
    static func frame(in visible: CGRect) -> CGRect {
        let w = (visible.width * 7 / 9).rounded(), h = (visible.height * 7 / 9).rounded()
        return CGRect(x: visible.minX + ((visible.width - w) / 2).rounded(),
                      y: visible.minY + ((visible.height - h) / 2).rounded(), width: w, height: h)
    }

    static func apply(to window: NSWindow) {
        guard !window.styleMask.contains(.fullScreen), let screen = window.screen ?? NSScreen.main else { return }
        window.setFrame(frame(in: screen.visibleFrame), display: true)
    }
}
