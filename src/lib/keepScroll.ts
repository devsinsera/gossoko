// Keep the page where it is across an async action that re-renders it (e.g. "Check a code" on the
// owner dashboard: the check refreshes every loader on the page, and on the phone the page could
// end up back at the top). Restores the scroll position for a short while after the action.

type Win = Pick<Window, 'scrollY' | 'scrollTo' | 'requestAnimationFrame'> & { setTimeout: (f: () => void, ms: number) => unknown };

export async function keepScroll<T>(action: () => Promise<T>, win: Win = window, settleMs = 1500): Promise<T> {
  const y = win.scrollY;
  const restore = () => { if (Math.abs(win.scrollY - y) > 2) win.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }); };
  try {
    return await action();
  } finally {
    // Right after the result renders, then again once any refetches it triggered have landed.
    win.requestAnimationFrame(restore);
    for (const ms of [100, 400, settleMs]) win.setTimeout(restore, ms);
  }
}
