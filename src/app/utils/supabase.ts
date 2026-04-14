const SUPABASE_URL = 'https://kamfamwjswkncftsdgxi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthbWZhbXdqc3drbmNmdHNkZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDQ3NDgsImV4cCI6MjA4ODY4MDc0OH0.O8NasVjjajK-T18GppCjfljS_h30fNrPo3TgPJGmcEs';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
};

export interface Topic {
  id: string;
  slug: string;
  display_name: string;
  dimension: 'industry' | 'theme' | 'geography';
}

export interface Article {
  id: string;
  headline: string;
  publication: string;
  published_at: string;
  ai_preview: string;
  consensus_signal: 'BUY' | 'SELL' | 'MIXED' | 'NO_RATING';
  extracted_tickers: string[];
}

export interface Citation {
  n: number;
  source: string;
  label: string;
  url: string;
}

export interface AnalystRecommendation {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface AnalystData {
  recommendation: AnalystRecommendation;
  priceTarget: {
    mean: number;
    high: number;
    low: number;
  };
  currentPrice: number;
  targetGap: number;
  metric: {
    peRatio: number;
    revenueGrowthTTM: number;
  };
}

export interface ArticleDetail extends Article {
  brief: string;
  citations: Citation[];
  analyst_data: Record<string, AnalystData>;
  inference_watch: string[];
  inference_risks: string[];
  inference_questions: string[];
}

export async function getTopics(): Promise<Topic[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/topics?select=id,slug,display_name,dimension&order=dimension,display_name`,
    { headers }
  );
  if (!response.ok) throw new Error('Failed to fetch topics');
  return response.json();
}

export async function saveUserInterests(userId: string, topicIds: string[]): Promise<void> {
  // First delete existing interests
  const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_interests?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers,
  });
  
  console.log('Delete interests response:', deleteResponse.status);

  // Then insert new interests
  const interests = topicIds.map(topic_id => ({ user_id: userId, topic_id }));
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/user_interests`, {
    method: 'POST',
    headers: {
      ...headers,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(interests),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Save interests error:', response.status, errorText);
    throw new Error(`Failed to save user interests: ${response.status}`);
  }
  
  console.log('Saved interests for user:', userId, 'topics:', topicIds);
}

export async function getUserFeed(userId: string, limit: number = 20): Promise<Article[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    // The get_user_feed RPC returns ranked article IDs, not full article objects.
    // We need a second query to fetch the full article data.
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_feed`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_user_id: userId, p_limit: limit }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Feed RPC response:', data);

      if (Array.isArray(data) && data.length > 0) {
        // Extract article IDs from the RPC response
        const ids = data.map((r: Record<string, unknown>) =>
          (r.article_id ?? r.id) as string
        ).filter(Boolean);

        if (ids.length > 0) {
          // Fetch full article objects by ID
          const articleResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/ai_articles?select=id,headline,publication,published_at,ai_preview,consensus_signal,extracted_tickers&id=in.(${ids.map(encodeURIComponent).join(',')})&published_at=gte.${thirtyDaysAgo}&order=published_at.desc`,
            { headers }
          );

          if (articleResponse.ok) {
            const articles = await articleResponse.json();
            console.log('Feed articles fetched:', articles.length);
            return articles;
          }
        }
      }
    }

    console.warn('RPC function failed, falling back to direct query');
  } catch (error) {
    console.warn('RPC function error, falling back to direct query:', error);
  }

  // Fallback: Get user interests and fetch articles directly
  const interestsResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/user_interests?user_id=eq.${userId}&select=topic_id`,
    { headers }
  );

  if (!interestsResponse.ok) {
    throw new Error('Failed to fetch user interests');
  }

  const interests = await interestsResponse.json();

  if (interests.length === 0) {
    // No interests set — show latest articles instead of empty feed.
    // This covers email-link users who skipped onboarding.
    const fallbackResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_articles?select=id,headline,publication,published_at,ai_preview,consensus_signal,extracted_tickers&published_at=gte.${thirtyDaysAgo}&limit=${limit}&order=published_at.desc`,
      { headers }
    );
    if (!fallbackResponse.ok) return [];
    const fallbackArticles = await fallbackResponse.json();
    console.log('Feed response (no interests, showing latest):', fallbackArticles);
    return Array.isArray(fallbackArticles)
      ? fallbackArticles.map((a: Record<string, unknown>) => normalizeArticle(a))
      : fallbackArticles;
  }

  const topicIds = interests.map((i: any) => i.topic_id);

  // Fetch articles that match user's topics
  const articlesResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/get_articles_by_topics`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ topic_ids: topicIds, max_results: limit }),
    }
  );

  if (articlesResponse.ok) {
    const data = await articlesResponse.json();
    console.log('Feed response (fallback):', data);
    if (Array.isArray(data)) {
      return data.map((a: Record<string, unknown>) => normalizeArticle(a));
    }
    return data;
  }

  // If that also fails, try direct article query
  const directArticlesResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/ai_articles?select=id,headline,publication,published_at,ai_preview,consensus_signal,extracted_tickers&published_at=gte.${thirtyDaysAgo}&limit=${limit}&order=published_at.desc`,
    { headers }
  );

  if (!directArticlesResponse.ok) {
    throw new Error('Failed to fetch articles');
  }

  const allArticles = await directArticlesResponse.json();
  console.log('Feed response (direct query):', allArticles);
  return Array.isArray(allArticles)
    ? allArticles.map((a: Record<string, unknown>) => normalizeArticle(a))
    : allArticles;
}

