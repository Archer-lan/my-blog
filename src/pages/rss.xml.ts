import type { APIContext } from 'astro';
import { buildFeed } from '~/lib/rss';

export async function GET(ctx: APIContext) {
  return buildFeed('zh', ctx.site);
}
