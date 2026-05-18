import type { Locale } from '~/i18n';

export interface Project {
  /** Unique slug (used as React-style key). */
  id: string;
  /** Display name. */
  name: string;
  /** Per-locale short description shown on the card. */
  description: Record<Locale, string>;
  /** Optional public URL (deployed site, app store page, etc.). */
  link?: string;
  /** Optional source repository URL. */
  repo?: string;
  /** Tech stack chips. Keep to 5 or fewer for a clean card. */
  tech: string[];
  /** Year string for sorting and display, e.g. "2024" or "2023–2024". */
  year: string;
  /** Featured projects render in the wider hero slot. */
  featured?: boolean;
}

export const projects: Project[] = [
  {
    id: 'my-blog',
    name: 'my-blog',
    description: {
      zh: '你正在看的这个站点。Astro 5 + Tailwind v4 + 中英双语、Pagefind 全文搜索、RSS、Giscus 评论，纯静态部署到 GitHub Pages。',
      en: 'The site you are reading. Astro 5 + Tailwind v4, bilingual, Pagefind search, RSS, Giscus comments — static deploy to GitHub Pages.',
    },
    link: 'https://archer-lan.github.io/my-blog/',
    repo: 'https://github.com/Archer-lan/my-blog',
    tech: ['Astro', 'Tailwind v4', 'TypeScript', 'Pagefind'],
    year: '2026',
    featured: true,
  },
];
