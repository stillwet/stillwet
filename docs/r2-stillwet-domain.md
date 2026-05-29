# R2 public URL for Still Wet (`stillwet.com`)

Listing images use `R2_PUBLIC_BASE_URL` in `src/lib/r2-upload.ts`. Every uploaded object is served from:

```text
{R2_PUBLIC_BASE_URL}/{object-key}
```

Use a **subdomain** (recommended: **`cdn.stillwet.com`**) — not the site apex (`stillwet.com`), which stays on Vercel.

---

## Choose a path

| Path | When to use |
|------|-------------|
| **A. `r2.dev` subdomain** | Fastest; no DNS changes. Fine for launch / testing. |
| **B. Custom domain `cdn.stillwet.com`** | Production branding; needs `stillwet.com` added to your **Cloudflare** account (see below). |

---

## Path A — R2.dev (≈5 minutes)

1. Cloudflare → **R2** → your bucket → **Settings** → **Public access**.
2. Enable **R2.dev subdomain** → copy URL (e.g. `https://pub-xxxxx.r2.dev`).
3. Set env (Vercel Production + `.env.local`):

   ```env
   R2_PUBLIC_BASE_URL=https://pub-xxxxx.r2.dev
   ```

4. Redeploy Vercel. Test: `npm run test:r2`

---

## Path B — Custom domain `cdn.stillwet.com`

R2 custom domains require **`stillwet.com` as a zone in the same Cloudflare account as the bucket**. Your site can keep using **IONOS → Vercel** for `stillwet.com` / `www`; you do **not** have to move the whole site to Cloudflare.

### B1. Add `stillwet.com` to Cloudflare (partial / CNAME setup)

If nameservers are still at **IONOS** (Vercel apex A record there):

1. Cloudflare dashboard → **Add a site** → enter `stillwet.com`.
2. Choose **Free** plan.
3. When asked, use **partial setup** (CNAME setup) if offered — so you **keep IONOS nameservers** and verify with a **TXT** record at IONOS instead of switching NS.
4. Complete verification (TXT at IONOS as Cloudflare instructs).
5. Wait until the zone shows **Active** in Cloudflare.

If you already moved **all** DNS to Cloudflare nameservers, skip partial setup — add DNS records for Vercel (apex A + www CNAME) in Cloudflare and continue.

Docs: [Public buckets — add your domain](https://developers.cloudflare.com/r2/buckets/public-buckets/)

### B2. Connect the bucket in Cloudflare UI

1. **R2** → bucket (e.g. `stillwet-listings`) → **Settings** → **Custom domains** → **Connect domain**.
2. Enter: **`cdn.stillwet.com`**
3. Confirm the DNS record Cloudflare will create (usually CNAME).
4. If using **partial setup**, Cloudflare may ask you to add a **CNAME** at **IONOS** for `cdn` pointing to the target shown — add it in IONOS DNS for `stillwet.com`.

### B2 alt. — Wrangler CLI (after `npx wrangler login`)

From repo root (replace bucket name and zone id):

```powershell
# List zones to get stillwet.com zone id
npx wrangler zones list

# Connect custom domain
npx wrangler r2 bucket domain add YOUR_BUCKET_NAME `
  --domain cdn.stillwet.com `
  --zone-id YOUR_ZONE_ID `
  -y
```

Or run: `powershell -File scripts/r2-connect-cdn-domain.ps1`

### B3. App env vars

```env
R2_PUBLIC_BASE_URL=https://cdn.stillwet.com
```

No trailing slash. Also set in **Vercel → Production** → **Redeploy**.

### B4. Verify

```powershell
npm run test:r2
```

Open the printed URL in a browser (HTTP 200). Upload a listing image in admin/dashboard and confirm the image URL starts with `https://cdn.stillwet.com/`.

---

## Full R2 env checklist (Vercel Production)

```env
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=your-bucket-name
R2_PUBLIC_BASE_URL=https://cdn.stillwet.com
```

(`R2_BUCKET_NAME` also works.)

---

## Fresh account / rebrand note

If `.env.local` still has `R2_PUBLIC_BASE_URL` on **`xtinadom.com`** or bucket **`xtinadommerch`**, create a **new bucket** (or rename), connect the new public URL above, and update Vercel — old object URLs in a new Neon DB are usually empty anyway.

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| “Domain not found on your account” | Add `stillwet.com` zone to Cloudflare (step B1). |
| Upload OK, image 404 | Wrong `R2_PUBLIC_BASE_URL` or public access / custom domain not connected. |
| SSL errors on `cdn` | Wait for Cloudflare cert provisioning (~minutes). |
| Apex site breaks after NS change | Restore Vercel A/CNAME records in Cloudflare before switching nameservers. |
