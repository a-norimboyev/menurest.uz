/**
 * Matndan qavs ichidagi barcha so'zlar va qavslarni olib tashlaydi.
 * Masalan: "Choyxona Oshi (Qo'y go'shti)" -> "Choyxona Oshi"
 */
export function stripParentheses(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\s*\([^)]*\)/g, '').trim();
}
