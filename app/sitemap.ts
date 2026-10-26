import type { MetadataRoute } from 'next';

const origin = 'https://www.sgbc.tw';
const homes = { en: origin + '/', 'zh-TW': origin + '/zh-TW/', 'x-default': origin + '/' };
const policies = { en: origin + '/sales-policy/en/', 'zh-TW': origin + '/sales-policy/zh-TW/', 'x-default': origin + '/sales-policy/en/' };

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: homes.en, alternates: { languages: homes }, images: [origin + '/images/sgbc-social-preview-v1.png'] },
    { url: homes['zh-TW'], alternates: { languages: homes }, images: [origin + '/images/sgbc-social-preview-v1.png'] },
    { url: policies.en, alternates: { languages: policies } },
    { url: policies['zh-TW'], alternates: { languages: policies } },
  ];
}
