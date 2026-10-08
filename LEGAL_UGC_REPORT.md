# PromptShare LEGAL_UGC_REPORT

Deployed: Cloudflare Pages project `promptshare`  
Peek host: `https://8deca176.promptshare-6is.pages.dev` (301s to canonical)  
Live: https://promptshare.fun  
Synced overlay → dist per `OVERLAY_README.txt`, then `npx wrangler pages deploy dist --project-name=promptshare`.  
No restyle. Contact email unchanged: **support@promptshare.fun**.  
Timezone notes in PT (America/Los_Angeles).

## Live-verify (required verbatim)

### 1. NSFW / minors paragraph(s) on `/terms` (HTML text as rendered)

From the **Safety and NSFW** panel on https://promptshare.fun/terms/ :

> PromptShare does not allow illegal or unlawful content. No sexual content involving minors — including photographic, illustrated, AI-generated, or fictional depictions. Do not upload CSAM, exploitation material, or instructions for violent crime. Adult NSFW that does not involve minors may still be removed if it is illegal in the user’s jurisdiction, non-consensual, or reported as harmful. Anyone signed in can report a plate; owners can hide their own work. PromptShare may remove content and accounts that break these rules.

(Source markup keeps `<strong>No sexual content involving minors</strong>` around that phrase.)

### 2. Contact email on `/contact` + mailto

Visible text: **support@promptshare.fun**  
Mailto: `mailto:support@promptshare.fun`  
Live markup:

```html
<a href="mailto:support@promptshare.fun">support@promptshare.fun</a>
```

Same publisher email remains visible + mailto on `/about/`, `/privacy/`, `/terms/` (and `/cookies/`).

## What else changed in Terms

- Meta line stays **Applies to https://promptshare.fun/** (no pages.dev leftover).
- New **Not a model vendor** section: browsing does not send prompts to a model / does not generate output.
- **Notes** wording: “PromptShare’s interpretations … not the creator’s commentary” (also restated under What the plates contain).
- **Your uploads — ownership and license**: users keep ownership; grant PromptShare a non-exclusive license to host/store/reproduce/display per visibility (public / unlisted).
- Prompt must **match the uploaded output** (text that produced that file).
- Unlawful content prohibition kept; accounts may be removed/disabled for abuse.
- **Safety and NSFW** strengthened: “illegal or unlawful”; explicit **AI-generated** (plus photographic, illustrated, fictional); may remove **content and accounts**.
- New **Removal and deletion requests**: email **support@promptshare.fun** to request deletion.
- Advertising copy updated to match reality: AdSense script present for review; slots not above plate images.

## What else changed in Privacy

- Last updated → September 27, 2026; applies to promptshare.fun only.
- New **Infrastructure (honest stack)**: Cloudflare Pages, D1, R2, Google/Microsoft OAuth or magic link, Resend when configured, **no password store**.
- Upload storage spelled out: **image, prompt, model, tags, visibility** (plus steps/title).
- Public plates: visible to anyone and **may be indexed** by search engines.
- New **Analytics** section: no first-party analytics product today; Cloudflare edge request logs only; any future analytics would be **pageviews only** and would **not** send full prompts, plate images, or account emails.
- AdSense honesty: script `ca-pub-4059575347806121` for review; ads not above plate images; points at ads.txt.
- Deletion requests section with contact email.

## Ads / ads.txt / analytics / plates

- **ads.txt** kept as real text file: `google.com, pub-4059575347806121, DIRECT, f08c47fec0942fa0` (live `text/plain`).
- AdSense review script kept in page heads; **no new ad placements** above plates.
- Live check `/p/seed_burger`: body has plate `<img>` and **no** `adsbygoogle` / `<ins>` above (or in) the SSR body. SPA GalleryApp ad-slot remains in `screen-foot` only (below content), gated on pub id.
- No first-party analytics product in the tree; privacy states pageviews-only constraint for any future analytics.

## Also touched (supporting honesty, no restyle)

- `/cookies/` and `/about/` advertising blurbs updated so they no longer claim the AdSense script is absent.
- Overlay synced onto `dist/` (media/ and fonts/ left untouched).

## Not changed / out of scope

- No CSS/visual restyle.
- Auth secrets / admin report queue unchanged.
- Publisher email not rotated.
