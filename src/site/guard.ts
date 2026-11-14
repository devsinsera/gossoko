// The website inside a phone app: go to the app. The same check is inlined in <head> for hosts that
// allow inline scripts; the live site's Content-Security-Policy (script-src 'self') does not, so this
// file is the one that runs there.
import { isNativeShell, type ShellGlobals } from './native';

if (typeof window !== 'undefined' && isNativeShell(window as unknown as ShellGlobals)) {
  document.documentElement.className += ' in-app';
  window.location.replace('/gossoko/admin/');
}
