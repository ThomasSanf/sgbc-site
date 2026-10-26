import type { Metadata } from 'next';
import { siteCopy, type Locale } from '@/lib/site-copy';

export const siteOrigin = 'https://www.sgbc.tw';
export const homePaths: Record<Locale, string> = { en: '/', 'zh-TW': '/zh-TW/' };
export const socialImage = {
  url: siteOrigin + '/images/sgbc-social-preview-v1.png',
  width: 1200, height: 630, type: 'image/png',
  alt: 'SGBC console in classic gray, black and Bordeaux. Old soul. New hardware.',
};

export function homeMetadata(locale: Locale): Metadata {
  const { title, description } = siteCopy[locale].meta;
  const zh = locale === 'zh-TW';
  const image = { ...socialImage, alt: zh ? 'SGBC FPGA 主機：經典灰上蓋、黑色底座與酒紅色按鈕。' : socialImage.alt };
  return {
    title, description,
    alternates: {
      canonical: siteOrigin + homePaths[locale],
      languages: { en: siteOrigin + '/', 'zh-TW': siteOrigin + '/zh-TW/', 'x-default': siteOrigin + '/' },
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
    openGraph: {
      title, description, type: 'website', siteName: 'SGBC', url: siteOrigin + homePaths[locale],
      locale: zh ? 'zh_TW' : 'en_US', alternateLocale: [zh ? 'en_US' : 'zh_TW'], images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: image.url, alt: image.alt }] },
  };
}
