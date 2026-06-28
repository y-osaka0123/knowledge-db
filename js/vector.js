/**
 * js/db/vector.js
 * pgvector（Supabase）を使った意味検索
 * Embedding生成は Transformers.js でブラウザ内完結
 */

import { SUPABASE_CONFIG, TABLES, EMBEDDING_CONFIG } from '../config.js';

let _pipeline = null;

/**
 * Transformers.js の Embedding パイプラインを初期化する（初回のみロード）
 * @returns {Promise<Function>}
 */
async function getEmbeddingPipeline() {
  if (_pipeline) return _pipeline;

  // Transformers.js は index.html の <script> で CDN 読み込み済みを想定
  const { pipeline } = window.transformers ?? await import(
    'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'
  );

  _pipeline = await pipeline('feature-extraction', EMBEDDING_CONFIG.model);
  return _pipeline;
}

/**
 * テキストをベクトルに変換する
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function generateEmbedding(text) {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  // Float32Array → 通常の配列に変換
  return Array.from(output.data);
}

/**
 * 意味検索：クエリに近い記事を pgvector で取得する
 * Supabase の RPC（PostgreSQL 関数）を呼び出す
 * @param {string} queryText
 * @param {number} [limit=5]
 * @returns {Promise<Array>}
 */
export async function searchByVector(queryText, limit = 5) {
  const { createClient } = window.supabase;
  const client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

  // 1. クエリテキストをベクトル化
  const embedding = await generateEmbedding(queryText);

  // 2. Supabase RPC で cosine similarity 検索
  //    事前に PostgreSQL 側に match_articles 関数を作成しておく必要あり
  const { data, error } = await client.rpc('match_articles', {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: limit,
  });

  if (error) throw error;
  return data ?? [];
}

/* ----------------------------------------------------------------
   Supabase側に必要なSQL（README or 記事に記載用）

   CREATE OR REPLACE FUNCTION match_articles(
     query_embedding vector(384),
     match_threshold float,
     match_count int
   )
   RETURNS TABLE (
     id uuid,
     title text,
     excerpt text,
     similarity float
   )
   LANGUAGE plpgsql
   AS $$
   BEGIN
     RETURN QUERY
     SELECT
       a.id, a.title, a.excerpt,
       1 - (ae.embedding <=> query_embedding) AS similarity
     FROM article_embeddings ae
     JOIN articles a ON a.id = ae.article_id
     WHERE 1 - (ae.embedding <=> query_embedding) > match_threshold
     ORDER BY similarity DESC
     LIMIT match_count;
   END;
   $$;
   ---------------------------------------------------------------- */
