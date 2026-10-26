import { headers } from 'next/headers';
import ProductPage from './product-page';
import { SiteStructuredData } from '@/components/site-structured-data';
import { homeMetadata } from '@/lib/seo';
import { isFranceVisitor } from '@/lib/storefront-locale';

export const metadata = homeMetadata('en');
export default async function Home() { return <><SiteStructuredData locale="en"/><ProductPage locale="en" allowFrench={isFranceVisitor(await headers())}/></>; }
