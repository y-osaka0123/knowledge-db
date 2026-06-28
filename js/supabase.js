/**
 * js/db/supabase.js
 * Supabase（PostgreSQL + Storage）へのデータ入出力
 * supabase-js を CDN から読み込む前提
 */

import { SUPABASE_CONFIG, TABLES, STORAGE } from '../config.js';

let _client = null;

/** Supabase クライアントをシングルトンで返す */
function getClient() {
  if (_client) return _client;
  // supabase-js は index.html の <script> で CDN 読み込み済みを想定
  // type="module" 環境では window.supabase 経由で参照
  const { createClient } = window.supabase;
  _client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  return _client;
}

// ─── Articles（RDB） ─────────────────────────────────────────────

/**
 * 記事一覧を取得する
 * @returns {Promise<Array>}
 */
export async function fetchArticles() {
  const client = getClient();
  const { data, error } = await client
    .from(TABLES.articles)
    .select(`
      id,
      title,
      excerpt,
      thumbnail_url,
      created_at,
      article_tags ( tags ( id, name ) )
    `)
    .eq('published', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * タグ名でフィルタリングした記事一覧を取得する
 * @param {string} tagName
 * @returns {Promise<Array>}
 */
export async function fetchArticlesByTag(tagName) {
  const client = getClient();
  const { data, error } = await client
    .from(TABLES.articles)
    .select(`
      id,
      title,
      excerpt,
      thumbnail_url,
      created_at,
      article_tags!inner ( tags!inner ( id, name ) )
    `)
    .eq('published', true)
    .eq('article_tags.tags.name', tagName)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * テキストキーワードで記事を検索する（RDB LIKE 検索）
 * @param {string} keyword
 * @returns {Promise<Array>}
 */
export async function searchArticlesByText(keyword) {
  const client = getClient();
  const { data, error } = await client
    .from(TABLES.articles)
    .select(`
      id,
      title,
      excerpt,
      thumbnail_url,
      created_at,
      article_tags ( tags ( id, name ) )
    `)
    .eq('published', true)
    .or(`title.ilike.%${keyword}%,excerpt.ilike.%${keyword}%`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * 記事詳細を ID で取得する
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function fetchArticleById(id) {
  const client = getClient();
  const { data, error } = await client
    .from(TABLES.articles)
    .select(`
      id,
      title,
      body,
      thumbnail_url,
      created_at,
      article_tags ( tags ( id, name ) )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * 全タグ一覧を取得する
 * @returns {Promise<Array>}
 */
export async function fetchTags() {
  const client = getClient();
  const { data, error } = await client
    .from(TABLES.tags)
    .select('id, name')
    .order('name');

  if (error) throw error;
  return data ?? [];
}

// ─── Storage ─────────────────────────────────────────────────────

/**
 * ストレージの画像を公開URLで取得する
 * @param {string} filePath - バケット内のパス（例: "2024/hero.png"）
 * @returns {string} 公開URL
 */
export function getImageUrl(filePath) {
  const client = getClient();
  const { data } = client.storage
    .from(STORAGE.bucket)
    .getPublicUrl(filePath);
  return data.publicUrl;
}
