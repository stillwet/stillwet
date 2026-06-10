"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { FeaturePollOptionFollowUpKind } from "@/generated/prisma/enums";
import type { DonorFeaturePollContext } from "@/lib/feature-poll-donor-context";
import { featurePollDonorViewPath } from "@/lib/feature-poll-path";
import type {
  FeaturePollQuestionRow,
  FeaturePollShopVoteRow,
} from "@/lib/feature-poll-types";
import { FEATURE_POLL_MIGRATION_ID } from "@/lib/feature-poll-types";
import type { WorldCountryOption } from "@/lib/world-countries";

type VoterState =
  | { kind: "shop"; displayName: string }
  | { kind: "donor"; email: string }
  | { kind: "none" };

function optionNeedsFollowUp(option: FeaturePollQuestionRow["options"][number]): boolean {
  if (option.followUpKind === FeaturePollOptionFollowUpKind.none) return false;
  if (!option.followUpPrompt?.trim()) return false;
  if (option.followUpKind === FeaturePollOptionFollowUpKind.radio_select) {
    return option.followUpChoices.length >= 2;
  }
  return true;
}

function VoteSummaryBlock({ vote }: { vote: FeaturePollShopVoteRow }) {
  return (
    <div className="mt-2 space-y-2 text-sm text-zinc-400">
      <p>
        You voted for{" "}
        <span className="text-zinc-200">&ldquo;{vote.optionLabel}&rdquo;</span>.
      </p>
      {vote.followUpKind !== FeaturePollOptionFollowUpKind.none &&
      vote.followUpPrompt?.trim() &&
      vote.followUpAnswerDisplay ? (
        <div className="ml-6 border-l border-zinc-800/70 py-1 pl-4">
          <p className="text-zinc-300">{vote.followUpPrompt.trim()}</p>
          <p className="mt-1 text-zinc-200">{vote.followUpAnswerDisplay}</p>
        </div>
      ) : null}
    </div>
  );
}

