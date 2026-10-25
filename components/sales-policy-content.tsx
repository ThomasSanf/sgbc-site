import { salesPolicy } from '@/lib/sales-policy';
import type { Locale } from '@/lib/site-copy';

export function SalesPolicyContent({ locale, heading = 'h2' }: { locale: Locale; heading?: 'h2' | 'h3' }) {
  const copy = salesPolicy[locale];
  const Heading = heading;
  return <div className="sales-policy-content" lang={locale}>
    {copy.sections.map(section => <section key={section.title}>
      <Heading>{section.title}</Heading>
      {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
    </section>)}
    <p className="sales-policy-rights">{copy.rights}</p>
  </div>;
}
