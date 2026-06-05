/** Mock Stripe Checkout session ids for creator gift purchases (demo / MOCK_CHECKOUT). */
export const CREATOR_GIFT_MOCK_SESSION_PREFIX = "mock_gift_" as const;

export function creatorGiftMockSessionId(purchaseId: string): string {
  return `${CREATOR_GIFT_MOCK_SESSION_PREFIX}${purchaseId}`;
}

export function parseCreatorGiftMockSessionId(sessionId: string): string | null {
  if (!sessionId.startsWith(CREATOR_GIFT_MOCK_SESSION_PREFIX)) return null;
  const id = sessionId.slice(CREATOR_GIFT_MOCK_SESSION_PREFIX.length);
  return id.length > 0 ? id : null;
}
