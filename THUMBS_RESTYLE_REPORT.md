# PromptShare thumbs restyle — 2026-10-02 PT

- Removed the dark pill/background from thumbs controls; kept the D1-backed count and toggle behavior.
- Added a transparent media-corner treatment with drop shadow/text shadow for contrast.
- Re-homed image/video card thumbs to the media bottom-right; plate thumbs now sit at the stage bottom-right.
- Added the v2 overlay assets and bumped cache references to `20261002th2`.
- Deployed Pages project `promptshare`: `https://94ecb184.promptshare-6is.pages.dev` (production custom domain serves the update).
- Verified `GET /api/thumbs` remains 200 with count/voted fields.
- Review screenshot: `/workspace/ps-review/thumbs-restyle.png`.
