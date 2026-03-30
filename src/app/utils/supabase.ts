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

export async function getArticleDetail(articleId: string): Promise<ArticleDetail> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/ai_articles?id=eq.${articleId}&select=*`,
    { headers }
  );

  if (!response.ok) throw new Error('Failed to fetch article detail');
  const data = await response.json();
  return data[0];
}