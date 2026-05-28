export function isVercelCron(req: Request) {
  return req.headers.get("x-vercel-cron") === "1";
}

export function cronForbiddenInProduction(req: Request): boolean {
  return process.env.NODE_ENV === "production" && !isVercelCron(req);
}
