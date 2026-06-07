"use server";

import { spawnSync } from "node:child_process";
import path from "node:path";
import { redirect } from "next/navigation";
import {
  isAdminVercelEnvPullAvailable,
  isVercelProjectLinkedInRepo,
} from "@/lib/admin-vercel-env-pull";
import { getAdminSessionReadonly } from "@/lib/session";

export type AdminPullVercelProductionEnvResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

function tailOutput(buf: string | Buffer | null | undefined, max = 480): string {
  const s = (typeof buf === "string" ? buf : buf?.toString("utf8") ?? "").trim();
  if (!s) return "";
  return s.length <= max ? s : s.slice(-max);
}

export async function adminPullVercelProductionEnvAction(
  _prev: AdminPullVercelProductionEnvResult | null,
  _formData: FormData,
): Promise<AdminPullVercelProductionEnvResult> {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");

  if (!isAdminVercelEnvPullAvailable()) {
    return {
      ok: false,
      error: "Pull prod env only works on local dev — not on the Vercel deployment.",
    };
  }

  if (!isVercelProjectLinkedInRepo()) {
    return {
      ok: false,
      error: "Repo is not linked to Vercel. Run `npx vercel link` in the project root.",
    };
  }

  const script = path.join(process.cwd(), "scripts", "pull-vercel-production-env.cjs");
  const r = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });

  if (r.error) {
    return { ok: false, error: r.error.message };
  }

  if ((r.status ?? 1) !== 0) {
    const combined = tailOutput(`${r.stdout ?? ""}\n${r.stderr ?? ""}`);
    if (/not authorized|login/i.test(combined)) {
      return {
        ok: false,
        error: "Vercel CLI is not logged in. Run `npx vercel login` in a terminal.",
      };
    }
    if (/project settings|vercel link/i.test(combined)) {
      return {
        ok: false,
        error: "Could not load Vercel project settings. Run `npx vercel link` again.",
      };
    }
    return {
      ok: false,
      error: combined || "vercel env pull failed (see server log).",
    };
  }

  return {
    ok: true,
    message:
      "Pulled production env into .env.production.local and .env. Restart `npm run dev` to reload.",
  };
}
