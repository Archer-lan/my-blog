import type { Dict } from './types';
import { zh } from './zh';
import { en } from './en';

export type { Dict };

export type Locale = 'zh' | 'en';
export const LOCALES: readonly Locale[] = ['zh', 'en'] as const;
export const DEFAULT_LOCALE: Locale = 'zh';

const dicts: Record<Locale, Dict> = { zh, en };

export function t(locale: Locale): Dict {
  return dicts[locale] ?? dicts[DEFAULT_LOCALE];
}

/**
 * Extract locale from a URL pathname. The site's `base` (e.g. `/my-blog`) is
 * stripped first. `/en/...` → 'en'; anything else → default.
 */
export function getLocaleFromPath(pathname: string, base: string): Locale {
  const stripped = pathname.replace(base.replace(/\/$/, ''), '') || '/';
  if (stripped === '/en' || stripped.startsWith('/en/')) return 'en';
  return DEFAULT_LOCALE;
}

export function getLocale(url: URL): Locale {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return getLocaleFromPath(url.pathname, base);
}

/**
 * Build a locale-prefixed href. Default locale has no prefix.
 * - localizedHref('zh', '/posts') → '/my-blog/posts'
 * - localizedHref('en', '/posts') → '/my-blog/en/posts'
 */
export function localizedHref(locale: Locale, path: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return `${base}${prefix}${cleanPath}`;
}
