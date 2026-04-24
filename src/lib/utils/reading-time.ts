/**
 * Calculate estimated reading time from text content
 * Average reading speed: 200-250 words per minute (we use 200 for comfortable reading)
 */

const WORDS_PER_MINUTE = 200;

/**
 * Extract plain text from TipTap JSON content
 */
export function extractTextFromTipTap(content: Record<string, unknown> | null): string {
  if (!content || !content.content || !Array.isArray(content.content)) {
    return "";
  }

  const extractText = (nodes: unknown[]): string => {
    return nodes
      .map((node) => {
        if (typeof node !== "object" || node === null) return "";

        const n = node as Record<string, unknown>;

        // If node has text, return it
        if (typeof n.text === "string") {
          return n.text;
        }

        // If node has content array, recurse
        if (Array.isArray(n.content)) {
          return extractText(n.content);
        }

        return "";
      })
      .join(" ");
  };

  return extractText(content.content as unknown[]);
}

/**
 * Count words in a string
 */
export function countWords(text: string): number {
  if (!text) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Calculate reading time in minutes from TipTap content
 */
export function calculateReadingTime(content: Record<string, unknown> | null): number {
  const text = extractTextFromTipTap(content);
  const wordCount = countWords(text);
  const minutes = Math.ceil(wordCount / WORDS_PER_MINUTE);
  return Math.max(1, minutes); // Minimum 1 minute
}

/**
 * Format reading time for display
 */
export function formatReadingTime(minutes: number): string {
  if (minutes <= 1) {
    return "1 min de lecture";
  }
  return `${minutes} min de lecture`;
}

/**
 * Get formatted reading time from TipTap content
 */
export function getReadingTime(content: Record<string, unknown> | null): string {
  const minutes = calculateReadingTime(content);
  return formatReadingTime(minutes);
}
