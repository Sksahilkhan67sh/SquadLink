const ACCENTS = ['#f2691c', '#9aa0a8', '#5fb87a', '#e0a53a', '#8a8fc9', '#e0503a']

export function communityAccent(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return ACCENTS[hash % ACCENTS.length]
}
