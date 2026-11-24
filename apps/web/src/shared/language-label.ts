const LANGUAGE_LABELS: Record<string, string> = {
  vi: 'Tiếng Việt', vie: 'Tiếng Việt', en: 'Tiếng Anh', eng: 'Tiếng Anh',
  fr: 'Tiếng Pháp', fra: 'Tiếng Pháp', fre: 'Tiếng Pháp', zh: 'Tiếng Trung',
  zho: 'Tiếng Trung', chi: 'Tiếng Trung', ja: 'Tiếng Nhật', jpn: 'Tiếng Nhật',
  ko: 'Tiếng Hàn', kor: 'Tiếng Hàn', de: 'Tiếng Đức', deu: 'Tiếng Đức',
  ger: 'Tiếng Đức', ru: 'Tiếng Nga', rus: 'Tiếng Nga', es: 'Tiếng Tây Ban Nha',
  spa: 'Tiếng Tây Ban Nha', it: 'Tiếng Ý', ita: 'Tiếng Ý', pt: 'Tiếng Bồ Đào Nha',
  por: 'Tiếng Bồ Đào Nha', ar: 'Tiếng Ả Rập', ara: 'Tiếng Ả Rập',
};

export function languageLabel(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  const normalized = value.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  return LANGUAGE_LABELS[normalized] ?? value;
}
