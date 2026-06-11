const { spawnSync } = require("child_process");
const path = require("path");

const tests = [
  "src/lib/plain-text-no-urls.test.ts",
  "src/lib/checkout-tip.test.ts",
  "src/lib/storefront-buyer-checkout.test.ts",
  "src/lib/resend-shop-from.test.ts",
  "src/lib/admin-inbox-forward-email.test.ts",
  "src/lib/listing-artwork-print-area.test.ts",
  "src/lib/listing-artwork-source-tier.test.ts",
  "src/lib/listing-artwork-crop-viewport.test.ts",
  "src/lib/listing-supplement-pending-url.test.ts",
  "src/lib/listing-credit-packs.test.ts",
  "src/lib/creator-gift-codes.test.ts",
  "src/lib/creator-gift-notices.test.ts",
  "src/lib/creator-gift-code-expiration.test.ts",
  "src/lib/admin-announcements.test.ts",
  "src/lib/admin-platform-sales-stripe-fee.test.ts",
  "src/lib/order-proceeds-splits.test.ts",
  "src/lib/feature-poll-vote-eligibility.test.ts",
  "src/lib/world-countries.test.ts",
  "src/lib/shop-inactivity-policy.test.ts",
  "src/lib/promotion-placement-ui-pure.test.ts",
  "src/lib/stripe-connect-account-prefill.test.ts",
  "src/lib/stripe-connect-account-status.test.ts",
  "src/lib/stripe-connect-balance.test.ts",
  "src/lib/site-email-logo-html.test.ts",
  "src/lib/site-email-logo-url.test.ts",
  "src/lib/shop-password-changed-email-html.test.ts",
  "src/lib/pacific-calendar-date-key.test.ts",
  "src/lib/shop-new-sale-notice.test.ts",
  "src/lib/buyer-order-number.test.ts",
  "src/lib/order-return-claim-limits.test.ts",
  "src/lib/order-return-claim-r2.test.ts",
  "src/lib/printify-order-label.test.ts",
  "src/lib/google-merchant/listing-product-input.test.ts",
  "src/lib/shop-setup-image-listing-artwork.test.ts",
  "src/lib/listing-artwork-staging-chunks.test.ts",
  "src/lib/listing-artwork-server-crop.test.ts",
  "src/lib/listing-artwork-crop-math.test.ts",
  "src/lib/listing-artwork-v2/transform.test.ts",
  "src/lib/listing-artwork-v2/limits.test.ts",
  "src/lib/listing-request-review-limit.test.ts",
  "src/lib/admin-catalog-upload-policy.test.ts",
  "src/lib/admin-catalog-canvas-presentation.test.ts",
  "src/lib/baseline-listing-catalog-sync.test.ts",
];

const cwd = path.join(__dirname, "..");
const result = spawnSync("npx", ["tsx", "--test", ...tests], {
  cwd,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
