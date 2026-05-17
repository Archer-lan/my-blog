import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from '~/i18n';
import { DEFAULT_LOCALE } from '~/i18n';

export type Post = CollectionEntry<'posts'>;

const isProd = import.meta.env.PROD;

export async function getPublishedPosts(locale?: Locale): Promise<Post[]> {
  const all = await getCollection('posts', ({ data }) => {
    if (isProd && data.draft === true) return false;
    if (locale && (data.lang ?? DEFAULT_LOCALE) !== locale) return false;
    return true;
  });
  return all.sort((a, b) => +b.data.date - +a.data.date);
}

export async function getPinnedPosts(locale?: Locale): Promise<Post[]> {
  const posts = await getPublishedPosts(locale);
  return posts.filter((p) => p.data.pinned);
}

export function estimateReadingTime(body: string): number {
  const cjkChars = (body.match(/[一-龥]/g) || []).length;
  const otherWords = body
    .replace(/[一-龥]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.ceil(cjkChars / 400 + otherWords / 220);
  return Math.max(1, minutes);
}

export function formatDate(d: Date, locale = 'zh-CN'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export type GroupCount = { name: string; count: number; posts: Post[] };

export async function getTagGroups(locale?: Locale): Promise<GroupCount[]> {
  const posts = await getPublishedPosts(locale);
  const map = new Map<string, Post[]>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      const list = map.get(tag) ?? [];
      list.push(post);
      map.set(tag, list);
    }
  }
  return Array.from(map.entries())
    .map(([name, posts]) => ({ name, count: posts.length, posts }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function getCategoryGroups(locale?: Locale): Promise<GroupCount[]> {
  const posts = await getPublishedPosts(locale);
  const map = new Map<string, Post[]>();
  for (const post of posts) {
    const cat = post.data.category;
    const list = map.get(cat) ?? [];
    list.push(post);
    map.set(cat, list);
  }
  return Array.from(map.entries())
    .map(([name, posts]) => ({ name, count: posts.length, posts }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export const POSTS_PER_PAGE = 10;

export async function getAdjacentPosts(
  current: Post,
  locale?: Locale
): Promise<{ prev: Post | null; next: Post | null }> {
  const effectiveLocale = locale ?? (current.data.lang as Locale | undefined);
  const posts = await getPublishedPosts(effectiveLocale);
  const idx = posts.findIndex((p) => p.id === current.id);
  if (idx === -1) return { prev: null, next: null };
  const prev = posts[idx + 1] ?? null;
  const next = posts[idx - 1] ?? null;
  return { prev, next };
}

/**
 * Find the translation pair for a post. Given an English post with
 * `translationOf: <zh-slug>`, returns the linked Chinese post (and vice versa).
 */
export async function findTranslation(
  current: Post
): Promise<Post | null> {
  const all = await getCollection('posts');
  if (current.data.translationOf) {
    return all.find((p) => p.id === current.data.translationOf) ?? null;
  }
  return all.find((p) => p.data.translationOf === current.id) ?? null;
}
