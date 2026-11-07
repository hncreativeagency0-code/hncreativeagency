/* Case studies are published ONLY with the client's written permission.
   Add an entry when you have: before/after images, a measurable result and the client's OK.
   Images go in /public/case-studies/<slug>/ (they fall back to a branded placeholder if missing).

   Example:
   {
     slug: 'chai-khana-rebrand', client: 'Chai Khana, Lahore', service: 'Branding', year: '2026',
     title: 'A warmer brand for a neighbourhood café',
     challenge: 'The old logo was hard to read on signage and social media.',
     solution: 'New logo, menu and storefront sign designed in two weeks.',
     results: ['Walk-in enquiries up 30% in the first month (client-reported)'],
     before: '/case-studies/chai-khana/before.jpg', after: '/case-studies/chai-khana/after.jpg',
     quote: 'Optional quote — only with permission', quoteBy: 'Owner name',
     permission: true,
   },
*/
export interface CaseStudy {
  slug: string; client: string; service: string; year: string; title: string;
  challenge: string; solution: string; results: string[];
  before?: string; after: string; quote?: string; quoteBy?: string; link?: string;
  permission: true;
}

export const CASE_STUDIES: CaseStudy[] = [];

/** Studio portfolio images carried over from the original agency website. */
export const STUDIO_WORK = [
  { n: 1, t: 'Brand identity', c: 'Branding' }, { n: 2, t: 'Corporate website', c: 'Web Design' },
  { n: 3, t: 'Social media campaign', c: 'Social Media' }, { n: 4, t: 'Marketing pack', c: 'Graphic Design' },
  { n: 5, t: 'Brand system', c: 'Branding' }, { n: 6, t: 'Landing page', c: 'Web Design' },
];
