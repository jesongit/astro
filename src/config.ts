export const SITE = {
  website: "https://www.posase.im/",
  author: "Posase",
  profile: "https://www.posase.im/",
  desc: "夜晚潮湿 地面潮湿 空气寂静 树林沉默",
  title: "粥盐籽",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 10,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true,
  editPost: {
    enabled: false,
    text: "Edit page",
    url: "",
  },
  dynamicOgImage: true,
  dir: "ltr",
  lang: "zh-CN",
  timezone: "Asia/Shanghai",
} as const;
