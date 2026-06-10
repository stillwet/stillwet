"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import {
  adminCreateFeaturePollOptionForm,
  adminCreateFeaturePollQuestionForm,
  adminDeleteFeaturePollOptionForm,
  adminDeleteFeaturePollQuestionForm,
  adminMoveFeaturePollOptionForm,
  adminMoveFeaturePollQuestionForm,
  adminUpdateFeaturePollOptionForm,
  adminUpdateFeaturePollQuestionForm,
} from "@/actions/admin-feature-poll";
import type { AdminFeaturePollQuestionRow } from "@/lib/admin-feature-poll-load";
import {
  FEATURE_POLL_FOLLOWUP_MIGRATION_ID,
  FEATURE_POLL_MIGRATION_ID,
  FEATURE_POLL_RADIO_FOLLOWUP_MIGRATION_ID,
} from "@/lib/feature-poll-types";
import { FeaturePollOptionFollowUpKind, FeaturePollOptionStatus, FeaturePollVoterKind } from "@/generated/prisma/enums";
import type { WorldCountryOption } from "@/lib/world-countries";
import { serializeFollowUpChoicesText } from "@/lib/feature-poll-follow-up-choices";

const DEFAULT_COUNTRY_FOLLOW_UP_PROMPT = "Which country is your top priority?";

function followUpPromptForKind(
  kind: FeaturePollOptionFollowUpKind,
  savedPrompt: string | null,
): string {
  const trimmed = savedPrompt?.trim() ?? "";
  if (kind === FeaturePollOptionFollowUpKind.country_select) {
    return trimmed || DEFAULT_COUNTRY_FOLLOW_UP_PROMPT;
  }
  return trimmed;
}

const SAVED_LABELS: Record<string, string> = {
  question_added: "Question added.",
  question_updated: "Question updated.",
  question_deleted: "Question deleted.",
  option_added: "Option added.",
  option_updated: "Option updated.",
  option_deleted: "Option deleted.",
  reordered: "Order updated.",
};

function serializeForm(form: HTMLFormElement): string {
  const parts: string[] = [];
  const elements = form.querySelectorAll("input, textarea, select");
  elements.forEach((el) => {
    const e = el as HTMLInputElement;
    if (!e.name || e.type === "submit" || e.type === "button") return;
    if (e.type === "checkbox" || e.type === "radio") {
      parts.push(`${e.name}:${e.checked ? "1" : "0"}`);
    } else {
      parts.push(`${e.name}:${e.value}`);
    }
  });
  return parts.join("\u001f");
}

function AdminFeaturePollDirtySaveButton(props: { label: string }) {
  const dirty = useContext(DirtyFormDirtyContext);
  const { pending } = useFormStatus();
  const canClick = dirty && !pending;

  return (
    <button
      type="submit"
      disabled={!canClick}
      title={pending ? "Saving…" : dirty ? "Save changes" : "No changes to save"}
      className={
        pending
          ? "cursor-wait rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 opacity-70"
          : dirty
            ? "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-800"
            : "cursor-default rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-sm text-zinc-500"
      }
    >
      {pending ? "Saving…" : props.label}
    </button>
  );
}

