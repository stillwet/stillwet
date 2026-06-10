import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FeaturePollOptionStatus, FeaturePollVoterKind } from "@/generated/prisma/enums";
import {
  buildDonorFeaturePollVoteAttribution,
  buildShopFeaturePollVoteAttribution,
  donorCanVoteOnFeaturePollQuestion,
  normalizeFeaturePollDonorEmail,
  pickSupportTipIdForDonorVote,
  shopCanVoteOnFeaturePollQuestion,
} from "@/lib/feature-poll-vote-eligibility";

describe("shopCanVoteOnFeaturePollQuestion", () => {
  const questionId = "q1";
  const shopId = "shop-1";

  it("allows vote when shop has no active vote on the question", () => {
    assert.equal(
      shopCanVoteOnFeaturePollQuestion({
        questionId,
        shopId,
        existingVotes: [],
      }),
      true,
    );
  });

  it("blocks vote when shop has vote on active option for same question", () => {
    assert.equal(
      shopCanVoteOnFeaturePollQuestion({
        questionId,
        shopId,
        existingVotes: [
          {
            questionId,
            option: { id: "opt-1", status: FeaturePollOptionStatus.active },
          },
        ],
      }),
      false,
    );
  });

  it("allows vote after option marked completed", () => {
    assert.equal(
      shopCanVoteOnFeaturePollQuestion({
        questionId,
        shopId,
        existingVotes: [
          {
            questionId,
            option: { id: "opt-1", status: FeaturePollOptionStatus.completed },
          },
        ],
      }),
      true,
    );
  });

  it("allows vote after option marked removed", () => {
    assert.equal(
      shopCanVoteOnFeaturePollQuestion({
        questionId,
        shopId,
        existingVotes: [
          {
            questionId,
            option: { id: "opt-1", status: FeaturePollOptionStatus.removed },
          },
        ],
      }),
      true,
    );
  });

  it("does not block vote on other questions", () => {
    assert.equal(
      shopCanVoteOnFeaturePollQuestion({
        questionId: "q2",
        shopId,
        existingVotes: [
          {
            questionId: "q1",
            option: { id: "opt-1", status: FeaturePollOptionStatus.active },
          },
        ],
      }),
      true,
    );
  });
});

describe("donorCanVoteOnFeaturePollQuestion", () => {
  it("allows vote when an unused paid tip exists", () => {
    assert.equal(
      donorCanVoteOnFeaturePollQuestion({
        paidTipIds: ["tip-a", "tip-b"],
        usedTipIds: ["tip-a"],
      }),
      true,
    );
  });

  it("blocks vote when all paid tips were used", () => {
    assert.equal(
      donorCanVoteOnFeaturePollQuestion({
        paidTipIds: ["tip-a"],
        usedTipIds: ["tip-a"],
      }),
      false,
    );
  });

  it("blocks vote on another question when the only tip was used elsewhere", () => {
    assert.equal(
      donorCanVoteOnFeaturePollQuestion({
        paidTipIds: ["tip-a"],
        usedTipIds: ["tip-a"],
      }),
      false,
    );
  });

  it("allows one more vote when a second paid tip is unused", () => {
    assert.equal(
      donorCanVoteOnFeaturePollQuestion({
        paidTipIds: ["tip-a", "tip-b"],
        usedTipIds: ["tip-a"],
      }),
      true,
    );
  });
});

describe("pickSupportTipIdForDonorVote", () => {
  const usedTipIds = ["tip-a"];

  it("prefers the active session tip when it is unused", () => {
    assert.equal(
      pickSupportTipIdForDonorVote({
        paidTipIds: ["tip-a", "tip-b"],
        usedTipIds,
        preferredTipId: "tip-b",
      }),
      "tip-b",
    );
  });

  it("falls back to oldest unused tip when preferred tip is already spent", () => {
    assert.equal(
      pickSupportTipIdForDonorVote({
        paidTipIds: ["tip-a", "tip-b"],
        usedTipIds,
        preferredTipId: "tip-a",
      }),
      "tip-b",
    );
  });
});

describe("feature poll vote attribution", () => {
  it("builds shop attribution with display name", () => {
    const a = buildShopFeaturePollVoteAttribution({
      shopId: "s1",
      shopDisplayName: "Still Wet",
    });
    assert.equal(a.voterKind, FeaturePollVoterKind.shop);
    assert.equal(a.shopId, "s1");
    assert.equal(a.shopDisplayName, "Still Wet");
    assert.equal(a.donorEmail, null);
  });

  it("builds donor attribution with normalized email", () => {
    const a = buildDonorFeaturePollVoteAttribution({
      donorEmail: "Donor@Example.com",
      supportTipId: "tip-1",
    });
    assert.equal(a.voterKind, FeaturePollVoterKind.donor);
    assert.equal(a.donorEmail, "donor@example.com");
    assert.equal(a.supportTipId, "tip-1");
    assert.equal(a.shopDisplayName, null);
  });

  it("normalizes donor email", () => {
    assert.equal(normalizeFeaturePollDonorEmail("  A@B.COM "), "a@b.com");
  });
});
