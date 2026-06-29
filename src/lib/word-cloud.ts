import type { Message } from "@/types"

const STOP_WORDS = new Set([
  // English
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "is", "it", "this", "that", "are", "was", "be",
  "have", "has", "had", "not", "no", "do", "does", "did", "will",
  "would", "can", "could", "should", "may", "might", "i", "you", "he",
  "she", "we", "they", "me", "my", "your", "his", "her", "its", "our",
  "their", "what", "which", "who", "when", "where", "how", "all",
  "each", "every", "both", "few", "more", "most", "other", "some",
  "such", "than", "too", "very", "just", "if", "so", "as", "from",
  // Spanish
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del",
  "en", "con", "por", "para", "es", "son", "fue", "ser", "estar",
  "hay", "que", "se", "no", "si", "yo", "tu", "su", "nos", "les",
  "lo", "al", "como", "pero", "mas", "ya", "muy", "este", "esta",
  "estos", "eso", "esa", "todo", "bien", "aqui", "donde",
])

export function extractWordFrequencies(
  messages: Message[],
  topN = 5
): { word: string; count: number }[] {
  const counts = new Map<string, number>()

  for (const msg of messages) {
    const words = msg.content
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))

    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }))
}