// Fetch topics that have at least one article in the last `sinceDays` days.
// Used to populate the feed's topic tabs so every tab is guaranteed to resolve
// to a real topic row AND to have recent content. Sorted by recent-article
// count (most active first), capped at `limit`, excluding geography.
export async function getActiveTopics(
  sinceDays: number = 30,
  limit: number = 12,
): Promise<Topic[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/article_topics?select=topic_id,topics!inner(id,slug,display_name,dimension),ai_articles!inner(published_at)&ai_articles.published_at=gte.${since}&limit=1000`,
    { headers },
  );
  if (!res.ok) {
    console.warn('[getActiveTopics] query failed:', res.status);
    return [];
  }
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];

  const counts = new Map<string, number>();
  const topicById = new Map<string, Topic>();
  for (const row of rows) {
    const t = (row as { topics?: Topic }).topics;
    if (!t || t.dimension === 'geography') continue;
    counts.set(t.id, (counts.get(t.id) || 0) + 1);
    if (!topicById.has(t.id)) topicById.set(t.id, t);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || topicById.get(a[0])!.display_name.localeCompare(topicById.get(b[0])!.display_name))
    .slice(0, limit)
    .map(([id]) => topicById.get(id)!);
}

// Fetch articles whose topics match any of the given slugs. Used by the feed's
// grouped topic tabs — a tab like "Tech & AI" maps to several slugs and we
// union the results, deduped by article id.
export async function getArticlesByTopicSlugs(slugs: string[], limit: number = 20): Promise<Article[]> {
  if (slugs.length === 0) return [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Resolve slugs → topic_ids in one query
  const slugsParam = slugs.map(encodeURIComponent).join(',');
  const topicRes = await fetch(
    `${SUPABASE_URL}/rest/v1/topics?slug=in.(${slugsParam})&select=id`,
    { headers }
  );
  if (!topicRes.ok) return [];
  const topicRows = await topicRes.json();
  if (!Array.isArray(topicRows) || topicRows.length === 0) {
    console.warn(`[getArticlesByTopicSlugs] No topics found for slugs: ${slugs.join(',')}`);
    return [];
  }
  const topicIds = topicRows.map((r: { id: string }) => r.id);

  // 2. Preferred path: existing get_articles_by_topics RPC (takes an array)
  try {
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_articles_by_topics`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ topic_ids: topicIds, max_results: limit }),
    });
    if (rpcRes.ok) {
      const data = await rpcRes.json();
      if (Array.isArray(data) && data.length > 0) {
        return data
          .map((a: Record<string, unknown>) => normalizeArticle(a))
          .filter((a) => a.id && (!a.published_at || a.published_at >= thirtyDaysAgo));
      }
    }
  } catch (err) {
    console.warn('[getArticlesByTopicSlugs] RPC failed, falling back to join query:', err);
  }

  // 3. Fallback: direct join via article_topics. Over-fetch then dedupe since
  // a single article can have multiple topics in the selected set.
  const joinRes = await fetch(
    `${SUPABASE_URL}/rest/v1/article_topics?topic_id=in.(${topicIds.join(',')})&select=ai_articles!inner(id,headline,publication,published_at,ai_preview,consensus_signal,extracted_tickers)&limit=${limit * 3}`,
    { headers }
  );
  if (!joinRes.ok) return [];
  const joinRows = await joinRes.json();
  if (!Array.isArray(joinRows)) return [];

  const seen = new Set<string>();
  const articles: Article[] = [];
  for (const row of joinRows) {
    const raw = (row as { ai_articles: Record<string, unknown> | null }).ai_articles;
    if (!raw) continue;
    const a = normalizeArticle(raw);
    if (!a.id || seen.has(a.id)) continue;
    if (a.published_at && a.published_at < thirtyDaysAgo) continue;
    seen.add(a.id);
    articles.push(a);
  }
  articles.sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));
  return articles.slice(0, limit);
}

