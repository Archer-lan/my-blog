export interface Dict {
  htmlLang: string;
  dateLocale: string;
  nav: {
    home: string;
    posts: string;
    categories: string;
    tags: string;
  };
  home: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    featured: string;
    latest: string;
    viewAll: string;
    emptyPosts: string;
  };
  archive: {
    eyebrow: string;
    title: string;
    countLine: (n: number, page: number, total: number) => string;
  };
  tags: {
    eyebrow: string;
    title: string;
    count: (n: number) => string;
    backToAll: string;
    perTagCount: (n: number) => string;
    empty: string;
    emptyAll: string;
  };
  categories: {
    eyebrow: string;
    title: string;
    count: (n: number) => string;
    latestLabel: string;
    backToAll: string;
    perCatCount: (n: number) => string;
    empty: string;
    emptyAll: string;
  };
  post: {
    minRead: (n: number) => string;
    tocTitle: string;
    backToList: string;
    updatedAt: (date: string) => string;
    prev: string;
    next: string;
    copy: string;
    copied: string;
    copyFailed: string;
  };
  pagination: {
    prev: string;
    next: string;
  };
  footer: {
    rights: (year: number, author: string) => string;
  };
  langSwitch: {
    toEn: string;
    toZh: string;
    ariaToEn: string;
    ariaToZh: string;
  };
  search: {
    triggerAria: string;
    placeholder: string;
    hint: string;
    empty: string;
    noResults: (q: string) => string;
    loading: string;
    error: string;
    closeAria: string;
    kbdHint: string;
  };
  comments: {
    title: string;
    loading: string;
    disabledHint: string;
  };
}