function AdminFeaturePollDirtyOptionSaveButton() {
  const dirty = useContext(DirtyFormDirtyContext);
  const { pending } = useFormStatus();
  const canClick = dirty && !pending;

  return (
    <button
      type="submit"
      disabled={!canClick}
      title={pending ? "Saving…" : dirty ? "Save changes" : "No changes to save"}
      className={
        pending
          ? "cursor-wait rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 opacity-70"
          : dirty
            ? "rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 hover:bg-zinc-800"
            : "cursor-default rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-1 text-xs text-zinc-500"
      }
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

const DirtyFormRecalcContext = createContext<(() => void) | null>(null);
const DirtyFormDirtyContext = createContext(false);

function AdminFeaturePollDirtyForm(props: {
  action: (formData: FormData) => void | Promise<void>;
  snapshotKey: string;
  className?: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const initialSnapshot = useRef("");
  const snapshotReady = useRef(false);
  const [dirty, setDirty] = useState(false);

  const recalc = useCallback(() => {
    if (!formRef.current || !snapshotReady.current) return;
    setDirty(serializeForm(formRef.current) !== initialSnapshot.current);
  }, []);

  useLayoutEffect(() => {
    snapshotReady.current = false;
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        if (!formRef.current) return;
        initialSnapshot.current = serializeForm(formRef.current);
        snapshotReady.current = true;
        setDirty(false);
      });
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [props.snapshotKey]);

  return (
    <DirtyFormRecalcContext.Provider value={recalc}>
      <DirtyFormDirtyContext.Provider value={dirty}>
        <form
          ref={formRef}
          action={props.action}
          onChange={recalc}
          onInput={recalc}
          className={props.className}
        >
          {props.children}
        </form>
      </DirtyFormDirtyContext.Provider>
    </DirtyFormRecalcContext.Provider>
  );
}

function useAdminFeaturePollFormRecalc(): () => void {
  return useContext(DirtyFormRecalcContext) ?? (() => {});
}

function AdminFeaturePollOptionFollowUpFields(props: {
  followUpKind: FeaturePollOptionFollowUpKind;
  followUpPrompt: string | null;
  followUpChoices: string[];
  countryOptions: WorldCountryOption[];
}) {
  const recalc = useAdminFeaturePollFormRecalc();
  const [followUpKind, setFollowUpKind] = useState(props.followUpKind);
  const [followUpPrompt, setFollowUpPrompt] = useState(() =>
    followUpPromptForKind(props.followUpKind, props.followUpPrompt),
  );
  const [followUpChoicesText, setFollowUpChoicesText] = useState(() =>
    serializeFollowUpChoicesText(props.followUpChoices),
  );
  const showFollowUp = followUpKind !== FeaturePollOptionFollowUpKind.none;
  const isCountrySelect = followUpKind === FeaturePollOptionFollowUpKind.country_select;
  const isFreeText = followUpKind === FeaturePollOptionFollowUpKind.free_text;
  const isRadioSelect = followUpKind === FeaturePollOptionFollowUpKind.radio_select;

  useEffect(() => {
    setFollowUpKind(props.followUpKind);
    setFollowUpPrompt(followUpPromptForKind(props.followUpKind, props.followUpPrompt));
    setFollowUpChoicesText(serializeFollowUpChoicesText(props.followUpChoices));
  }, [props.followUpKind, props.followUpPrompt, props.followUpChoices]);

  useEffect(() => {
    recalc();
  }, [followUpKind, followUpPrompt, followUpChoicesText, recalc]);

  const selectFollowUpKind = (next: FeaturePollOptionFollowUpKind) => {
    setFollowUpKind(next);
    if (next === FeaturePollOptionFollowUpKind.none) {
      setFollowUpPrompt("");
      setFollowUpChoicesText("");
      return;
    }
    if (next === FeaturePollOptionFollowUpKind.country_select) {
      setFollowUpPrompt((current) => current.trim() || DEFAULT_COUNTRY_FOLLOW_UP_PROMPT);
      setFollowUpChoicesText("");
      return;
    }
    if (next === FeaturePollOptionFollowUpKind.radio_select) {
      setFollowUpChoicesText((current) => current.trim());
      return;
    }
    setFollowUpChoicesText("");
  };

  const followUpKindOptions: { value: FeaturePollOptionFollowUpKind; label: string }[] = [
    { value: FeaturePollOptionFollowUpKind.none, label: "None" },
    { value: FeaturePollOptionFollowUpKind.free_text, label: "Free text" },
    { value: FeaturePollOptionFollowUpKind.radio_select, label: "Radio options" },
    { value: FeaturePollOptionFollowUpKind.country_select, label: "Country priority" },
  ];

  return (
    <div className="space-y-3 border-t border-zinc-800/80 pt-2">
      <input type="hidden" name="followUpKind" value={followUpKind} />
      <input type="hidden" name="followUpPrompt" value={showFollowUp ? followUpPrompt : ""} />
      <input
        type="hidden"
        name="followUpChoices"
        value={isRadioSelect ? followUpChoicesText : ""}
      />
      <fieldset>
        <legend className="text-[11px] text-zinc-500">Follow-up type</legend>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
          {followUpKindOptions.map((option) => (
            <li key={option.value}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  value={option.value}
                  checked={followUpKind === option.value}
                  onChange={() => selectFollowUpKind(option.value)}
                  className="border-zinc-600 bg-zinc-900"
                />
                {option.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="flex flex-wrap items-end gap-2">
        {showFollowUp && isCountrySelect ? (
          <>
            <label className="min-w-[12rem] flex-1 text-[11px] text-zinc-500">
              Follow-up question (shown above dropdown on poll page)
              <input
                value={followUpPrompt}
                onChange={(e) => setFollowUpPrompt(e.target.value)}
                required
                maxLength={500}
                className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                placeholder={DEFAULT_COUNTRY_FOLLOW_UP_PROMPT}
              />
            </label>
            <label className="min-w-[12rem] flex-1 text-[11px] text-zinc-500">
              Voter country dropdown (US excluded, A–Z)
              <select
                disabled
                className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 disabled:opacity-90"
              >
                <option value="">Select a country…</option>
                {props.countryOptions.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {showFollowUp && isFreeText ? (
          <>
            <label className="min-w-[12rem] flex-1 text-[11px] text-zinc-500">
              Follow-up question (free-text answer)
              <input
                value={followUpPrompt}
                onChange={(e) => setFollowUpPrompt(e.target.value)}
                required
                maxLength={500}
                className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                placeholder="What kinds of items are you most interested in?"
              />
            </label>
          </>
        ) : null}
        {showFollowUp && isRadioSelect ? (
          <>
            <label className="min-w-[12rem] flex-1 text-[11px] text-zinc-500">
              Follow-up question
              <input
                value={followUpPrompt}
                onChange={(e) => setFollowUpPrompt(e.target.value)}
                required
                maxLength={500}
                className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                placeholder="Which option best describes your priority?"
              />
            </label>
            <label className="min-w-[12rem] flex-1 text-[11px] text-zinc-500">
              Radio options (one per line, at least 2)
              <textarea
                value={followUpChoicesText}
                onChange={(e) => setFollowUpChoicesText(e.target.value)}
                required
                rows={4}
                className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                placeholder={"Option A\nOption B\nOption C"}
              />
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function AdminFeatureVotesTab(props: {
  questions: AdminFeaturePollQuestionRow[];
  pollUrl: string;
  countryOptions: WorldCountryOption[];
  migrationRequired?: boolean;
  followUpMigrationRequired?: boolean;
  followUpClientStale?: boolean;
  fpErr?: string;
  fpSaved?: string;
}) {
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);

  return (
    <section className="space-y-10" aria-label="Feature votes">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Feature votes</h2>
        <p className="mt-1 max-w-3xl text-sm text-zinc-400">
          Manage poll questions and options. The poll page is link-only (not in site navigation).
        </p>
        <p className="mt-2 font-mono text-xs text-zinc-500">
          Poll URL:{" "}
          <a href={props.pollUrl} className="text-blue-400/90 hover:underline" target="_blank" rel="noreferrer">
            {props.pollUrl}
          </a>
        </p>
      </div>

      {props.migrationRequired ? (
        <p className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-xs leading-relaxed text-amber-200/90">
          The feature poll tables are not available on this database yet. Run{" "}
          <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
            npx prisma migrate deploy
          </code>{" "}
          (migration <code className="font-mono text-amber-100/90">{FEATURE_POLL_MIGRATION_ID}</code>
          ), then reload.
        </p>
      ) : null}

      {props.followUpClientStale ? (
        <p className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-xs leading-relaxed text-amber-200/90">
          Poll follow-up fields are not in this server&apos;s Prisma client yet. Locally run{" "}
          <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
            npx prisma generate
          </code>
          , restart <code className="font-mono text-amber-100/90">npm run dev</code>, or delete{" "}
          <code className="font-mono text-amber-100/90">.next</code>. On production, redeploy the
          latest build.
        </p>
      ) : null}

      {props.followUpMigrationRequired ? (
        <p className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-xs leading-relaxed text-amber-200/90">
          Poll follow-up questions are not available on this database yet. Run{" "}
          <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
            npm run db:migrate:prod
          </code>{" "}
          (migration{" "}
          <code className="font-mono text-amber-100/90">{FEATURE_POLL_FOLLOWUP_MIGRATION_ID}</code>
          ), redeploy if needed, then reload.
        </p>
      ) : null}

      {props.fpSaved && SAVED_LABELS[props.fpSaved] ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
        >
          {SAVED_LABELS[props.fpSaved]}
        </p>
      ) : null}
      {props.fpErr ? (
        <p className="rounded border border-blue-900/50 bg-blue-950/30 px-3 py-2 text-xs text-blue-200/90">
          {props.fpErr}
        </p>
      ) : null}

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Add question</h3>
        <form action={adminCreateFeaturePollQuestionForm} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[16rem] flex-1 text-[11px] text-zinc-500">
            Prompt
            <input
              name="prompt"
              required
              maxLength={500}
              className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              placeholder="What feature should we build next?"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
          >
            Add question
          </button>
        </form>
      </div>

      {props.questions.length === 0 ? (
        <p className="text-sm text-zinc-500">No questions yet.</p>
      ) : (
        <ul className="space-y-8">
          {props.questions.map((q, qIndex) => (
            <li key={q.id} className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
              <AdminFeaturePollDirtyForm
                action={adminUpdateFeaturePollQuestionForm}
                snapshotKey={`${q.id}:${q.prompt}:${q.sortOrder}:${q.active}`}
                className="space-y-3"
              >
                <input type="hidden" name="questionId" value={q.id} />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <label className="min-w-[12rem] flex-1 text-[11px] text-zinc-500">
                    Question
                    <input
                      name="prompt"
                      defaultValue={q.prompt}
                      required
                      maxLength={500}
                      className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-[11px] text-zinc-500">
                      Sort
                      <input
                        name="sortOrder"
                        type="number"
                        defaultValue={q.sortOrder}
                        className="ml-1 w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-zinc-300">
                      <input name="active" type="checkbox" defaultChecked={q.active} />
                      Active
                    </label>
                  </div>
                </div>
                <AdminFeaturePollDirtySaveButton label="Save question" />
              </AdminFeaturePollDirtyForm>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={adminDeleteFeaturePollQuestionForm}>
                  <input type="hidden" name="questionId" value={q.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-800 px-3 py-1.5 text-sm text-red-300/90 hover:bg-red-950/30"
                  >
                    Delete
                  </button>
                </form>
                <form action={adminMoveFeaturePollQuestionForm}>
                  <input type="hidden" name="questionId" value={q.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    disabled={qIndex === 0}
                    className="rounded-md border border-zinc-800 px-2 py-1.5 text-xs text-zinc-400 disabled:opacity-40"
                  >
                    ↑
                  </button>
                </form>
                <form action={adminMoveFeaturePollQuestionForm}>
                  <input type="hidden" name="questionId" value={q.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    disabled={qIndex === props.questions.length - 1}
                    className="rounded-md border border-zinc-800 px-2 py-1.5 text-xs text-zinc-400 disabled:opacity-40"
                  >
                    ↓
                  </button>
                </form>
              </div>

              <div className="mt-6 border-t border-zinc-800 pt-4">
                <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Options</h4>
                <form action={adminCreateFeaturePollOptionForm} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="questionId" value={q.id} />
                  <label className="min-w-[12rem] flex-1 text-[11px] text-zinc-500">
                    New option
                    <input
                      name="label"
                      required
                      maxLength={300}
                      className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-800"
                  >
                    Add option
                  </button>
                </form>

                <ul className="mt-4 space-y-3">
                  {[...q.options]
                    .sort((a, b) => b.voteCount - a.voteCount || a.sortOrder - b.sortOrder)
                    .map((opt, optIndex, sorted) => {
                      const origIndex = q.options.findIndex((o) => o.id === opt.id);
                      return (
                        <li key={opt.id} className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3">
                          <AdminFeaturePollDirtyForm
                            action={adminUpdateFeaturePollOptionForm}
                            snapshotKey={`${opt.id}:${opt.label}:${opt.sortOrder}:${opt.status}:${opt.followUpKind}:${opt.followUpPrompt ?? ""}:${opt.followUpChoices.join("\n")}`}
                            className="space-y-2"
                          >
                            <input type="hidden" name="optionId" value={opt.id} />
                            <div className="flex flex-wrap items-end gap-2">
                              <label className="min-w-[10rem] flex-1 text-[11px] text-zinc-500">
                                Label
                                <input
                                  name="label"
                                  defaultValue={opt.label}
                                  required
                                  maxLength={300}
                                  className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                                />
                              </label>
                              <label className="text-[11px] text-zinc-500">
                                Sort
                                <input
                                  name="sortOrder"
                                  type="number"
                                  defaultValue={opt.sortOrder}
                                  className="ml-1 w-14 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                                />
                              </label>
                              <label className="text-[11px] text-zinc-500">
                                Status
                                <select
                                  name="status"
                                  defaultValue={opt.status}
                                  className="ml-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                                >
                                  <option value={FeaturePollOptionStatus.active}>Active</option>
                                  <option value={FeaturePollOptionStatus.completed}>Completed</option>
                                  <option value={FeaturePollOptionStatus.removed}>Removed</option>
                                </select>
                              </label>
                              <span className="text-sm font-medium text-zinc-300">{opt.voteCount} votes</span>
                            </div>
                            <AdminFeaturePollOptionFollowUpFields
                              followUpKind={opt.followUpKind}
                              followUpPrompt={opt.followUpPrompt}
                              followUpChoices={opt.followUpChoices}
                              countryOptions={props.countryOptions}
                            />
                            <AdminFeaturePollDirtyOptionSaveButton />
                          </AdminFeaturePollDirtyForm>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <form action={adminDeleteFeaturePollOptionForm}>
                              <input type="hidden" name="optionId" value={opt.id} />
                              <button
                                type="submit"
                                className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-red-300/90 hover:bg-red-950/30"
                              >
                                Delete
                              </button>
                            </form>
                            <form action={adminMoveFeaturePollOptionForm}>
                              <input type="hidden" name="optionId" value={opt.id} />
                              <input type="hidden" name="questionId" value={q.id} />
                              <input type="hidden" name="direction" value="up" />
                              <button
                                type="submit"
                                disabled={origIndex === 0}
                                className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 disabled:opacity-40"
                              >
                                ↑
                              </button>
                            </form>
                            <form action={adminMoveFeaturePollOptionForm}>
                              <input type="hidden" name="optionId" value={opt.id} />
                              <input type="hidden" name="questionId" value={q.id} />
                              <input type="hidden" name="direction" value="down" />
                              <button
                                type="submit"
                                disabled={origIndex === q.options.length - 1}
                                className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 disabled:opacity-40"
                              >
                                ↓
                              </button>
                            </form>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOptionId((cur) => (cur === opt.id ? null : opt.id))
                              }
                              className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                            >
                              {expandedOptionId === opt.id ? "Hide voters" : "Show voters"}
                            </button>
                          </div>
                          {expandedOptionId === opt.id ? (
                            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto border-t border-zinc-800 pt-2 text-xs text-zinc-400">
                              {opt.voters.length === 0 ? (
                                <li>No votes yet.</li>
                              ) : (
                                opt.voters.map((v) => (
                                  <li key={v.id}>
                                    <span className="text-zinc-500">
                                      {v.voterKind === FeaturePollVoterKind.shop ? "Shop" : "Donor"}:
                                    </span>{" "}
                                    {v.label}
                                    {v.followUpAnswerDisplay ? (
                                      <>
                                        {" "}
                                        <span className="text-zinc-500">—</span>{" "}
                                        <span className="text-zinc-300">{v.followUpAnswerDisplay}</span>
                                      </>
                                    ) : null}
                                  </li>
                                ))
                              )}
                            </ul>
                          ) : null}
                          {sorted.length > 1 && optIndex === 0 && opt.voteCount > 0 ? (
                            <p className="mt-1 text-[10px] text-zinc-600">Top by vote count in results</p>
                          ) : null}
                        </li>
                      );
                    })}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
