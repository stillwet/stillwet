import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_ANNOUNCEMENT_KIND,
  ADMIN_ANNOUNCEMENT_MAX_BODY_CHARS,
  chunkRows,
  normalizeAdminAnnouncementBody,
  validateAdminAnnouncementBody,
} from "@/lib/admin-announcements";

describe("admin announcements", () => {
  it("uses the stable shop notice kind", () => {
    assert.equal(ADMIN_ANNOUNCEMENT_KIND, "admin_announcement");
  });

  it("normalizes line endings and trims outer whitespace", () => {
    assert.equal(normalizeAdminAnnouncementBody("  hello\r\nworld  "), "hello\nworld");
  });

  it("validates empty and long announcements", () => {
    assert.deepEqual(validateAdminAnnouncementBody("   "), {
      ok: false,
      error: "Announcement message is required.",
    });
    const tooLong = "x".repeat(ADMIN_ANNOUNCEMENT_MAX_BODY_CHARS + 1);
    assert.equal(validateAdminAnnouncementBody(tooLong).ok, false);
    assert.deepEqual(validateAdminAnnouncementBody("Shops: hello"), {
      ok: true,
      body: "Shops: hello",
    });
  });

  it("chunks bulk create rows", () => {
    assert.deepEqual(chunkRows([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  });
});
