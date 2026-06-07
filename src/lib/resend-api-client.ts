/** Resend requires a User-Agent on all API requests (403 / error 1010 without it). */
export const RESEND_API_USER_AGENT = "StillWet/1.0 (+https://stillwet.com)";

export type ResendDomainSummary = {
  id: string;
  name: string;
  status: string;
  sending: string | null;
  receiving: string | null;
  records: Array<{ record: string; name: string; status: string }>;
};

export type ResendSendingDomainDiagnostics = {
  resolvedFrom: string;
  resolvedFromDomain: string | null;
  apiKeyPresent: boolean;
  /** Domains visible to the server's RESEND_API_KEY (same team as Vercel env). */
  domainsOnApiKey: string[];
  stillwetCom: {
    found: boolean;
    status: string | null;
    sending: string | null;
    receiving: string | null;
    records: Array<{ record: string; name: string; status: string }>;
    readyForOutboundSend: boolean;
  };
  hint: string | null;
};

async function resendApiFetch(
  apiKey: string,
  pathname: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`https://api.resend.com${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": RESEND_API_USER_AGENT,
      ...(init?.headers ?? {}),
    },
  });
}

export async function listResendDomains(apiKey: string): Promise<ResendDomainSummary[]> {
  const res = await resendApiFetch(apiKey, "/domains");
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Resend GET /domains ${res.status}: ${body.slice(0, 240)}`);
  }
  const parsed = JSON.parse(body) as {
    data?: Array<{
      id: string;
      name: string;
      status: string;
      capabilities?: { sending?: string; receiving?: string };
    }>;
  };
  const rows = parsed.data ?? [];
  const out: ResendDomainSummary[] = [];
  for (const row of rows) {
    let records: ResendDomainSummary["records"] = [];
    const detailRes = await resendApiFetch(apiKey, `/domains/${row.id}`);
    if (detailRes.ok) {
      const detail = (await detailRes.json()) as {
        records?: Array<{ record?: string; name?: string; status?: string }>;
      };
      records = (detail.records ?? []).map((r) => ({
        record: r.record ?? "?",
        name: r.name ?? "",
        status: r.status ?? "?",
      }));
    }
    out.push({
      id: row.id,
      name: row.name,
      status: row.status,
      sending: row.capabilities?.sending ?? null,
      receiving: row.capabilities?.receiving ?? null,
      records,
    });
  }
  return out;
}

export function resendOutboundSendReady(domain: ResendDomainSummary | undefined): boolean {
  if (!domain) return false;
  if (domain.status !== "verified") return false;
  if (domain.sending === "disabled") return false;
  const sendRecords = domain.records.filter((r) =>
    /spf|dkim|send/i.test(r.record),
  );
  if (sendRecords.length === 0) return domain.sending === "enabled";
  return sendRecords.every((r) => r.status === "verified");
}

export async function loadResendSendingDomainDiagnostics(args: {
  apiKey: string | undefined;
  resolvedFrom: string;
  targetDomain?: string;
}): Promise<ResendSendingDomainDiagnostics> {
  const targetDomain = (args.targetDomain ?? "stillwet.com").toLowerCase();
  const resolvedFromDomain =
    args.resolvedFrom.match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? null;

  if (!args.apiKey?.trim()) {
    return {
      resolvedFrom: args.resolvedFrom,
      resolvedFromDomain,
      apiKeyPresent: false,
      domainsOnApiKey: [],
      stillwetCom: {
        found: false,
        status: null,
        sending: null,
        receiving: null,
        records: [],
        readyForOutboundSend: false,
      },
      hint: "RESEND_API_KEY is not set on this server.",
    };
  }

  const domains = await listResendDomains(args.apiKey.trim());
  const names = domains.map((d) => d.name);
  const stillwet = domains.find((d) => d.name.toLowerCase() === targetDomain);
  const ready = resendOutboundSendReady(stillwet);

  let hint: string | null = null;
  if (!stillwet) {
    hint = `stillwet.com is not on the Resend account tied to this server's API key. Domains on key: ${names.join(", ") || "(none)"}. Use the same Resend team for domain verification and Vercel RESEND_API_KEY.`;
  } else if (stillwet.receiving === "enabled" && stillwet.sending !== "enabled") {
    hint =
      "Inbound (MX/receive) is set up but outbound sending is not enabled. Add SPF + DKIM sending DNS at IONOS and verify Send in Resend.";
  } else if (stillwet.status !== "verified") {
    const pending = stillwet.records.filter((r) => r.status !== "verified");
    hint = `stillwet.com Resend status is "${stillwet.status}". Pending DNS: ${pending.map((r) => `${r.record} (${r.status})`).join(", ") || "check Resend → Domains → Records"}.`;
  } else if (!ready) {
    hint =
      "Domain shows verified but sending records may be incomplete. Open Resend → stillwet.com → Records and confirm SPF/DKIM are verified (not only MX for inbound).";
  } else if (resolvedFromDomain && resolvedFromDomain !== targetDomain) {
    hint = `App sends from @${resolvedFromDomain} but only @${targetDomain} was checked. From must match a verified domain exactly (including subdomain).`;
  }

  return {
    resolvedFrom: args.resolvedFrom,
    resolvedFromDomain,
    apiKeyPresent: true,
    domainsOnApiKey: names,
    stillwetCom: {
      found: Boolean(stillwet),
      status: stillwet?.status ?? null,
      sending: stillwet?.sending ?? null,
      receiving: stillwet?.receiving ?? null,
      records: stillwet?.records ?? [],
      readyForOutboundSend: ready,
    },
    hint,
  };
}

/** User-facing hint when Resend rejects an unverified From domain. */
export function formatResendDomainNotVerifiedHint(fromUsed: string): string {
  return (
    `Resend rejected From ${JSON.stringify(fromUsed)}. Common causes: (1) stillwet.com is verified for inbound (MX) but not for outbound Send (SPF/DKIM at IONOS); (2) Vercel RESEND_API_KEY is from a different Resend account than where the domain was verified; (3) the API key is restricted to another domain (e.g. auto.stillwet.com). Check GET /api/health → resend after deploy, or Resend → Domains → stillwet.com → Records.`
  );
}

/** POST /emails with required Resend headers. */
export async function postResendEmailApi(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  return resendApiFetch(apiKey, "/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
