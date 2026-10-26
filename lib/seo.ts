import type { Metadata } from 'next';
import { siteCopy, type Locale } from '@/lib/site-copy';
import { localeHomes } from '@/lib/storefront-locale';

export const siteOrigin = 'https://www.sgbc.tw';
export const homePaths = localeHomes;
export const socialImage = {
  url: siteOrigin + '/images/sgbc-social-preview-v1.png',
  width: 1200, height: 630, type: 'image/png',
  alt: 'SGBC console in classic gray, black and Bordeaux. Old soul. New hardware.',
};

export function homeMetadata(locale: Locale): Metadata {
  const { title, description } = siteCopy[locale].meta;
  const zh = locale === 'zh-TW';
  const french = locale === 'fr';
  const image = { ...socialImage, alt: french ? 'Console FPGA SGBC : coque grise, base noire et boutons bordeaux.' : zh ? 'SGBC FPGA 主機：經典灰上蓋、黑色底座與酒紅色按鈕。' : socialImage.alt };
  return {
    title, description,
    alternates: {
      canonical: siteOrigin + homePaths[locale],
      languages: { en: siteOrigin + '/', 'zh-TW': siteOrigin + '/zh-TW/', 'x-default': siteOrigin + '/' },
    },
    robots: { index: !french, follow: true, googleBot: { index: !french, follow: true, 'max-image-preview': 'large' } },
    openGraph: {
      title, description, type: 'website', siteName: 'SGBC', url: siteOrigin + homePaths[locale],
      locale: french ? 'fr_FR' : zh ? 'zh_TW' : 'en_US', alternateLocale: french ? ['en_US', 'zh_TW'] : [zh ? 'en_US' : 'zh_TW'], images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: image.url, alt: image.alt }] },
  };
}
