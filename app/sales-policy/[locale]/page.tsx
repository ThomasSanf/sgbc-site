import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { ArrowLeft } from 'lucide-react';
import { SalesPolicyContent } from '@/components/sales-policy-content';
import { salesPolicy } from '@/lib/sales-policy';
import { VisitorPrivacy } from '@/components/visitor-tracker';
import { LanguageSwitcher } from '@/components/language-switcher';
import { isFranceVisitor, isLocale, localeHomes } from '@/lib/storefront-locale';

export const dynamicParams = false;
export function generateStaticParams() { return [{ locale: 'en' }, { locale: 'zh-TW' }, { locale: 'fr' }]; }

async function policyLocale(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await policyLocale(params), copy = salesPolicy[locale];
  const title = `${copy.title} — SGBC`, description = copy.introduction;
  const origin = 'https://www.sgbc.tw', url = `${origin}/sales-policy/${locale}/`;
  const image = {
    url: `${origin}/images/sgbc-social-preview-v1.png`, width: 1200, height: 630, type: 'image/png',
    alt: locale === 'fr' ? 'Console SGBC avec coque grise, base noire et détails bordeaux.' : locale === 'zh-TW' ? 'SGBC 主機，經典灰、黑色與酒紅色外殼。' : 'SGBC console in classic gray, black and Bordeaux.',
  };
  return {
    title, description,
    alternates: {
      canonical: url,
      languages: { en: `${origin}/sales-policy/en/`, 'zh-TW': `${origin}/sales-policy/zh-TW/`, 'x-default': `${origin}/sales-policy/en/` },
    },
    robots: { index: locale !== 'fr', follow: true },
    openGraph: { title, description, type: 'website', siteName: 'SGBC', url, locale: locale === 'fr' ? 'fr_FR' : locale === 'zh-TW' ? 'zh_TW' : 'en_US', alternateLocale: locale === 'zh-TW' ? 'en_US' : 'zh_TW', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: image.url, alt: image.alt }] },
  };
}

export default async function SalesPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await policyLocale(params), copy = salesPolicy[locale];
  const allowFrench = isFranceVisitor(await headers());
  if (locale === 'fr' && !allowFrench) redirect('/sales-policy/en/');
  const home = localeHomes[locale];
  return <div className="sales-policy-page" lang={locale}>
    <header className="sales-policy-header">
      <Link className="wordmark" href={home} aria-label={copy.back}>sgbc<span>™</span></Link>
      <LanguageSwitcher locale={locale} allowFrench={allowFrench} policy/>
    </header>
    <main className="sales-policy-document">
      <p className="mono sales-policy-date">{copy.updated}</p>
      <h1>{copy.title}</h1>
      <p className="sales-policy-introduction">{copy.introduction}</p>
      <SalesPolicyContent locale={locale}/>
      <Link className="text-link sales-policy-back" href={home}><ArrowLeft size={18} aria-hidden="true"/>{copy.back}</Link>
      <VisitorPrivacy locale={locale}/>
    </main>
  </div>;
}
