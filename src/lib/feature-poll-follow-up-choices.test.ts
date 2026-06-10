import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidFollowUpRadioAnswer,
  parseFollowUpChoicesText,
} from "@/lib/feature-poll-follow-up-choices";

describe("feature poll follow-up choices", () => {
  it("parses one choice per line and dedupes", () => {
    assert.deepEqual(parseFollowUpChoicesText("Hoodies\nMugs\n hoodies \n"), ["Hoodies", "Mugs"]);
  });

  it("validates radio answers against configured choices", () => {
    const choices = ["Hoodies", "Mugs"];
    assert.equal(isValidFollowUpRadioAnswer("Mugs", choices), true);
    assert.equal(isValidFollowUpRadioAnswer("Shirts", choices), false);
  });
});
