import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_INBOX_FORWARD_SUBJECT_PREFIX,
  adminInboxForwardToEmail,
  formatAdminInboxForwardBody,
  formatAdminInboxForwardSubject,
  forwardInboundEmailToGmail,
} from "@/lib/admin-inbox-forward-email";

const sampleInput = {
  fromAddress: "Jane Buyer <jane@example.com>",
  toAddress: "info@stillwet.com",
  subject: "Question about my order",
  textBody: "Hello, where is my shirt?",
  htmlBody: null as string | null,
  receivedAt: new Date("2026-06-05T12:00:00.000Z"),
};

test("formatAdminInboxForwardSubject prefixes original subject", () => {
  assert.equal(
    formatAdminInboxForwardSubject("Question about my order"),
    `${ADMIN_INBOX_FORWARD_SUBJECT_PREFIX}Question about my order`,
  );
});

test("formatAdminInboxForwardSubject handles empty subject", () => {
  assert.equal(
    formatAdminInboxForwardSubject("  "),
    `${ADMIN_INBOX_FORWARD_SUBJECT_PREFIX}(no subject)`,
  );
});

test("formatAdminInboxForwardBody includes headers and text body", () => {
  const body = formatAdminInboxForwardBody(sampleInput);
  assert.match(body, /From: Jane Buyer <jane@example.com>/);
  assert.match(body, /To: info@stillwet.com/);
  assert.match(body, /Subject: Question about my order/);
  assert.match(body, /Received: 2026-06-05T12:00:00.000Z/);
  assert.match(body, /Hello, where is my shirt\?/);
});

test("formatAdminInboxForwardBody falls back to stripped HTML", () => {
  const body = formatAdminInboxForwardBody({
    ...sampleInput,
    textBody: null,
    htmlBody: "<p>Hi <strong>there</strong></p>",
  });
  assert.match(body, /Hi there/);
});

test("formatAdminInboxForwardBody notes missing body", () => {
  const body = formatAdminInboxForwardBody({
    ...sampleInput,
    textBody: null,
    htmlBody: null,
  });
  assert.match(body, /\(no text body\)/);
});

test("adminInboxForwardToEmail returns null when unset", () => {
  const prev = process.env.ADMIN_INBOX_FORWARD_TO_EMAIL;
  delete process.env.ADMIN_INBOX_FORWARD_TO_EMAIL;
  try {
    assert.equal(adminInboxForwardToEmail(), null);
  } finally {
    if (prev !== undefined) process.env.ADMIN_INBOX_FORWARD_TO_EMAIL = prev;
  }
});

test("forwardInboundEmailToGmail skips when ADMIN_INBOX_FORWARD_TO_EMAIL unset", async () => {
  const prevForward = process.env.ADMIN_INBOX_FORWARD_TO_EMAIL;
  delete process.env.ADMIN_INBOX_FORWARD_TO_EMAIL;
  try {
    const result = await forwardInboundEmailToGmail(sampleInput);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.skipped, true);
      assert.match(result.reason, /ADMIN_INBOX_FORWARD_TO_EMAIL/);
    }
  } finally {
    if (prevForward !== undefined) {
      process.env.ADMIN_INBOX_FORWARD_TO_EMAIL = prevForward;
    }
  }
});
