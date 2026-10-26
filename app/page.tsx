import ProductPage from './product-page';
import { SiteStructuredData } from '@/components/site-structured-data';
import { homeMetadata } from '@/lib/seo';
export const metadata = homeMetadata('en');
export default function Home() { return <><SiteStructuredData locale="en"/><ProductPage locale="en"/></>; }
