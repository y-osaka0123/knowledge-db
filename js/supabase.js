/**
 * js/db/supabase.js
 * Supabase（PostgreSQL + Storage）へのデータ入出力
 * ESM版CDNを直接importするためwindow.supabase依存を排除
 * → GitHub Pagesでも確実に動作する
 */

import { SUPABASE_CONFIG, TABLES, STORAGE } from '../config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// モジュール読み込み時に即クライアントを生成（タイミング問題を排除）
const _client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

function getClient() { return _client; }

// ─── Articles（RDB） ─────────────────────────────────────────────

export async function fetchArticles() {
  const { data, error } = await getClient()
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

export async function fetchArticlesByTag(tagName) {
  const { data, error } = await getClient()
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

export async function searchArticlesByText(keyword) {
  const { data, error } = await getClient()
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

export async function fetchArticleById(id) {
  const { data, error } = await getClient()
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

export async function fetchTags() {
  const { data, error } = await getClient()
    .from(TABLES.tags)
    .select('id, name')
    .order('name');

  if (error) throw error;
  return data ?? [];
}

// ─── Storage ─────────────────────────────────────────────────────

export function getImageUrl(filePath) {
  const { data } = getClient().storage
    .from(STORAGE.bucket)
    .getPublicUrl(filePath);
  return data.publicUrl;
}
