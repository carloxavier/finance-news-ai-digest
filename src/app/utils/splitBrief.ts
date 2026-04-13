// Split brief text into sentences for bullet-point rendering.
// Keeps trailing citation markers like [1] attached to their sentence.
export function splitBriefIntoPoints(text: string): string[] {
  const sentences = text.match(/[^.!?]+(?:[.!?]+(?:\s*\[\d+\])*)+/g) || [text];
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}
