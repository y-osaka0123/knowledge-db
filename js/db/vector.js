/**
 * js/db/vector.js
 * pgvector（Supabase）を使った意味検索
 * Transformers.js ESM版をdirect importで使用
 */

import { SUPABASE_CONFIG, EMBEDDING_CONFIG } from '../config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';

env.allowLocalModels = false;

const _client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

let _pipeline = null;

async function getEmbeddingPipeline() {
  if (_pipeline) return _pipeline;
  _pipeline = await pipeline('feature-extraction', EMBEDDING_CONFIG.model);
  return _pipeline;
}

export async function generateEmbedding(text) {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export async function searchByVector(queryText, limit = 5) {
  const embedding = await generateEmbedding(queryText);

  const { data, error } = await _client.rpc('match_articles', {
    query_embedding: embedding,
    match_threshold: 0.2,
    match_count: limit,
  });

  if (error) throw error;
  return data ?? [];
}

/**
 * 全記事のID、タイトル、およびEmbeddingベクトルを全件取得する
 */
export async function fetchAllEmbeddings() {
  // 注意: Supabaseのデフォルトのselectでは、データが大きいため
  // 明示的にrpc関数を呼ぶか、カラムを絞って全件（制限に注意しつつ）取得します。
  // ここでは新しく作成するRPC 'get_all_article_embeddings' を叩く想定にします。
  const { data, error } = await _client.rpc('get_all_article_embeddings');
  
  if (error) {
    console.error('[vector.js] fetchAllEmbeddings error:', error);
    throw error;
  }
  return data ?? [];
}