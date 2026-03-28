import { useMemo } from 'react';
import { useStore } from '@/contexts/StoreContext';

const DAY_URL: Record<string, string> = {
  Monday: 'https://schema.org/Monday',
  Tuesday: 'https://schema.org/Tuesday',
  Wednesday: 'https://schema.org/Wednesday',
  Thursday: 'https://schema.org/Thursday',
  Friday: 'https://schema.org/Friday',
  Saturday: 'https://schema.org/Saturday',
  Sunday: 'https://schema.org/Sunday',
};

function ensureAbsoluteUrl(url: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

export default function StorefrontJsonLd() {
  const { state } = useStore();
  const settings = state.storeSettings;

  const payload = useMemo(() => {
    const siteUrl = ensureAbsoluteUrl(settings.websiteUrl) || window.location.origin;
    const idBase = siteUrl.replace(/\/$/, '');

    const openingHoursSpecification = (settings.openingHours || [])
      .filter((entry) => !entry.closed && entry.opens && entry.closes)
      .map((entry) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: DAY_URL[entry.dayOfWeek] || `https://schema.org/${entry.dayOfWeek}`,
        opens: entry.opens,
        closes: entry.closes,
      }));

    const postalAddress = settings.addressLine1 && settings.city && settings.countryCode
      ? {
          '@type': 'PostalAddress',
          streetAddress: [settings.addressLine1, settings.addressLine2].filter(Boolean).join(', '),
          addressLocality: settings.city,
          addressRegion: settings.stateOrProvince || undefined,
          postalCode: settings.postalCode || undefined,
          addressCountry: settings.countryCode,
        }
      : undefined;

    const localBusiness: Record<string, unknown> = {
      '@type': settings.businessType || 'Store',
      '@id': `${idBase}#localbusiness`,
      name: settings.name,
      url: siteUrl,
      email: settings.email || undefined,
      telephone: settings.phone || undefined,
      image: ensureAbsoluteUrl(settings.logoUrl) || undefined,
      logo: ensureAbsoluteUrl(settings.logoUrl) || undefined,
      sameAs: (settings.sameAs || []).map(ensureAbsoluteUrl).filter(Boolean),
      priceRange: settings.priceRange || undefined,
      openingHoursSpecification: openingHoursSpecification.length > 0 ? openingHoursSpecification : undefined,
      address: postalAddress,
      hasMap: ensureAbsoluteUrl(settings.googleMapsUrl) || undefined,
    };

    if (typeof settings.geoLat === 'number' && typeof settings.geoLng === 'number') {
      localBusiness.geo = {
        '@type': 'GeoCoordinates',
        latitude: settings.geoLat,
        longitude: settings.geoLng,
      };
    }

    const graph = [
      {
        '@type': 'Organization',
        '@id': `${idBase}#organization`,
        name: settings.name,
        url: siteUrl,
        logo: ensureAbsoluteUrl(settings.logoUrl) || undefined,
        sameAs: (settings.sameAs || []).map(ensureAbsoluteUrl).filter(Boolean),
      },
      {
        '@type': 'WebSite',
        '@id': `${idBase}#website`,
        name: settings.name,
        url: siteUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${idBase}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      localBusiness,
    ];

    return {
      '@context': 'https://schema.org',
      '@graph': graph,
    };
  }, [settings]);

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }} />;
}
