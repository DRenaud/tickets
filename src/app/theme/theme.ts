export interface Theme {
  bg: string;
  bgElevated: string;
  bgHover: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  mint: string;
  mintSoft: string;
  amber: string;
  coral: string;
}

const DARK_THEME: Theme = {
  bg: 'oklch(0.19 0.012 250)',
  bgElevated: 'oklch(0.235 0.014 250)',
  bgHover: 'oklch(0.29 0.016 250)',
  border: 'oklch(1 0 0 / 10%)',
  text: 'oklch(0.94 0.006 250)',
  textMuted: 'oklch(0.66 0.02 250)',
  accent: 'oklch(0.64 0.16 255)',
  accentSoft: 'oklch(0.64 0.16 255 / 18%)',
  mint: 'oklch(0.78 0.15 165)',
  mintSoft: 'oklch(0.78 0.15 165 / 18%)',
  amber: 'oklch(0.75 0.15 70)',
  coral: 'oklch(0.68 0.18 30)',
};

const LIGHT_THEME: Theme = {
  bg: 'oklch(0.98 0.004 90)',
  bgElevated: 'oklch(0.995 0.003 90)',
  bgHover: 'oklch(0.95 0.006 90)',
  border: 'oklch(0 0 0 / 9%)',
  text: 'oklch(0.22 0.01 90)',
  textMuted: 'oklch(0.5 0.015 90)',
  accent: 'oklch(0.55 0.16 255)',
  accentSoft: 'oklch(0.55 0.16 255 / 14%)',
  mint: 'oklch(0.62 0.14 165)',
  mintSoft: 'oklch(0.62 0.14 165 / 14%)',
  amber: 'oklch(0.68 0.15 70)',
  coral: 'oklch(0.6 0.18 30)',
};

export function getTheme(dark: boolean): Theme {
  return dark ? DARK_THEME : LIGHT_THEME;
}

export function priorityColor(theme: Theme, priority: 'low' | 'medium' | 'high'): string {
  return priority === 'high' ? theme.coral : priority === 'medium' ? theme.amber : theme.mint;
}

export function priorityLabelKey(priority: 'low' | 'medium' | 'high'): string {
  return `priority.${priority}`;
}
