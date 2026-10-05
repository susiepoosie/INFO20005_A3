// Wording for specimen labels, shared by the display and the mounting page.

const dateFormat = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

export const catalogueNumber = (id) => `No. ${String(id).padStart(4, '0')}`;

export function labelDetails({ collector, locality, createdAt }) {
  return [`Collected by ${collector}`, locality, dateFormat.format(createdAt)].filter(Boolean).join(' · ');
}

export const labelDescription = () =>
  "Left wing: the collector's mother. Right wing: the collector. Body: the two, superimposed.";

// A Latin-style species name from the collector's first name, e.g. "Susan" → "Matrilinea susanae".
export function suggestSpecies(collector) {
  const name = collector
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)[0]
    .replace(/[^a-z]/g, '');
  if (!name) return 'Matrilinea incognita';
  return `Matrilinea ${name.endsWith('a') ? `${name}e` : `${name}ae`}`;
}
