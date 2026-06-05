import { SITE_EMAIL_LOGO_R2_OBJECT_KEY } from "@/lib/site-email-logo-constants";
import {
  deleteR2ObjectsByKeysForPrune,
  isR2UploadConfigured,
  listAllR2ObjectKeys,
} from "@/lib/r2-upload";

export function isSiteLogoR2Key(key: string): boolean {
  return key === SITE_EMAIL_LOGO_R2_OBJECT_KEY;
}

export type PurgeAllR2ExceptSiteLogoResult = {
  totalObjectCount: number;
  keptKeyCount: number;
  targetKeyCount: number;
  deletedCount: number;
  keptKeys: string[];
  targetKeysSample: string[];
};

/** Delete every R2 object except the transactional email site logo. */
export async function purgeAllR2ExceptSiteLogo(options: {
  dryRun: boolean;
}): Promise<PurgeAllR2ExceptSiteLogoResult> {
  if (!isR2UploadConfigured()) {
    throw new Error("R2 is not configured");
  }

  const allKeys = await listAllR2ObjectKeys();
  const keptKeys = allKeys.filter(isSiteLogoR2Key);
  const targetKeys = allKeys.filter((k) => !isSiteLogoR2Key(k));
  let deletedCount = 0;
  if (!options.dryRun && targetKeys.length > 0) {
    deletedCount = await deleteR2ObjectsByKeysForPrune(targetKeys);
  }

  return {
    totalObjectCount: allKeys.length,
    keptKeyCount: keptKeys.length,
    targetKeyCount: targetKeys.length,
    deletedCount,
    keptKeys,
    targetKeysSample: targetKeys.slice(0, 40),
  };
}
