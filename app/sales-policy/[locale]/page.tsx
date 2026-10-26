import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { SalesPolicyContent } from '@/components/sales-policy-content';
import { salesPolicy } from '@/lib/sales-policy';
import { VisitorPrivacy } from '@/components/visitor-tracker';

export const dynamicParams = false;
export function generateStaticParams() { return [{ locale: 'en' }, { locale: 'zh-TW' }]; }

async function policyLocale(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (locale !== 'en' && locale !== 'zh-TW') notFound();
  return locale;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await policyLocale(params), copy = salesPolicy[locale];
  const title = `${copy.title} — SGBC`, description = copy.introduction;
  const origin = 'https://www.sgbc.tw', url = `${origin}/sales-policy/${locale}/`;
  const image = {
    url: `${origin}/images/sgbc-social-preview-v1.png`, width: 1200, height: 630, type: 'image/png',
    alt: locale === 'zh-TW' ? 'SGBC 主機，經典灰、黑色與酒紅色外殼。' : 'SGBC console in classic gray, black and Bordeaux.',
  };
  return {
    title, description,
    alternates: {
      canonical: url,
      languages: { en: `${origin}/sales-policy/en/`, 'zh-TW': `${origin}/sales-policy/zh-TW/`, 'x-default': `${origin}/sales-policy/en/` },
    },
    openGraph: { title, description, type: 'website', siteName: 'SGBC', url, locale: locale === 'zh-TW' ? 'zh_TW' : 'en_US', alternateLocale: locale === 'zh-TW' ? 'en_US' : 'zh_TW', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: image.url, alt: image.alt }] },
  };
}

export default async function SalesPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await policyLocale(params), copy = salesPolicy[locale];
  const home = locale === 'zh-TW' ? '/zh-TW/' : '/';
  return <div className="sales-policy-page" lang={locale}>
    <header className="sales-policy-header">
      <Link className="wordmark" href={home} aria-label={copy.back}>sgbc<span>™</span></Link>
      <Link className="sales-policy-language" href={`/sales-policy/${locale === 'en' ? 'zh-TW' : 'en'}/`} lang={locale === 'en' ? 'zh-TW' : 'en'}>{copy.language}</Link>
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
