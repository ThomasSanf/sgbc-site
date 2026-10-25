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
  return { title: `${copy.title} — SGBC`, description: copy.introduction };
}

export default async function SalesPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await policyLocale(params), copy = salesPolicy[locale];
  return <div className="sales-policy-page" lang={locale}>
    <header className="sales-policy-header">
      <Link className="wordmark" href="/" aria-label={copy.back}>sgbc<span>™</span></Link>
      <Link className="sales-policy-language" href={`/sales-policy/${locale === 'en' ? 'zh-TW' : 'en'}/`} lang={locale === 'en' ? 'zh-TW' : 'en'}>{copy.language}</Link>
    </header>
    <main className="sales-policy-document">
      <p className="mono sales-policy-date">{copy.updated}</p>
      <h1>{copy.title}</h1>
      <p className="sales-policy-introduction">{copy.introduction}</p>
      <SalesPolicyContent locale={locale}/>
      <Link className="text-link sales-policy-back" href="/"><ArrowLeft size={18} aria-hidden="true"/>{copy.back}</Link>
      <VisitorPrivacy locale={locale}/>
    </main>
  </div>;
}
