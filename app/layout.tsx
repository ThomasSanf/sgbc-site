import type { Metadata } from 'next';
import './globals.css';
import { VisitorTracker } from '@/components/visitor-tracker';
const title = 'SGBC — A new home for your classics.';
const description = 'Meet SGBC. An FPGA console designed around original Game Boy, Game Boy Color, and Game Boy Advance cartridges. Explore the Rev C design in three dimensions.';
const socialImage = {
  url: 'https://www.sgbc.tw/images/sgbc-social-preview-v1.png',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'SGBC console in classic gray, black and Bordeaux. Old soul. New hardware.',
};
export const metadata: Metadata = {
  metadataBase: new URL('https://www.sgbc.tw'),
  openGraph: { title, description, type: 'website', siteName: 'SGBC', url: 'https://www.sgbc.tw/', images: [socialImage] },
  twitter: { card: 'summary_large_image', title, description, images: [{ url: socialImage.url, alt: socialImage.alt }] },
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<VisitorTracker/></body></html>; }
