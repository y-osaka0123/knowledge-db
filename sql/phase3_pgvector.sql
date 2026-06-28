-- ================================================================
-- Phase 3: pgvector セットアップ
-- Supabase SQL Editor にそのまま貼り付けて実行してください
-- ================================================================

-- ① pgvector 拡張を有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- ② embeddings テーブル作成
--    dimensions=384 は Transformers.js の all-MiniLM-L6-v2 モデルに合わせた値
CREATE TABLE IF NOT EXISTS public.article_embeddings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  embedding   vector(384) NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(article_id)
);

-- ③ コサイン距離インデックス（検索高速化）
CREATE INDEX IF NOT EXISTS article_embeddings_embedding_idx
  ON public.article_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ④ RLS（読み取り公開）
ALTER TABLE public.article_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read" ON public.article_embeddings;
CREATE POLICY "public read" ON public.article_embeddings
  FOR SELECT USING (true);

-- ⑤ 意味検索用 RPC 関数
CREATE OR REPLACE FUNCTION match_articles(
  query_embedding  vector(384),
  match_threshold  float DEFAULT 0.5,
  match_count      int   DEFAULT 5
)
RETURNS TABLE (
  id            uuid,
  title         text,
  excerpt       text,
  thumbnail_url text,
  similarity    float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.excerpt,
    a.thumbnail_url,
    (1 - (ae.embedding <=> query_embedding))::float AS similarity
  FROM public.article_embeddings ae
  JOIN public.articles a ON a.id = ae.article_id
  WHERE
    a.published = true
    AND (1 - (ae.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
