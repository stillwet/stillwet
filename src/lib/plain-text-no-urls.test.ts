import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  plainTextContainsUrlLike,
  plainTextNoUrlsValidationError,
} from "@/lib/plain-text-no-urls";

describe("plainTextContainsUrlLike", () => {
  it("allows plain greetings", () => {
    assert.equal(plainTextContainsUrlLike("Thanks for visiting my shop!"), false);
    assert.equal(plainTextContainsUrlLike(""), false);
  });

  it("detects http(s), www, bare domains, and markdown links", () => {
    assert.equal(plainTextContainsUrlLike("see https://evil.com"), true);
    assert.equal(plainTextContainsUrlLike("visit www.example.com"), true);
    assert.equal(plainTextContainsUrlLike("h t t p s : / / bad.io"), true);
    assert.equal(plainTextContainsUrlLike("DM me at spam.net"), true);
    assert.equal(plainTextContainsUrlLike("[click](https://x.com)"), true);
    assert.equal(plainTextContainsUrlLike("//cdn.example.com/x"), true);
  });

  it("returns validation message only when needed", () => {
    assert.equal(plainTextNoUrlsValidationError("hello"), null);
    assert.match(plainTextNoUrlsValidationError("go to foo.com") ?? "", /not allowed/i);
  });
});
