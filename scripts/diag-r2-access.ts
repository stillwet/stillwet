/**
 * Safe R2 connectivity diagnostic (no secrets printed).
 * Usage: npx tsx scripts/diag-r2-access.ts
 */
import { config } from "dotenv";
import {
  HeadBucketCommand,
  ListBucketsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { putR2ObjectBytes, readR2Env, readR2BucketName } from "../src/lib/r2-upload";

config({ path: ".env" });
config({ path: ".env.local", override: true });

function mask(s: string): string {
  if (s.length <= 8) return `len=${s.length}`;
  return `len=${s.length}, ${s.slice(0, 4)}…${s.slice(-4)}`;
}

function dumpError(label: string, err: unknown) {
  const e = err as {
    name?: string;
    Code?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
  };
  console.log(`[${label}] name:`, e?.name ?? "(none)");
  console.log(`[${label}] Code:`, e?.Code ?? "(none)");
  console.log(`[${label}] message:`, e?.message ?? String(err));
  if (e?.$metadata?.httpStatusCode != null) {
    console.log(`[${label}] httpStatus:`, e.$metadata.httpStatusCode);
  }
}

function r2S3Endpoint(): string {
  const custom = readR2Env("R2_ENDPOINT");
  if (custom) return custom.replace(/\/$/, "");
  const id = readR2Env("R2_ACCOUNT_ID");
  if (!id) throw new Error("R2_ACCOUNT_ID or R2_ENDPOINT is required");
  return `https://${id}.r2.cloudflarestorage.com`;
}

/** Mirror production client in r2-upload.ts */
function diagR2Client(): S3Client {
  const client = new S3Client({
    region: "auto",
    endpoint: r2S3Endpoint(),
    credentials: {
      accessKeyId: readR2Env("R2_ACCESS_KEY_ID") ?? "",
      secretAccessKey: readR2Env("R2_SECRET_ACCESS_KEY") ?? "",
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  client.middlewareStack.add(
    (next) => async (args) => {
      const req = args.request as { headers?: Record<string, string> };
      if (req?.headers) {
        for (const key of Object.keys(req.headers)) {
          const lower = key.toLowerCase();
          if (lower.startsWith("x-amz-checksum") || lower === "x-amz-sdk-checksum-algorithm") {
            delete req.headers[key];
          }
        }
      }
      return next(args);
    },
    { step: "build", name: "r2StripChecksumHeaders" },
  );

  return client;
}

async function main() {
  const bucket = readR2BucketName();
  const publicBase = readR2Env("R2_PUBLIC_BASE_URL") ?? "";

  console.log("[diag] endpoint:", r2S3Endpoint());
  console.log(
    "[diag] bucket:",
    bucket ? `${JSON.stringify(bucket)} (len=${bucket.length})` : "MISSING",
  );
  console.log("[diag] R2_PUBLIC_BASE_URL:", publicBase || "MISSING");

  if (publicBase.includes("r2.cloudflarestorage.com")) {
    console.warn(
      "[diag] WARN: R2_PUBLIC_BASE_URL uses the private S3 API host — use the bucket's pub-….r2.dev URL instead.",
    );
  }
  if (publicBase.endsWith("/stillwet") || publicBase.endsWith(`/${bucket}`)) {
    console.warn(
      "[diag] WARN: R2_PUBLIC_BASE_URL should not include the bucket name as a path segment.",
    );
  }

  console.log("[diag] R2_ACCESS_KEY_ID:", mask(readR2Env("R2_ACCESS_KEY_ID") ?? ""));
  console.log("[diag] R2_SECRET_ACCESS_KEY:", mask(readR2Env("R2_SECRET_ACCESS_KEY") ?? ""));

  const client = diagR2Client();

  try {
    const listed = await client.send(new ListBucketsCommand({}));
    const names = (listed.Buckets ?? []).map((b) => b.Name).filter(Boolean);
    console.log("[diag] ListBuckets: OK —", names.length ? names.join(", ") : "(no buckets)");
    if (bucket && names.length && !names.includes(bucket)) {
      console.warn(
        `[diag] WARN: R2_BUCKET=${JSON.stringify(bucket)} is not in ListBuckets result. Token may be for a different account.`,
      );
    }
  } catch (err) {
    dumpError("ListBuckets", err);
    console.log(
      "[diag] tip: Object Read & Write tokens often cannot ListBuckets. Try Admin Read & Write once to confirm account/bucket alignment.",
    );
  }

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log("[diag] HeadBucket: OK");
  } catch (err) {
    dumpError("HeadBucket", err);
  }

  const put = await putR2ObjectBytes({
    key: `diag/test-${Date.now()}.txt`,
    body: Buffer.from("ok"),
    contentType: "text/plain",
  });
  console.log("[diag] putR2ObjectBytes:", put.ok ? "OK" : put.error);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
