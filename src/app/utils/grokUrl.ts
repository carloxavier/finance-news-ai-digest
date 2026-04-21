// Builds a deep-link URL into Grok (https://grok.com) with an article
// headline + canonical URL preloaded as the prompt. Used by the
// "Ask AI about this article" CTA on the article detail page.
//
// The `?q=` query-param pattern is empirically observed from
// grok.com's own landing page; xAI does not publish this as a documented
// contract. If Grok ever renames the param, the smoke test (Ask-AI
// subscriber path) continues to pass — it only checks the URL starts with
// `https://grok.com/?q=` — so add human monitoring of click-through rates
// when we actually launch, and be ready to swap providers or formats if
// conversions suddenly drop.

export function buildGrokUrl(headline: string, articleId: string): string {
  const prompt = [
    "Explain this finance news article for a retail investor in 3 short points:",
    "(1) core takeaway, (2) tickers/sectors affected, (3) what to watch next.",
    "",
    `Headline: "${headline}"`,
    `URL: https://finnopolis.com/article/${articleId}`,
  ].join("\n");
  return `https://grok.com/?q=${encodeURIComponent(prompt)}`;
}
