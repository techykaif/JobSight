export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlValidationError';
  }
}

const DENYLIST_DOMAINS = [
  'google.com',
  'www.google.com',
  'bing.com',
  'www.bing.com',
  'yahoo.com',
  'www.yahoo.com',
  'duckduckgo.com',
  'www.duckduckgo.com',
  'baidu.com',
  'www.baidu.com',
  'yandex.com',
  'www.yandex.com'
];

const GENERIC_PATHS = [
  '/',
  '',
  '/careers',
  '/careers/',
  '/jobs',
  '/jobs/'
];

export function validateOriginalJobUrl(urlStr: string | null | undefined): string {
  if (!urlStr || typeof urlStr !== 'string' || urlStr.trim() === '') {
    throw new UrlValidationError('URL is missing or empty');
  }

  let url: URL;
  try {
    url = new URL(urlStr.trim());
  } catch {
    throw new UrlValidationError('URL is malformed or relative');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlValidationError(`Invalid protocol: ${url.protocol}`);
  }

  if (url.host === 'jobsight.app' || url.host.startsWith('localhost:')) {
    throw new UrlValidationError('Internal JobSight URL not allowed as original job post');
  }

  const lowerHost = url.hostname.toLowerCase();
  if (DENYLIST_DOMAINS.includes(lowerHost)) {
    throw new UrlValidationError(`Search engine or aggregator domain rejected: ${url.hostname}`);
  }

  const lowerPath = url.pathname.toLowerCase();
  if (GENERIC_PATHS.includes(lowerPath)) {
    throw new UrlValidationError(`Generic company homepage or careers landing page rejected: ${url.pathname}`);
  }

  return url.toString();
}
