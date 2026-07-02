import { Timestamp } from 'firebase/firestore';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
};

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(
  cache: Map<string, Intl.DateTimeFormat>,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  let formatter = cache.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    cache.set(locale, formatter);
  }
  return formatter;
}

export function formatDate(timestamp: Timestamp | undefined, locale: string): string {
  if (!timestamp) return '';
  return formatterFor(dateFormatters, locale, DATE_OPTIONS).format(timestamp.toDate());
}

export function formatDateTime(timestamp: Timestamp | undefined, locale: string): string {
  if (!timestamp) return '';
  return formatterFor(dateTimeFormatters, locale, DATE_TIME_OPTIONS).format(timestamp.toDate());
}
