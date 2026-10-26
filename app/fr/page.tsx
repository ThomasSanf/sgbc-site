import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import ProductPage from '../product-page';
import { SiteStructuredData } from '@/components/site-structured-data';
import { homeMetadata } from '@/lib/seo';
import { isFranceVisitor } from '@/lib/storefront-locale';

export const metadata = homeMetadata('fr');
export default async function FrenchHome() {
  if (!isFranceVisitor(await headers())) redirect('/');
  return <><SiteStructuredData locale="fr"/><ProductPage locale="fr" allowFrench/></>;
}