export async function saveUserTickers(userId: string, tickers: string[]): Promise<void> {
  // First delete existing tickers
  const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_tickers?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers,
  });

  console.log('Delete tickers response:', deleteResponse.status);

  // If no tickers to save, return early
  if (tickers.length === 0) return;

  // Insert new tickers
  const rows = tickers.map(ticker => ({
    user_id: userId,
    ticker: ticker.toUpperCase().trim(),
  }));

  const response = await fetch(`${SUPABASE_URL}/rest/v1/user_tickers`, {
    method: 'POST',
    headers: {
      ...headers,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Save tickers error:', response.status, errorText);
    throw new Error(`Failed to save user tickers: ${response.status}`);
  }

  console.log('Saved tickers for user:', userId, 'tickers:', tickers);
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('This email is already registered.');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export async function saveDigestSubscription(
  userId: string,
  email: string,
  frequency: 'daily' | 'weekly',
  timezone?: string,
  signupSource?: string,
): Promise<{ id: string } | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if this email is already registered under a different user
  const checkResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/digest_subscribers?email=eq.${encodeURIComponent(normalizedEmail)}&is_active=eq.true&select=user_id&limit=1`,
    { headers }
  );

  if (checkResponse.ok) {
    const existing = await checkResponse.json();
    if (existing.length > 0 && existing[0].user_id !== userId) {
      throw new EmailAlreadyRegisteredError();
    }
  }

  // Deactivate any prior subscriptions for this user (different emails)
  // so they don't receive duplicate digests
  await fetch(
    `${SUPABASE_URL}/rest/v1/digest_subscribers?user_id=eq.${userId}&email=neq.${encodeURIComponent(normalizedEmail)}&is_active=eq.true`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ is_active: false }),
    }
  );

  const response = await fetch(`${SUPABASE_URL}/rest/v1/digest_subscribers?on_conflict=email&select=id`, {
    method: 'POST',
    headers: {
      ...headers,
      'Prefer': 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify({
      user_id: userId,
      email: normalizedEmail,
      frequency,
      is_active: true,
      ...(timezone && { timezone }),
      ...(signupSource && { signup_source: signupSource }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Save digest subscription error:', response.status, errorText);
    throw new Error(`Failed to save digest subscription: ${response.status}`);
  }

  const data = await response.json();
  console.log('Saved digest subscription for user:', userId, 'email:', email, 'frequency:', frequency);
  return data?.[0] ?? null;
}

export async function triggerWelcomeEmail(subscriberId: string): Promise<void> {
  fetch(`${SUPABASE_URL}/functions/v1/send-welcome`, {
    method: 'POST',
    headers: {
      ...headers,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ subscriber_id: subscriberId }),
  }).catch(() => {}); // Fire-and-forget
}

export async function getUserDigestEmail(userId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/digest_subscribers?user_id=eq.${userId}&is_active=eq.true&select=email&order=subscribed_at.desc&limit=1`,
      { headers }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.length > 0 ? data[0].email : null;
  } catch {
    return null;
  }
}

