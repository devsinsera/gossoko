// Sinsera sign-in rule, applied to the phone apps' Keychain plugin (@capgo/capacitor-native-biometric, iOS):
// a Remember-me sign-in is stored as kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly, so it can be read when the
// app is started while the phone is locked (a push, background GPS) — the plugin's default is "when unlocked",
// which made a locked-phone launch look signed out. The item never leaves this device (no iCloud Keychain, no backup).
//
// The plugin is compiled from node_modules (ios/App/CapApp-SPM/Package.swift), so the source is patched in place:
// run by `npm install` (postinstall) and before every `cap sync` (npm run sync). Safe to run again. If the plugin's
// code has changed so the patch no longer fits, this FAILS — nothing is built with an unpatched Keychain by accident.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(new URL("../node_modules/@capgo/capacitor-native-biometric/ios/Sources/NativeBiometricPlugin/NativeBiometricPlugin.swift", import.meta.url));
if (!existsSync(file)) { console.error(`patch-plugins: ${file} is missing — run npm install in native/ first`); process.exit(1); }

const MARK = "kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly";   // Gossoko patch
let src = readFileSync(file, "utf8");
if (src.includes(MARK)) { console.log("patch-plugins: Keychain accessibility already patched"); process.exit(0); }

const edits = [
  // A new item: readable after the first unlock, on this device only.
  [`                                    kSecAttrServer as String: server,
                                    kSecValueData as String: passwordData]

        let status = SecItemAdd(query as CFDictionary, nil)`,
   `                                    kSecAttrServer as String: server,
                                    kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,   // Gossoko patch (sign-in rule)
                                    kSecValueData as String: passwordData]

        let status = SecItemAdd(query as CFDictionary, nil)`],
  // An existing item (saved before the patch) gets the same rule the next time it is saved.
  [`        let attributes: [String: Any] = [kSecAttrAccount as String: account,
                                         kSecValueData as String: password]`,
   `        let attributes: [String: Any] = [kSecAttrAccount as String: account,
                                         kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,   // Gossoko patch (sign-in rule)
                                         kSecValueData as String: password]`],
];
for (const [from, to] of edits) {
  if (src.split(from).length !== 2) { console.error("patch-plugins: the biometric plugin's Keychain code has changed — update native/scripts/patch-plugins.mjs (the app must not be built without this patch)"); process.exit(1); }
  src = src.replace(from, to);
}
writeFileSync(file, src);
console.log("patch-plugins: Keychain sign-in is now readable after the first unlock (this device only)");
