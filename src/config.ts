export const SITE = {
  title: 'lan 的博客',
  description: '关于工程、设计与思考的碎片记录。',
  author: 'Archer-lan',
  url: 'https://archer-lan.github.io',
  base: '/my-blog',
  locale: 'zh-CN',
} as const;

export const NAV = [
  { href: '/', label: '首页' },
  { href: '/posts', label: '文章' },
  { href: '/categories', label: '分类' },
  { href: '/tags', label: '标签' },
] as const;

export const SOCIAL = {
  github: 'https://github.com/Archer-lan',
  rss: '/rss.xml',
} as const;

/**
 * Giscus comments config.
 *
 * Fill in `repoId` and `categoryId` after running https://giscus.app/zh-CN
 * configurator. Until both are non-empty, the comments section is hidden.
 *
 * `mapping: pathname` ties each discussion to a post URL — survives title
 * edits but breaks if you change the slug. `data-strict="0"` lets giscus
 * use the closest match if exact pathname isn't found.
 */
export const GISCUS = {
  repo: 'Archer-lan/my-blog',
  repoId: '',
  category: 'Comments',
  categoryId: '',
  mapping: 'pathname',
  strict: '0',
  reactionsEnabled: '1',
  emitMetadata: '0',
  inputPosition: 'bottom',
  theme: 'preferred_color_scheme',
} as const;

export const isGiscusEnabled = (): boolean =>
  GISCUS.repoId.length > 0 && GISCUS.categoryId.length > 0;
