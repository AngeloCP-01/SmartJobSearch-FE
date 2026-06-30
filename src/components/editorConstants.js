// Curated, ATS-safe font stacks (web-safe + a few Google Fonts loaded in index.html).
export const FONTS = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Garamond', value: 'Garamond, "Times New Roman", serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Lato', value: 'Lato, sans-serif' },
  { label: 'Merriweather', value: 'Merriweather, serif' },
];

export const FONT_SIZES = ['8pt', '9pt', '10pt', '10.5pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt', '36pt'];

// Line spacing options (CSS line-height values).
export const LINE_HEIGHTS = [
  { label: 'Single', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: 'Double', value: '2' },
];

export const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8'];

// Swatch defaults shown by the color pickers when the selection has no color mark yet.
export const DEFAULT_TEXT_COLOR = '#000000';
export const DEFAULT_HIGHLIGHT = HIGHLIGHT_COLORS[0];

// Page geometry. Class strings are complete literals so Tailwind emits them.
export const PAGE_SIZES = [
  { label: 'Letter', value: 'Letter' },
  { label: 'A4', value: 'A4' },
];
export const MARGINS = [
  { label: 'Normal', value: 'Normal' },
  { label: 'Narrow', value: 'Narrow' },
  { label: 'Wide', value: 'Wide' },
];
export const PAGE_WIDTH_CLASS = { Letter: 'w-[8.5in]', A4: 'w-[210mm]' };
export const MARGIN_PAD_CLASS = { Normal: 'p-[1in]', Narrow: 'p-[0.5in]', Wide: 'p-[1.5in]' };
