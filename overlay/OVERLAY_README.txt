PromptShare image-only upload overlay
Overwrite these paths onto the existing dist/ (the one that already contains media/ and fonts/).
index.html is at the archive root, not inside a dist/ folder.

Overwrite:
  index.html
  _redirects
  site.webmanifest
  sw.js
  # sitemap.xml served by functions/sitemap.xml.ts (do not ship a static override)
  sitemap-plates.xml
  robots.txt
  icon-192.png
  icon-512.png
  assets/index-22c3e0bb.js
  assets/index-c49d2620.css
  assets/GalleryApp-f8a8436f.js
  about/index.html
  privacy/index.html
  terms/index.html
  cookies/index.html
  contact/index.html
  ads.txt

Also deploy functions/ beside dist/ (includes functions/p/[id].ts and functions/c/[id].ts).
Public plate permalinks: /p/{id}. Legacy /c/{id} 301 → /p/{id}.
You can delete older assets/index-*.js and assets/GalleryApp-*.js that index.html no longer references.
Do not replace media/ or fonts/. The archive still serves its video and audio plates from media/.

Uploads are images only. R2 binding MEDIA is still required for those images and for avatars.
Deploy from the repo root, with functions/ beside dist/:
  npx wrangler pages deploy dist --project-name=promptshare
See promptshare-functions.zip and BUILD_REPORT.md.

Live assets are only index-22c3e0bb.js, index-c49d2620.css, GalleryApp-f8a8436f.js. Remove older unused bundles.
Dynamic /sitemap.xml is functions/sitemap.xml.ts (D1-backed). Optional NSFW: SIGHTENGINE_API_USER + SIGHTENGINE_API_SECRET.
