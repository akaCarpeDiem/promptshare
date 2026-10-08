/**
 * Landscapes #1 published into seedBundle() as mp4. Keep this file as reference notes only.
 * Landscapes #1: unique canopy scene (no collision with image Landscapes plates).
 */
import type { Creation, ChainStep } from "./types.ts";

export type PendingVideoSeed = Omit<Creation, "likeCount" | "saveCount" | "liked" | "saved" | "steps"> & {
  steps: Omit<ChainStep, "id">[];
  notes: { phrase: string; kind: string; means: string }[];
  placeholderPath: string;
  status: "published";
};

export const PENDING_VIDEO_SEEDS: PendingVideoSeed[] = [
  {
    id: "seed_video_landscapes_canopy_godrays",
    userId: "user_mira",
    title: "Canopy god-rays",
    prompt:
      "Cinematic slow forward glide through a mossy temperate rainforest canopy at sunrise, thick spruce and hemlock trunks, dripping sword ferns, shafts of golden god-rays cutting through low fog, wet bark glistening, tiny suspended droplets, photoreal nature documentary, no people, no faces, no animals, no text, no watermark, 8 seconds, gentle camera drift only",
    model: "Grok",
    tags: ["landscapes", "forest", "canopy", "video"],
    visibility: "public",
    mediaUrl: "/media/video/landscapes-canopy-godrays.mp4",
    mediaKind: "video",
    featured: true,
    hidden: false,
    createdAt: "2026-10-01T22:00:00.000Z",
    steps: [],
    placeholderPath: "/media/video/landscapes-canopy-godrays.mp4",
    status: "published",
    notes: [
      {
        phrase: "slow forward glide through a mossy temperate rainforest canopy",
        kind: "camera",
        means:
          "A camera or framing cue. “slow forward glide through a mossy temperate rainforest canopy” locks motion and viewpoint so the model prefers a traveling canopy shot instead of a static wide landscape.",
      },
      {
        phrase: "shafts of golden god-rays cutting through low fog",
        kind: "lighting",
        means:
          "A lighting cue. “shafts of golden god-rays cutting through low fog” sets volumetric beams and mist depth so the air feels thick instead of flat.",
      },
      {
        phrase: "dripping sword ferns",
        kind: "detail",
        means:
          "A detail cue. “dripping sword ferns” adds specific wet understory so the canopy reads damp and lived-in rather than a dry stock forest.",
      },
      {
        phrase: "photoreal nature documentary",
        kind: "style",
        means:
          "A style lock. “photoreal nature documentary” steers medium and rendering away from fantasy illustration toward documentary realism.",
      },
      {
        phrase: "no people, no faces, no animals, no text, no watermark",
        kind: "constraint",
        means:
          "A constraint. Keeps the plate AdSense-safe and free of watermarks or figure distractions.",
      },
    ],
  },
];
