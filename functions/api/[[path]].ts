import { createD1Store, type D1Database, type R2Bucket } from "../lib/d1.ts";
import { handleApi } from "../lib/handler.ts";
import { handleThumbs } from "../lib/thumbs.ts";
import { handleScores } from "../lib/scores.ts";
import type { AuthEnv } from "../lib/types.ts";

interface Env extends AuthEnv {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  AI?: { run(model: string, input: unknown): Promise<unknown> };
  SCORE_SALT?: string;
  ASSETS?: { fetch(input: Request | string): Promise<Response> };
}

export const onRequest = async (context: { request: Request; env: Env }) => {
  if (!context.env.DB) {
    return Response.json({
      error: "PromptShare needs a D1 database bound as DB before accounts and uploads work on Cloudflare.",
      bindings: ["DB", "MEDIA"],
    }, { status: 503, headers: { "content-type": "application/json; charset=utf-8" } });
  }
  const scores = await handleScores(context.request, context.env.DB, context.env);
  if (scores) return scores;
  const thumbs = await handleThumbs(context.request, context.env.DB);
  if (thumbs) return thumbs;
  const store = createD1Store(context.env.DB, context.env.MEDIA);
  return handleApi(context.request, store, context.env);
};
