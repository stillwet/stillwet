import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isFeaturePollFollowUpSchemaDriftError } from "@/lib/prisma-missing-relation";

let followUpFieldsSupported: boolean | undefined;

function scalarEnumsIncludeFollowUpFields(): boolean {
  return (
    "followUpAnswer" in Prisma.FeaturePollVoteScalarFieldEnum &&
    "followUpKind" in Prisma.FeaturePollOptionScalarFieldEnum &&
    "followUpChoices" in Prisma.FeaturePollOptionScalarFieldEnum
  );
}

/** Probes the active Prisma runtime (not just generated types) for follow-up poll fields. */
export async function prismaClientSupportsFeaturePollFollowUp(): Promise<boolean> {
  if (followUpFieldsSupported !== undefined) return followUpFieldsSupported;
  if (!scalarEnumsIncludeFollowUpFields()) {
    followUpFieldsSupported = false;
    return false;
  }
  try {
    await prisma.featurePollVote.findFirst({
      select: { id: true, followUpAnswer: true },
    });
    followUpFieldsSupported = true;
  } catch (e) {
    if (isFeaturePollFollowUpSchemaDriftError(e)) {
      followUpFieldsSupported = false;
    } else {
      throw e;
    }
  }
  return followUpFieldsSupported;
}

/** Test-only reset for module cache. */
export function resetFeaturePollFollowUpSupportCacheForTests(): void {
  followUpFieldsSupported = undefined;
}
