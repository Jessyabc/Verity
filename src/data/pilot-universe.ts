import type { PilotCompany } from './types'

/**
 * Hand-curated pilot universe — replace or sync from a real backend later.
 * No Supabase required: ships with the app bundle.
 */
export const PILOT_COMPANIES: PilotCompany[] = [
  {
    slug: 'microsoft',
    name: 'Microsoft Corporation',
    ticker: 'MSFT',
    exchange: 'NASDAQ',
    logoUrl: 'https://logo.clearbit.com/microsoft.com',
    tagline: 'Cloud, productivity, and AI platform company.',
    overview:
      'Microsoft develops and licenses software, cloud infrastructure (Azure), and devices. ' +
      'For research, prioritize recurring revenue commentary, Azure growth signals, and capex guidance — ' +
      'always read primary materials; this blurb is illustrative only.',
    companyLastCheckedLabel: '2h ago',
    sources: [
      {
        id: 'ir',
        label: 'Investor relations',
        status: 'active',
        lastCheckedLabel: '2h ago',
      },
      {
        id: 'press',
        label: 'Press releases',
        status: 'active',
        lastCheckedLabel: '2h ago',
      },
      {
        id: 'sec-mirror',
        label: 'SEC filings page (automated fetch)',
        status: 'blocked',
        lastCheckedLabel: '—',
        detail: 'robots.txt disallows our crawler on this host in the mock.',
      },
    ],
    updates: [
      {
        id: 'msft-fy25-q2-earnings',
        title: 'FY25 Q2 earnings release & slides',
        sourceCategoryLabel: 'Investor relations',
        detectedLabel: 'New document URL',
        summary:
          'Earnings materials published to IR: press release and accompanying slide deck. ' +
          'Revenue and segment breakdowns appear in the tables on pages 4–7 of the deck (illustrative).',
        lenses: [
          'How does Azure growth reconcile with management’s prior guidance tone?',
          'Where is operating leverage called out vs. deferred to footnotes?',
        ],
        sources: [
          {
            label: 'IR — earnings index (official)',
            url: 'https://www.microsoft.com/investor',
          },
          {
            label: 'Earnings release (PDF, placeholder)',
            url: 'https://www.microsoft.com/investor/reports/ar24',
          },
        ],
      },
    ],
  },
  {
    slug: 'apple',
    name: 'Apple Inc.',
    ticker: 'AAPL',
    exchange: 'NASDAQ',
    logoUrl: 'https://logo.clearbit.com/apple.com',
    tagline: 'Consumer electronics, software, and services.',
    overview:
      'Apple designs and sells hardware (iPhone, Mac, Wearables) and grows high-margin Services. ' +
      'Use IR and filings for unit and margin narrative — not this summary — for any decision-making.',
    companyLastCheckedLabel: '5h ago',
    sources: [
      {
        id: 'ir',
        label: 'Investor relations',
        status: 'active',
        lastCheckedLabel: '5h ago',
      },
      {
        id: 'newsroom',
        label: 'Newsroom / press',
        status: 'active',
        lastCheckedLabel: '5h ago',
      },
      {
        id: 'events',
        label: 'Events & webcasts',
        status: 'error',
        lastCheckedLabel: '1d ago',
        detail: 'Last fetch returned HTTP 503 — will retry on the next run.',
      },
    ],
    updates: [
      {
        id: 'aapl-shareholder-letter',
        title: 'Annual shareholder letter',
        sourceCategoryLabel: 'Investor relations',
        detectedLabel: 'New document URL',
        summary:
          'Letter emphasizes ecosystem retention and services trajectory. Treat all figures as needing ' +
          'verification against the filed PDF.',
        lenses: [
          'Which product lines get narrative emphasis versus a single sentence?',
          'How does management frame China exposure vs. prior letters?',
        ],
        sources: [
          { label: 'IR — leadership & reports', url: 'https://investor.apple.com' },
          {
            label: 'Shareholder letter (PDF, placeholder)',
            url: 'https://investor.apple.com/sec-filings/default.aspx',
          },
        ],
      },
    ],
  },
  {
    slug: 'jpmorgan-chase',
    name: 'JPMorgan Chase & Co.',
    ticker: 'JPM',
    exchange: 'NYSE',
    logoUrl: 'https://logo.clearbit.com/jpmorganchase.com',
    tagline: 'Global banking and markets.',
    overview:
      'JPMorgan is a diversified financial institution: consumer banking, corporate & investment bank, ' +
      'and asset management. Regulatory filings and earnings supplements drive the official signal set.',
    companyLastCheckedLabel: '35m ago',
    sources: [
      {
        id: 'ir',
        label: 'Investor relations',
        status: 'active',
        lastCheckedLabel: '35m ago',
      },
      {
        id: 'press',
        label: 'Press releases',
        status: 'active',
        lastCheckedLabel: '35m ago',
      },
    ],
    updates: [],
  },
  {
    slug: 'alphabet',
    name: 'Alphabet Inc.',
    ticker: 'GOOGL',
    exchange: 'NASDAQ',
    logoUrl: 'https://logo.clearbit.com/google.com',
    tagline: 'Search, ads, cloud, and Other Bets.',
    overview:
      'Alphabet is the holding company for Google and related businesses. Official signal for investors ' +
      'typically flows through earnings, SEC filings, and investor materials — verify numbers in primary docs.',
    companyLastCheckedLabel: '3h ago',
    sources: [
      { id: 'ir', label: 'Investor relations', status: 'active', lastCheckedLabel: '3h ago' },
      { id: 'press', label: 'Press releases', status: 'active', lastCheckedLabel: '3h ago' },
    ],
    updates: [],
  },
  {
    slug: 'amazon',
    name: 'Amazon.com Inc.',
    ticker: 'AMZN',
    exchange: 'NASDAQ',
    logoUrl: 'https://logo.clearbit.com/amazon.com',
    tagline: 'E-commerce, cloud (AWS), and advertising.',
    overview:
      'Amazon combines retail, logistics, and AWS. Segment disclosure and AWS profitability are common ' +
      'focus areas in filings and earnings — this text is summary-level only.',
    companyLastCheckedLabel: '4h ago',
    sources: [
      { id: 'ir', label: 'Investor relations', status: 'active', lastCheckedLabel: '4h ago' },
      {
        id: 'events',
        label: 'Events & webcasts',
        status: 'blocked',
        lastCheckedLabel: '—',
        detail: 'Mock: event CDN blocks automated fetches in V1.',
      },
    ],
    updates: [],
  },
  {
    slug: 'nvidia',
    name: 'NVIDIA Corporation',
    ticker: 'NVDA',
    exchange: 'NASDAQ',
    logoUrl: 'https://logo.clearbit.com/nvidia.com',
    tagline: 'Accelerated computing and AI infrastructure.',
    overview:
      'NVIDIA designs GPUs and data-center platforms. Demand commentary and supply-chain notes in official ' +
      'filings deserve primary-source review before conclusions.',
    companyLastCheckedLabel: '1h ago',
    sources: [
      { id: 'ir', label: 'Investor relations', status: 'active', lastCheckedLabel: '1h ago' },
      { id: 'press', label: 'Press releases', status: 'active', lastCheckedLabel: '1h ago' },
    ],
    updates: [],
  },
  {
    slug: 'berkshire-hathaway',
    name: 'Berkshire Hathaway Inc.',
    ticker: 'BRK.B',
    exchange: 'NYSE',
    logoUrl: 'https://logo.clearbit.com/berkshirehathaway.com',
    tagline: 'Diversified holding company.',
    overview:
      'Berkshire owns operating businesses and large equity positions. Annual letter and 10-K are central ' +
      'primary sources for long-form disclosure.',
    companyLastCheckedLabel: '12h ago',
    sources: [
      { id: 'ir', label: 'Shareholder & SEC communications', status: 'active', lastCheckedLabel: '12h ago' },
      { id: 'sec', label: 'SEC filings index', status: 'active', lastCheckedLabel: '12h ago' },
    ],
    updates: [],
  },
  {
    slug: 'visa',
    name: 'Visa Inc.',
    ticker: 'V',
    exchange: 'NYSE',
    logoUrl: 'https://logo.clearbit.com/visa.com',
    tagline: 'Global payments technology.',
    overview:
      'Visa operates a network connecting financial institutions and merchants. Volume and incentive ' +
      'metrics appear in quarterly materials — extract from originals, not this blurb.',
    companyLastCheckedLabel: '6h ago',
    sources: [
      { id: 'ir', label: 'Investor relations', status: 'active', lastCheckedLabel: '6h ago' },
      { id: 'press', label: 'Newsroom', status: 'active', lastCheckedLabel: '6h ago' },
    ],
    updates: [],
  },
  {
    slug: 'costco',
    name: 'Costco Wholesale Corporation',
    ticker: 'COST',
    exchange: 'NASDAQ',
    logoUrl: 'https://logo.clearbit.com/costco.com',
    tagline: 'Membership warehouses and e-commerce.',
    overview:
      'Costco reports membership trends, comps, and e-commerce mix in official releases. Use filings for ' +
      'precise figures.',
    companyLastCheckedLabel: '8h ago',
    sources: [
      { id: 'ir', label: 'Investor relations', status: 'active', lastCheckedLabel: '8h ago' },
    ],
    updates: [],
  },
  {
    slug: 'tesla',
    name: 'Tesla Inc.',
    ticker: 'TSLA',
    exchange: 'NASDAQ',
    logoUrl: 'https://logo.clearbit.com/tesla.com',
    tagline: 'Electric vehicles, energy, and software.',
    overview:
      'Tesla discloses production, deliveries, and energy deployment in shareholder updates and SEC filings. ' +
      'Narrative moves quickly — prioritize primary sources.',
    companyLastCheckedLabel: '45m ago',
    sources: [
      { id: 'ir', label: 'Investor relations', status: 'active', lastCheckedLabel: '45m ago' },
      {
        id: 'press',
        label: 'News / blog',
        status: 'error',
        lastCheckedLabel: '2h ago',
        detail: 'Mock: intermittent timeout on last crawl — retry scheduled.',
      },
    ],
    updates: [],
  },
]

const bySlug = new Map(PILOT_COMPANIES.map((c) => [c.slug, c]))

export function getPilotCompanyBySlug(slug: string): PilotCompany | undefined {
  return bySlug.get(slug)
}
