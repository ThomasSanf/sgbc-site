import type { Metadata } from 'next';
import './globals.css';
import { VisitorTracker } from '@/components/visitor-tracker';
import { siteOrigin, socialImage } from '@/lib/seo';
import { siteCopy } from '@/lib/site-copy';
const { title, description } = siteCopy.en.meta;
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin), applicationName: 'SGBC',
  openGraph: { title, description, type: 'website', siteName: 'SGBC', url: siteOrigin + '/', images: [socialImage] },
  twitter: { card: 'summary_large_image', title, description, images: [{ url: socialImage.url, alt: socialImage.alt }] },
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<VisitorTracker/></body></html>; }