export async function checkWaitlistStatus(userId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_agent_waitlist?user_id=eq.${userId}&select=id&limit=1`,
      { headers }
    );
    if (!response.ok) return false;
    const data = await response.json();
    return data.length > 0;
  } catch {
    return false;
  }
}

export async function joinAiAgentWaitlist(
  userId: string,
  articleId?: string,
  email?: string
): Promise<void> {
  const body: Record<string, string | undefined> = {
    user_id: userId,
  };
  if (articleId) body.article_id = articleId;
  if (email) body.email = email.toLowerCase().trim();

  const response = await fetch(`${SUPABASE_URL}/rest/v1/ai_agent_waitlist`, {
    method: 'POST',
    headers: {
      ...headers,
      'Prefer': 'return=minimal,resolution=merge-duplicates',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Join waitlist error:', response.status, errorText);
    throw new Error(`Failed to join waitlist: ${response.status}`);
  }
}

export async function saveOnboardingSurvey(
  userId: string,
  data: {
    investing_style: string;
    content_density: string;
  }
): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/onboarding_survey`, {
    method: 'POST',
    headers: {
      ...headers,
      'Prefer': 'return=minimal,resolution=merge-duplicates',
    },
    body: JSON.stringify({
      user_id: userId,
      ...data,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Save survey error:', response.status, errorText);
    throw new Error(`Failed to save survey: ${response.status}`);
  }
}

export interface SubscriberFeed {
  subscriber: { email: string; frequency: string };
  topics: Array<{ slug: string; display_name: string }>;
  articles: Article[];
}

// Walk all string values from an object (including nested), keyed by path.
function flattenValues(obj: unknown, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      result[k] = v; // shallow key
      result[key] = v; // dotted path
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        Object.assign(result, flattenValues(v, key));
      }
    }
  }
  return result;
}

// Find first truthy string value matching any of the candidate keys.
function pick(flat: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = flat[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}

// Find first truthy array value matching any of the candidate keys.
function pickArray(flat: Record<string, unknown>, ...keys: string[]): string[] {
  for (const k of keys) {
    const v = flat[k];
    if (Array.isArray(v)) return v as string[];
  }
  return [];
}

// Normalize an article object from any RPC response shape into our Article interface.
// Flattens nested objects and searches all keys to find matching fields.
function normalizeArticle(raw: Record<string, unknown>): Article {
  const flat = flattenValues(raw);

  const article: Article = {
    id: pick(flat, 'id', 'article_id') || (raw.id as string) || '',
    headline: pick(flat, 'headline', 'title', 'name'),
    publication: pick(flat, 'publication', 'source', 'publisher', 'source_name'),
    published_at: pick(flat, 'published_at', 'publishedAt', 'pub_date', 'date', 'created_at'),
    ai_preview: pick(flat, 'ai_preview', 'aiPreview', 'summary', 'preview', 'description', 'ai_summary'),
    consensus_signal: (pick(flat, 'consensus_signal', 'signal', 'rating') || 'NO_RATING') as Article['consensus_signal'],
    extracted_tickers: pickArray(flat, 'extracted_tickers', 'tickers', 'ticker_list', 'symbols'),
  };

  // Log if normalization produced an empty headline — helps debug unknown shapes
  if (!article.headline) {
    console.warn('[normalizeArticle] Could not extract headline from:', JSON.stringify(raw).slice(0, 500));
  }

  return article;
}

export async function getSubscriberFeed(token: string, limit: number = 20): Promise<SubscriberFeed | null> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_subscriber_feed`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_token: token, p_limit: limit }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  console.log('[getSubscriberFeed] Raw RPC response:', JSON.stringify(data).slice(0, 2000));
  if (data?.error === 'not_found') return null;

  // Normalize articles to ensure consistent field names
  if (data?.articles && Array.isArray(data.articles)) {
    if (data.articles.length > 0) {
      console.log('[getSubscriberFeed] First raw article keys:', Object.keys(data.articles[0]));
      console.log('[getSubscriberFeed] First raw article:', JSON.stringify(data.articles[0]).slice(0, 1000));
    }
    data.articles = data.articles.map((a: Record<string, unknown>) => normalizeArticle(a));
  }

  return data;
}

export function formatArticleDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  // Output example: "Apr 14, 7:30 AM ET"
}

export async function getArticleDetail(articleId: string): Promise<ArticleDetail> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/ai_articles?id=eq.${articleId}&select=*`,
    { headers }
  );

  if (!response.ok) throw new Error('Failed to fetch article detail');
  const data = await response.json();
  return data[0];
}