export function FeaturePollVoteForm(props: {
  view: "shop" | "donor";
  questions: FeaturePollQuestionRow[];
  shopVotes: FeaturePollShopVoteRow[];
  donorContext: DonorFeaturePollContext | null;
  voter: VoterState;
  shopLoggedIn?: boolean;
  countryOptions: WorldCountryOption[];
  migrationRequired?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});

  const shopVoteByQuestion = new Map(props.shopVotes.map((v) => [v.questionId, v]));
  const donorVoteByQuestion = new Map(
    (props.donorContext?.latestVoteByQuestion ?? []).map((v) => [v.questionId, v]),
  );

  const selectedOptionForQuestion = useCallback(
    (question: FeaturePollQuestionRow) => {
      const optionId = selection[question.id];
      if (!optionId) return null;
      return question.options.find((o) => o.id === optionId) ?? null;
    },
    [selection],
  );

  const followUpRequiredForQuestion = useCallback(
    (question: FeaturePollQuestionRow) => {
      const option = selectedOptionForQuestion(question);
      if (option == null || option.followUpKind === FeaturePollOptionFollowUpKind.none) {
        return false;
      }
      if (!option.followUpPrompt?.trim()) return false;
      if (option.followUpKind === FeaturePollOptionFollowUpKind.radio_select) {
        return option.followUpChoices.length >= 2;
      }
      return true;
    },
    [selectedOptionForQuestion],
  );

  const canSubmitQuestion = useCallback(
    (question: FeaturePollQuestionRow) => {
      if (!selection[question.id]) return false;
      if (!followUpRequiredForQuestion(question)) return true;
      return Boolean(followUpAnswers[question.id]?.trim());
    },
    [followUpAnswers, followUpRequiredForQuestion, selection],
  );

  const submitVote = useCallback(
    (questionId: string) => {
      const optionId = selection[questionId];
      if (!optionId || pending) return;
      const question = props.questions.find((q) => q.id === questionId);
      if (!question || !canSubmitQuestion(question)) return;

      setMessage(null);
      startTransition(async () => {
        try {
          const body: {
            questionId: string;
            optionId: string;
            followUpAnswer?: string;
            voteAs: "shop" | "donor";
          } = { questionId, optionId, voteAs: props.view };
          const followUpAnswer = followUpAnswers[questionId]?.trim();
          if (followUpRequiredForQuestion(question) && followUpAnswer) {
            body.followUpAnswer = followUpAnswer;
          }

          const r = await fetch("/api/feature-poll/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
          if (!r.ok || !json.ok) {
            setMessage({ tone: "err", text: json.error ?? "Could not submit vote." });
            return;
          }
          setMessage({ tone: "ok", text: "Vote recorded — thank you." });
          setSelection((prev) => {
            const next = { ...prev };
            delete next[questionId];
            return next;
          });
          setFollowUpAnswers((prev) => {
            const next = { ...prev };
            delete next[questionId];
            return next;
          });
          router.refresh();
        } catch {
          setMessage({ tone: "err", text: "Network error — try again." });
        }
      });
    },
    [
      canSubmitQuestion,
      followUpAnswers,
      followUpRequiredForQuestion,
      pending,
      props.questions,
      props.view,
      router,
      selection,
    ],
  );

  if (props.migrationRequired) {
    return (
      <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm leading-relaxed text-amber-200/90">
        Feature votes are not available on this database yet. Run{" "}
        <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
          npx prisma migrate deploy
        </code>{" "}
        (migration <code className="font-mono text-amber-100/90">{FEATURE_POLL_MIGRATION_ID}</code>
        ), then reload.
      </p>
    );
  }

  if (props.questions.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-zinc-400">
        No active poll questions right now. Check back later.
      </p>
    );
  }

  const isShopView = props.view === "shop";
  const isDonorView = props.view === "donor";

  return (
    <div className="space-y-8 text-left">
      {props.voter.kind === "none" ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm leading-relaxed text-zinc-400">
          To vote,{" "}
          <Link href="/dashboard/login" className="text-blue-400/90 hover:underline">
            sign in as a shop owner
          </Link>{" "}
          or{" "}
          <Link href="/about" className="text-blue-400/90 hover:underline">
            support the site
          </Link>{" "}
          (donors can vote from the thank-you page after checkout).
        </p>
      ) : isShopView && props.voter.kind === "shop" && props.shopVotes.length === 0 ? (
        <p className="text-sm text-zinc-400">
          Voting as <span className="text-zinc-200">{props.voter.displayName}</span>. One vote per
          question until your choice is completed.
        </p>
      ) : isDonorView && props.voter.kind === "donor" ? (
        <p className="text-sm text-zinc-400">
          Voting as a site supporter — one vote per donation.
        </p>
      ) : isShopView && props.shopLoggedIn && props.voter.kind === "donor" ? (
        <p className="text-sm text-zinc-400">
          Sign in as your shop to vote on the shop tab, or{" "}
          <Link href={featurePollDonorViewPath()} className="text-blue-400/90 hover:underline">
            switch to supporter voting
          </Link>{" "}
          after a site donation.
        </p>
      ) : null}

      {message ? (
        <p
          role={message.tone === "err" ? "alert" : "status"}
          className={`rounded-lg border px-3 py-2 text-xs ${
            message.tone === "err"
              ? "border-amber-900/50 bg-amber-950/25 text-amber-200/90"
              : "border-blue-900/40 bg-blue-950/20 text-blue-200/90"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {props.questions.map((q) => {
        const shopExisting = shopVoteByQuestion.get(q.id);
        const donorExisting = donorVoteByQuestion.get(q.id);
        const shopBlocked = isShopView && props.voter.kind === "shop" && Boolean(shopExisting);
        const donorCanVote = props.donorContext?.canVoteByQuestionId[q.id] ?? false;
        const donorBlocked = isDonorView && props.voter.kind === "donor" && !donorCanVote;
        const formBlocked = shopBlocked || donorBlocked;

        return (
          <section key={q.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 sm:p-5">
            <h2 className="text-base font-medium text-zinc-100">{q.prompt}</h2>
            {shopBlocked && shopExisting ? (
              <>
                <VoteSummaryBlock vote={shopExisting} />
                <p className="mt-2 text-sm text-zinc-400">
                  You can vote again when that item is completed.
                </p>
              </>
            ) : donorBlocked ? (
              <>
                {donorExisting ? <VoteSummaryBlock vote={donorExisting} /> : null}
                <p className="mt-2 text-sm text-zinc-400">
                  You already used your donation vote. Support the site again for another vote.
                </p>
              </>
            ) : (
              <>
                <ul className="mt-4 space-y-2">
                  {q.options.map((opt) => {
                    const questionSelection = selection[q.id];
                    const isSelected = questionSelection === opt.id;
                    const isDimmed = Boolean(questionSelection) && !isSelected;
                    const showOptionFollowUp =
                      isSelected && !formBlocked && optionNeedsFollowUp(opt);

                    return (
                      <li key={opt.id}>
                        <label
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-[opacity,border-color,background-color] ${
                            isSelected
                              ? "border-zinc-600 bg-zinc-900/50"
                              : isDimmed
                                ? "border-zinc-800/50 opacity-45 hover:border-zinc-700 hover:opacity-65"
                                : "border-zinc-800/80 hover:border-zinc-700"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`poll-${q.id}`}
                            value={opt.id}
                            checked={isSelected}
                            disabled={props.voter.kind === "none" || pending}
                            onChange={() => {
                              setSelection((prev) => ({ ...prev, [q.id]: opt.id }));
                              setFollowUpAnswers((prev) => {
                                const next = { ...prev };
                                delete next[q.id];
                                return next;
                              });
                            }}
                            className="mt-0.5 border-zinc-600 bg-zinc-900"
                          />
                          <span
                            className={`text-sm ${isDimmed ? "text-zinc-500" : "text-zinc-200"}`}
                          >
                            {opt.label}
                          </span>
                        </label>
                        {showOptionFollowUp ? (
                          <div className="mt-2 ml-6 border-l border-zinc-800/70 py-1 pl-4 pr-1">
                            <p className="text-sm text-zinc-300">{opt.followUpPrompt}</p>
                            {opt.followUpKind === FeaturePollOptionFollowUpKind.country_select ? (
                              <select
                                value={followUpAnswers[q.id] ?? ""}
                                disabled={props.voter.kind === "none" || pending}
                                onChange={(e) =>
                                  setFollowUpAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: e.target.value,
                                  }))
                                }
                                className="mt-2 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                              >
                                <option value="">Select a country…</option>
                                {props.countryOptions.map((country) => (
                                  <option key={country.code} value={country.code}>
                                    {country.label}
                                  </option>
                                ))}
                              </select>
                            ) : opt.followUpKind === FeaturePollOptionFollowUpKind.radio_select ? (
                              <ul className="mt-3 space-y-2">
                                {opt.followUpChoices.map((choice) => (
                                  <li key={choice}>
                                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800/80 px-3 py-2.5 hover:border-zinc-700">
                                      <input
                                        type="radio"
                                        name={`follow-up-${q.id}`}
                                        value={choice}
                                        checked={followUpAnswers[q.id] === choice}
                                        disabled={props.voter.kind === "none" || pending}
                                        onChange={() =>
                                          setFollowUpAnswers((prev) => ({
                                            ...prev,
                                            [q.id]: choice,
                                          }))
                                        }
                                        className="mt-0.5 border-zinc-600 bg-zinc-900"
                                      />
                                      <span className="text-sm text-zinc-200">{choice}</span>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <input
                                type="text"
                                value={followUpAnswers[q.id] ?? ""}
                                maxLength={500}
                                disabled={props.voter.kind === "none" || pending}
                                onChange={(e) =>
                                  setFollowUpAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: e.target.value,
                                  }))
                                }
                                className="mt-2 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                              />
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                <button
                  type="button"
                  disabled={props.voter.kind === "none" || pending || !canSubmitQuestion(q)}
                  onClick={() => submitVote(q.id)}
                  className="mt-4 rounded-xl bg-blue-900/90 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Submitting…" : "Submit vote"}
                </button>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
