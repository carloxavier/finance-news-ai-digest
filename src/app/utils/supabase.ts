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
  source_url: string;
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
  try {
    // Try the RPC function first
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_feed`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_user_id: userId, p_limit: limit }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Feed response:', data);
      return data;
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
    // No interests set, return empty feed
    return [];
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
    return data;
  }

  // If that also fails, try direct article query
  const directArticlesResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/ai_articles?select=id,headline,publication,published_at,ai_preview,consensus_signal,extracted_tickers,source_url&limit=${limit}&order=published_at.desc`,
    { headers }
  );

  if (!directArticlesResponse.ok) {
    throw new Error('Failed to fetch articles');
  }

  const allArticles = await directArticlesResponse.json();
  console.log('Feed response (direct query):', allArticles);
  return allArticles;
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

export async function saveDigestSubscription(userId: string, email: string, frequency: 'daily' | 'weekly'): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/digest_subscribers?on_conflict=email`, {
    method: 'POST',
    headers: {
      ...headers,
      'Prefer': 'return=minimal,resolution=merge-duplicates',
    },
    body: JSON.stringify({
      user_id: userId,
      email: email.toLowerCase().trim(),
      frequency,
      is_active: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Save digest subscription error:', response.status, errorText);
    throw new Error(`Failed to save digest subscription: ${response.status}`);
  }

  console.log('Saved digest subscription for user:', userId, 'email:', email, 'frequency:', frequency);
}

export async function getUserDigestEmail(userId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/digest_subscribers?user_id=eq.${userId}&is_active=eq.true&select=email&limit=1`,
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

export async function getArticleDetail(articleId: string): Promise<ArticleDetail> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/ai_articles?id=eq.${articleId}&select=*`,
    { headers }
  );

  if (!response.ok) throw new Error('Failed to fetch article detail');
  const data = await response.json();
  return data[0];
}