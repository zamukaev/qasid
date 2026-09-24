/**
 * A share link that arrived before the user could be sent to it.
 *
 * Module-level rather than React state (the same pattern as
 * `hooks/useNasheedLimit`): the auth gate in `app/index.tsx` and the share
 * route in `app/t/index.tsx` run in different trees, and the value has to
 * survive the sign-in and email-verification screens in between.
 */
let pendingHref: string | null = null;

export function setPendingShare(href: string): void {
  pendingHref = href;
}

/** Returns the stashed link and forgets it, so it is replayed exactly once. */
export function takePendingShare(): string | null {
  const href = pendingHref;
  pendingHref = null;
  return href;
}

export function hasPendingShare(): boolean {
  return pendingHref !== null;
}
