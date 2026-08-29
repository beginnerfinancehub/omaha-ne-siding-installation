// Central site facts. One place to change the phone number, service area,
// and business identity so every page and every schema block stays in sync.
// Per the quality bar (D6): no fabricated trust signals, no invented history.

export const SITE = {
  name: 'Omaha Siding Installation Pros',
  domain: 'omahanesidinginstall.com',
  url: 'https://omahanesidinginstall.com',
  // Real Twilio number, provisioned 2026-08-28 (531 overlay code, listed
  // locality Omaha, NE; the 402-prefix search returned only small rural
  // exchanges, not Omaha itself, so 531 was the Chair-approved choice).
  phoneDisplay: '(531) 233-2741',
  phoneHref: 'tel:+15312332741',
  hours: '7am to 7pm, 7 days',
  email: 'localleadsops@gmail.com',
  areaServed: ['Omaha', 'Papillion', 'La Vista', 'Bellevue', 'Ralston', 'Elkhorn', 'Gretna'],
  // No street address: this is a lead-generation site, not a physical
  // storefront. Publishing a fabricated address would breach D6. City/state
  // only is honest and is the standard pattern for a service-area business.
  leadForm: {
    heading: 'Tell us about the job, get a number',
    note: "Send the details and you'll get a real quote back the same day, 7am to 7pm.",
    messageLabel: 'Tell us about the project',
    messagePlaceholder: 'New siding install, a repair, storm or hail damage, and roughly how old the current siding is.',
    photoLabel: 'Photo of the siding (optional)',
  },
  addressLocality: 'Omaha',
  addressRegion: 'NE',
  addressCountry: 'US',
};

export function localBusinessSchema({ pageUrl, description, extraServices = [] }) {
  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
    name: SITE.name,
    url: pageUrl,
    telephone: SITE.phoneHref.replace('tel:', ''),
    description,
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE.addressLocality,
      addressRegion: SITE.addressRegion,
      addressCountry: SITE.addressCountry,
    },
    areaServed: SITE.areaServed.map((city) => ({ '@type': 'City', name: `${city}, NE` })),
    priceRange: '$$',
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '07:00',
      closes: '19:00',
    },
    ...(extraServices.length
      ? { makesOffer: extraServices.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s } })) }
      : {}),
  };
}

export function faqSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
