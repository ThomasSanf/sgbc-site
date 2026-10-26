import type { Metadata } from 'next';
import ProductPage from './product-page';
export const metadata: Metadata = { alternates: { canonical: 'https://www.sgbc.tw/' } };
export default function Home() { return <ProductPage />; }
