/**
 * config.js
 * 各DBの接続情報をここに記入してください。
 * GitHub Pages公開時は anon key のみ使用（書き込み不可のRLS設定前提）
 */

// ─── Supabase（RDB + pgvector + Storage） ───────────────────────────
export const SUPABASE_CONFIG = {
  url: "YOUR_SUPABASE_URL",           // 例: https://xxxx.supabase.co
  anonKey: "YOUR_SUPABASE_ANON_KEY",  // Supabase Dashboard > Settings > API
};

// テーブル名
export const TABLES = {
  articles: "articles",
  tags: "tags",
  articleTags: "article_tags",
  embeddings: "article_embeddings",
};

// Supabase Storage バケット名
export const STORAGE = {
  bucket: "knowledge-images",
};

// ─── Neo4j Aura（グラフDB） ─────────────────────────────────────────
export const NEO4J_CONFIG = {
  uri: "YOUR_NEO4J_URI",       // 例: neo4j+s://xxxx.databases.neo4j.io
  username: "YOUR_NEO4J_USER", // デフォルト: neo4j
  password: "YOUR_NEO4J_PASSWORD",
};

// ─── Transformers.js（ブラウザ内Embedding） ─────────────────────────
export const EMBEDDING_CONFIG = {
  model: "Xenova/all-MiniLM-L6-v2", // 軽量・無料・ブラウザ完結
  dimensions: 384,
};
