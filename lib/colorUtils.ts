/**
 * Contrast logic (YIQ luminance):
 * returns readable foreground color '#FFFFFF' or '#0F172A'
 */
export function getContrastTextColor(hexColor: string | null | undefined): string {
  if (!hexColor || !/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
    return "#0F172A";
  }
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#0F172A" : "#FFFFFF";
}
