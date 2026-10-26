import { homePaths, siteOrigin, socialImage } from '@/lib/seo';
import { siteCopy, type Locale } from '@/lib/site-copy';

export function SiteStructuredData({ locale }: { locale: Locale }) {
  const url = siteOrigin + homePaths[locale];
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': siteOrigin + '/#organization', name: 'SGBC', url: siteOrigin + '/' },
      {
        '@type': 'WebSite', '@id': siteOrigin + '/#website', name: 'SGBC', alternateName: 'SGBC FPGA Console',
        url: siteOrigin + '/', inLanguage: ['en', 'zh-TW'], publisher: { '@id': siteOrigin + '/#organization' },
      },
      {
        '@type': 'WebPage', '@id': url + '#webpage', url, name: siteCopy[locale].meta.title,
        description: siteCopy[locale].meta.description, inLanguage: locale,
        isPartOf: { '@id': siteOrigin + '/#website' },
        primaryImageOfPage: { '@type': 'ImageObject', url: socialImage.url, width: socialImage.width, height: socialImage.height },
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}/>;
}
