import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import sanitizeHtml from 'sanitize-html';
import MarkdownIt from 'markdown-it';
import type { Locale } from '~/i18n';
import { localizedHref, t } from '~/i18n';
import { SITE } from '~/config';

const md = MarkdownIt({ html: true, linkify: true });

const MAX_ITEMS = 20;

export async function buildFeed(
  locale: Locale,
  site: URL | undefined
): Promise<Response> {
  if (!site) {
    throw new Error('Astro.site is not configured');
  }
  const dict = t(locale);
  const all = await getCollection('posts', ({ data }) => {
    if (data.draft === true) return false;
    return (data.lang ?? 'zh') === locale;
  });
  const items = all
    .sort((a, b) => +b.data.date - +a.data.date)
    .slice(0, MAX_ITEMS);

  // Build a fully-qualified URL by combining the site origin with the
  // locale-aware path (which already includes the base prefix).
  const url = (path: string) => new URL(path, site).toString();

  return rss({
    title:
      locale === 'zh'
        ? `${SITE.title} · ${dict.archive.title}`
        : `${SITE.title} · ${dict.archive.title}`,
    description: SITE.description,
    site: url(localizedHref(locale, '/')),
    items: items.map((post) => ({
      link: url(localizedHref(locale, `/posts/${post.id}`)),
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      categories: [post.data.category, ...post.data.tags],
      content: sanitizeHtml(md.render(post.body ?? ''), {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ['src', 'alt', 'title'],
          a: ['href', 'name', 'target', 'rel'],
        },
      }),
    })),
    customData: `<language>${dict.htmlLang}</language>`,
  });
}
