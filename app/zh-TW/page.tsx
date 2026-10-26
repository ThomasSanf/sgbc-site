import ProductPage from '../product-page';
import { SiteStructuredData } from '@/components/site-structured-data';
import { homeMetadata } from '@/lib/seo';
export const metadata = homeMetadata('zh-TW');
export default function TaiwanHome() { return <><SiteStructuredData locale="zh-TW"/><ProductPage locale="zh-TW"/></>; }
