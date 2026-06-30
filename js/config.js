/**
 * config.js
 * 接続情報は GitHub Actions (deploy.yml) が Secrets から自動注入します。
 * ローカル動作確認時は %%...%% の部分を直接書き換えてください。
 * ただし書き換えた状態のままコミット・pushしないこと（.gitに上げない）。
 */

export const SUPABASE_CONFIG = {
  url: "%%SUPABASE_URL%%",
  anonKey: "%%SUPABASE_KEY%%",
};

export const TABLES = {
  articles: "articles",
  tags: "tags",
  articleTags: "article_tags",
  embeddings: "article_embeddings",
};

export const STORAGE = {
  bucket: "knowledge-images",
};

export const NEO4J_CONFIG = {
  uri: "%%NEO4J_URI%%",
  username: "neo4j",
  password: "%%NEO4J_PASSWORD%%",
};

export const EMBEDDING_CONFIG = {
  model: "Xenova/all-MiniLM-L6-v2",
  dimensions: 384,
};
