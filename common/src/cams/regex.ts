export function escapeRegExCharacters(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
