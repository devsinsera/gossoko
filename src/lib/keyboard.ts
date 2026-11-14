// Is the on-screen keyboard up? On Android the app shell shrinks the web view when the keyboard
// opens, so a fixed bottom tab bar rides up on top of it. We hide the bar while it's up.
import { useEffect, useState } from 'react';

const TEXT_INPUTS = new Set(['text', 'search', 'email', 'password', 'tel', 'url', 'number', 'date', 'time', 'datetime-local', 'month', 'week']);

/** True for an element that brings up the on-screen keyboard. */
export function isEditable(el: Element | null | undefined): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') return TEXT_INPUTS.has(((el as HTMLInputElement).type || 'text').toLowerCase());
  return (el as HTMLElement).isContentEditable === true;
}

export interface KeyboardSignals {
  /** A text field has focus. */
  editableFocused: boolean;
  /** A touch screen (phones/tablets): a focused field means the keyboard is up. */
  coarsePointer: boolean;
  /** visualViewport height now, and the tallest seen at this width. */
  viewportHeight: number;
  baselineHeight: number;
}

/**
 * The keyboard is taken as open when the visible viewport lost over a quarter of its height, or a
 * text field on a touch screen has focus and the viewport shrank at all noticeably (>10%). Focus alone
 * isn't enough: Search focuses its box on arrival, and Android doesn't always raise the keyboard for that.
 */
export function keyboardOpen(s: KeyboardSignals): boolean {
  if (s.baselineHeight <= 0) return false;
  const ratio = s.viewportHeight / s.baselineHeight;
  return ratio < 0.75 || (s.editableFocused && s.coarsePointer && ratio < 0.9);
}

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    const coarse = window.matchMedia?.('(pointer: coarse)');
    let width = window.innerWidth;
    let baseline = vv?.height ?? window.innerHeight;
    const check = () => {
      const h = vv?.height ?? window.innerHeight;
      if (window.innerWidth !== width) { width = window.innerWidth; baseline = h; }   // rotated
      const focused = isEditable(document.activeElement);
      if (!focused) baseline = Math.max(baseline, h);
      setOpen(keyboardOpen({ editableFocused: focused, coarsePointer: Boolean(coarse?.matches), viewportHeight: h, baselineHeight: baseline }));
    };
    // focusout fires before the next element gets focus: look again on the next frame.
    const later = () => requestAnimationFrame(check);
    vv?.addEventListener('resize', check);
    window.addEventListener('resize', check);
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', later);
    check();
    return () => {
      vv?.removeEventListener('resize', check);
      window.removeEventListener('resize', check);
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', later);
    };
  }, []);
  return open;
}
