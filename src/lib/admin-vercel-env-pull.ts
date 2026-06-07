import fs from "node:fs";
import path from "node:path";

/** True when admin env-pull can write files on this machine (local dev only). */
export function isAdminVercelEnvPullAvailable(): boolean {
  return process.env.NODE_ENV === "development" && process.env.VERCEL !== "1";
}

export function isVercelProjectLinkedInRepo(): boolean {
  try {
    return fs.existsSync(path.join(process.cwd(), ".vercel", "project.json"));
  } catch {
    return false;
  }
}
