/**
 * js/main.js
 * index.html のエントリポイント
 * 一覧表示・検索・タグ絞り込みを制御する
 */

import { fetchArticles, fetchTags, searchArticlesByText, fetchArticlesByTag } from './db/supabase.js';
import { searchByVector } from './db/vector.js';
import { setPanelStatus, resetPanel } from './components/dataPanel.js';

// ── DOM 参照 ──────────────────────────────────────────────────────
const grid       = document.getElementById('articlesGrid');
const searchInput = document.getElementById('searchInput');
const modeText   = document.getElementById('modeText');
const modeVector = document.getElementById('modeVector');
const tagFilter  = document.getElementById('tagFilter');

// ── 状態 ─────────────────────────────────────────────────────────
let searchMode  = 'text';   // 'text' | 'vector'
let activeTag   = 'all';
let searchTimer = null;

// ── 初期化 ────────────────────────────────────────────────────────
(async () => {
  await Promise.all([loadArticles(), loadTags()]);
  bindEvents();
})();

// ── データ取得 ────────────────────────────────────────────────────

async function loadArticles() {
  setGridLoading();
  setPanelStatus('rdb', 'loading', 'articles テーブルを取得中');

  try {
    const articles = await fetchArticles();
    setPanelStatus('rdb', 'active', `${articles.length} 件取得完了`);
    renderArticles(articles);
  } catch (err) {
    console.error(err);
    setPanelStatus('rdb', 'error');
    setGridError('記事の取得に失敗しました。config.js の設定を確認してください。');
  }
}

async function loadTags() {
  try {
    const tags = await fetchTags();
    renderTagChips(tags);
  } catch (err) {
    console.error('タグ取得エラー:', err);
  }
}

// ── 検索 ─────────────────────────────────────────────────────────

async function doSearch(keyword) {
  if (!keyword.trim()) {
    await loadArticles();
    return;
  }

  setGridLoading();
  resetPanel();

  if (searchMode === 'text') {
    setPanelStatus('rdb', 'loading', `"${keyword}" をテキスト検索中`);
    try {
      const results = await searchArticlesByText(keyword);
      setPanelStatus('rdb', 'active', `${results.length} 件ヒット`);
      renderArticles(results);
    } catch (err) {
      setPanelStatus('rdb', 'error');
      setGridError('テキスト検索に失敗しました。');
    }

  } else {
    // 意味検索（pgvector）
    setPanelStatus('vec', 'loading', `"${keyword}" をベクトル化中（Transformers.js）`);
    try {
      const results = await searchByVector(keyword);
      setPanelStatus('vec', 'active', `${results.length} 件ヒット`);
      renderArticles(results);
    } catch (err) {
      setPanelStatus('vec', 'error');
      setGridError('意味検索に失敗しました。pgvector の設定を確認してください。');
    }
  }
}

async function doTagFilter(tagName) {
  activeTag = tagName;

  // チップのアクティブ状態を更新
  document.querySelectorAll('.tag-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.tag === tagName);
  });

  setGridLoading();
  resetPanel();

  if (tagName === 'all') {
    await loadArticles();
    return;
  }

  setPanelStatus('rdb', 'loading', `タグ "${tagName}" でフィルタ中`);
  try {
    const results = await fetchArticlesByTag(tagName);
    setPanelStatus('rdb', 'active', `${results.length} 件`);
    renderArticles(results);
  } catch (err) {
    setPanelStatus('rdb', 'error');
    setGridError('タグ絞り込みに失敗しました。');
  }
}

// ── レンダリング ──────────────────────────────────────────────────

function renderArticles(articles) {
  if (!articles.length) {
    grid.innerHTML = `<div class="state-empty">記事が見つかりませんでした。</div>`;
    return;
  }

  grid.innerHTML = articles.map(article => {
    const tags = (article.article_tags ?? [])
      .map(at => at.tags?.name ?? at.name ?? '')
      .filter(Boolean);

    const tagsHtml = tags
      .map(t => `<span class="card-tag">${escHtml(t)}</span>`)
      .join('');

    const thumbHtml = article.thumbnail_url
      ? `<img src="${escHtml(article.thumbnail_url)}" alt="" loading="lazy" />`
      : `<span>📄</span>`;

    const date = article.created_at
      ? new Date(article.created_at).toLocaleDateString('ja-JP')
      : '';

    // 類似度スコア（ベクター検索時のみ）
    const scoreHtml = article.similarity != null
      ? `<span style="font-family:var(--font-mono);font-size:11px;color:var(--vec)">
           similarity: ${(article.similarity * 100).toFixed(1)}%
         </span>`
      : '';

    return `
      <article class="article-card" onclick="location.href='detail.html?id=${article.id}'">
        <div class="card-thumbnail ${article.thumbnail_url ? '' : 'placeholder'}">${thumbHtml}</div>
        <div class="card-tags">${tagsHtml}</div>
        <h2 class="card-title">${escHtml(article.title)}</h2>
        <p class="card-excerpt">${escHtml(article.excerpt ?? '')}</p>
        <div class="card-footer">
          <span class="card-date">${date}${scoreHtml}</span>
          <span class="card-arrow">→</span>
        </div>
      </article>
    `;
  }).join('');
}

function renderTagChips(tags) {
  const existing = tagFilter.querySelector('[data-tag="all"]');
  const chips = tags.map(tag =>
    `<button class="tag-chip" data-tag="${escHtml(tag.name)}">${escHtml(tag.name)}</button>`
  ).join('');
  existing.insertAdjacentHTML('afterend', chips);

  // チップのクリックイベント
  tagFilter.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => doTagFilter(chip.dataset.tag));
  });
}

// ── UI ヘルパー ───────────────────────────────────────────────────

function setGridLoading() {
  grid.innerHTML = `<div class="state-loading">読み込み中</div>`;
}

function setGridError(msg) {
  grid.innerHTML = `<div class="state-empty">${escHtml(msg)}</div>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── イベント ──────────────────────────────────────────────────────

function bindEvents() {
  // 検索インプット（debounce 400ms）
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(searchInput.value), 400);
  });

  // 検索モード切替
  modeText.addEventListener('click', () => {
    searchMode = 'text';
    modeText.classList.add('active');
    modeVector.classList.remove('active');
    if (searchInput.value) doSearch(searchInput.value);
  });

  modeVector.addEventListener('click', () => {
    searchMode = 'vector';
    modeVector.classList.add('active');
    modeText.classList.remove('active');
    if (searchInput.value) doSearch(searchInput.value);
  });
}
