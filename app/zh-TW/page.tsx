import { headers } from 'next/headers';
import ProductPage from '../product-page';
import { SiteStructuredData } from '@/components/site-structured-data';
import { homeMetadata } from '@/lib/seo';
import { isFranceVisitor } from '@/lib/storefront-locale';

export const metadata = homeMetadata('zh-TW');
export default async function TaiwanHome() { return <><SiteStructuredData locale="zh-TW"/><ProductPage locale="zh-TW" allowFrench={isFranceVisitor(await headers())}/></>; }
