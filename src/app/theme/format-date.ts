import { Timestamp } from 'firebase/firestore';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(timestamp: Timestamp | undefined): string {
  if (!timestamp) return '';
  return dateFormatter.format(timestamp.toDate());
}

export function formatDateTime(timestamp: Timestamp | undefined): string {
  if (!timestamp) return '';
  return dateTimeFormatter.format(timestamp.toDate());
}
