import type { Metadata } from 'next';
import './globals.css';
const title = 'SGBC — A new home for your classics.';
const description = 'Meet SGBC. An FPGA console designed around original Game Boy, Game Boy Color, and Game Boy Advance cartridges. Explore the Rev C design in three dimensions.';
export const metadata: Metadata = { metadataBase: new URL('https://sgbc-console.amused-mug-9271.chatgpt.site'), title, description, openGraph: { title, description, type: 'website' }, twitter: { card: 'summary', title, description }, icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
