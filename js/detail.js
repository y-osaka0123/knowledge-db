/**
 * js/detail.js
 * detail.html のエントリポイント
 * RDB → Storage → pgvector → Neo4j の順にデータを取得・表示する
 *
 * ※ importパスはフラット構造（js/ 直下）に合わせている
 */

import { fetchArticleById, getImageUrl } from './supabase.js';
import { searchByVector } from './vector.js';
import { fetchRelatedGraph } from './graph.js';

// ── DOM 参照 ──────────────────────────────────────────────────────
const loadingState   = document.getElementById('loadingState');
const articleContent = document.getElementById('articleContent');
const errorState     = document.getElementById('errorState');

// ── URL パラメータから記事ID取得 ──────────────────────────────────
const params    = new URLSearchParams(location.search);
const articleId = params.get('id');

console.log('[detail.js] 起動: articleId =', articleId);

// ── エントリポイント ──────────────────────────────────────────────
if (!articleId) {
  console.error('[detail.js] articleId がURLパラメータに存在しません');
  showError();
} else {
  loadArticle(articleId).catch(err => {
    console.error('[detail.js] loadArticle で致命的エラー:', err);
  });
}

// ── メイン処理 ────────────────────────────────────────────────────

async function loadArticle(id) {

  // ① RDB（PostgreSQL）から記事本文・タグを取得
  console.log('[detail.js] ① RDB取得開始');
  setFlowStatus('rdb', 'active', `SELECT * FROM articles WHERE id = '${id.slice(0, 8)}...'`);
  let article;
  try {
    article = await fetchArticleById(id);
    console.log('[detail.js] ① RDB取得成功:', article);
    setFlowStatus('rdb', 'done', `取得完了 — title: "${article.title}"`);
  } catch (err) {
    console.error('[detail.js] ① RDB取得エラー:', err);
    showError();
    return;
  }

  renderArticle(article);
  showArticle();

  // ② Storage（サムネイル画像）
  console.log('[detail.js] ② Storage処理開始. thumbnail_url =', article.thumbnail_url);
  if (article.thumbnail_url) {
    const isExternal = article.thumbnail_url.startsWith('http');
    const imgUrl = isExternal ? article.thumbnail_url : getImageUrl(article.thumbnail_url);
    const label  = isExternal ? `外部URL使用` : `Storage: getPublicUrl('${article.thumbnail_url}')`;
    setFlowStatus('storage', 'active', label);
    renderThumbnail(imgUrl);
    setFlowStatus('storage', 'done', '画像取得完了');
    console.log('[detail.js] ② Storage完了:', imgUrl);
  } else {
    setFlowStatus('storage', 'idle', 'サムネイルなし');
  }

  // ③ pgvector（類似記事）
  console.log('[detail.js] ③ pgvector処理開始');
  setFlowStatus('vec', 'active', 'Transformers.js で Embedding 生成中...');
  try {
    const related = await searchByVector(article.title + ' ' + (article.excerpt ?? ''));
    const filtered = related.filter(r => r.id !== id);
    console.log('[detail.js] ③ pgvector成功:', filtered);
    setFlowStatus('vec', 'done', `${filtered.length} 件の類似記事を取得`);
    renderRelated(filtered);
  } catch (err) {
    console.error('[detail.js] ③ pgvectorエラー:', err);
    setFlowStatus('vec', 'error', `エラー: ${err.message}`);
    renderRelatedEmpty(`pgvectorエラー: ${err.message}`);
  }

  // ④ Neo4j（関連グラフ）
  console.log('[detail.js] ④ Neo4j処理開始. supabase_id として渡すID =', id);
  setFlowStatus('graph', 'active', `MATCH (a {supabase_id:'${id.slice(0,8)}...'})-[:HAS_TAG]->(t)<-[:HAS_TAG]-(r)`);
  try {
    const { nodes, edges } = await fetchRelatedGraph(id);
    console.log('[detail.js] ④ Neo4j成功: nodes=', nodes, 'edges=', edges);
    setFlowStatus('graph', 'done', `${nodes.length} ノード / ${edges.length} エッジ`);
    renderGraph(nodes, edges);
  } catch (err) {
    console.error('[detail.js] ④ Neo4jエラー（詳細）:', err);
    console.error('[detail.js] ④ Neo4jエラーメッセージ:', err.message);
    console.error('[detail.js] ④ Neo4jエラースタック:', err.stack);
    setFlowStatus('graph', 'error', `エラー: ${err.message}`);
    renderGraphEmpty(err.message);
  }
}

// ── レンダリング ──────────────────────────────────────────────────

function renderArticle(article) {
  document.getElementById('breadcrumbTitle').textContent = article.title;
  document.title = `${article.title} – Knowledge Base`;

  const tags = (article.article_tags ?? [])
    .map(at => at.tags?.name ?? '')
    .filter(Boolean);
  document.getElementById('articleTags').innerHTML =
    tags.map(t => `<span class="card-tag">${escHtml(t)}</span>`).join('');

  document.getElementById('articleTitle').textContent = article.title;
  document.getElementById('articleDate').textContent =
    article.created_at
      ? new Date(article.created_at).toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric' })
      : '';

  document.getElementById('articleBody').innerHTML = renderBody(article.body ?? '');

  document.getElementById('flow-rdb-query').textContent =
    `SELECT id, title, body, ... FROM articles WHERE id = '${article.id.slice(0,8)}...'`;
}

function renderThumbnail(url) {
  const wrap = document.getElementById('articleThumbnail');
  const img  = document.getElementById('thumbnailImg');
  img.src = url;
  img.alt = '';
  wrap.style.display = 'block';
  document.getElementById('flow-storage-query').textContent = url;
}

function renderRelated(articles) {
  const list = document.getElementById('relatedList');
  if (!articles.length) {
    renderRelatedEmpty('類似記事が見つかりませんでした。');
    return;
  }
  list.innerHTML = articles.slice(0, 4).map(a => `
    <div class="related-item" onclick="location.href='detail.html?id=${a.id}'">
      <div class="related-thumb">📄</div>
      <div class="related-info">
        <span class="related-title">${escHtml(a.title)}</span>
        ${a.similarity != null
          ? `<span class="related-score">similarity: ${(a.similarity * 100).toFixed(1)}%</span>`
          : ''}
      </div>
    </div>
  `).join('');
}

function renderRelatedEmpty(msg) {
  document.getElementById('relatedList').innerHTML =
    `<div style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim);padding:var(--s2)">${escHtml(msg)}</div>`;
}

function renderGraph(nodes, edges) {
  const container = document.getElementById('graphContainer');
  if (!nodes.length) {
    renderGraphEmpty('該当する関連ノードがありません（Neo4jにデータ未投入の可能性）');
    return;
  }

  const visNodes = nodes.map(n => ({
    id:    n.id,
    label: n.title ?? n.name ?? n.id,
    color: n.label === 'Tag'
      ? { background: '#10B98120', border: '#10B981' }
      : { background: '#3B82F620', border: '#3B82F6' },
    font:  { color: '#E8EDF5', size: 11, face: 'JetBrains Mono' },
  }));

  const visEdges = edges.map((e, i) => ({
    id: i, from: e.from, to: e.to,
    color: { color: '#2A3F5F', highlight: '#3B82F6' },
    width: 1,
  }));

  const data    = { nodes: new vis.DataSet(visNodes), edges: new vis.DataSet(visEdges) };
  const options = {
    physics: { stabilization: { iterations: 100 } },
    interaction: { hover: true, dragNodes: true },
    nodes: { shape: 'dot', size: 10, borderWidth: 2 },
    edges: { smooth: { type: 'continuous' } },
  };

  container.innerHTML = '';
  new vis.Network(container, data, options);
}

function renderGraphEmpty(reason = '') {
  document.getElementById('graphContainer').innerHTML = `
    <div class="graph-placeholder">
      <span>🔗</span>
      <span>Neo4j 未接続</span>
      ${reason ? `<span style="font-size:10px;color:var(--text-dim);margin-top:4px">${escHtml(reason)}</span>` : ''}
    </div>`;
}

// ── データフローパネル更新 ────────────────────────────────────────

function setFlowStatus(db, status, queryText) {
  const el = document.getElementById(`flow-${db}`);
  if (!el) return;
  el.classList.toggle('active', status === 'active' || status === 'done');
  const detailEl = el.querySelector('.panel-flow-detail');
  if (detailEl) {
    const labels = { active: '処理中...', done: '完了', idle: '対象データなし', error: 'エラー' };
    detailEl.textContent = labels[status] ?? status;
  }
  if (queryText) {
    const queryEl = el.querySelector('.panel-flow-query');
    if (queryEl) queryEl.textContent = queryText;
  }
}

// ── 簡易 Markdown → HTML 変換 ────────────────────────────────────

function renderBody(text) {
  const lines = text.split('\n');
  let html = '';
  let inCode = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      html += inCode ? '</code></pre>' : '<pre><code>';
      inCode = !inCode;
      continue;
    }
    if (inCode) { html += escHtml(line) + '\n'; continue; }
    if (line.startsWith('## '))  { html += `<h2>${escHtml(line.slice(3))}</h2>`; continue; }
    if (line.startsWith('### ')) { html += `<h3>${escHtml(line.slice(4))}</h3>`; continue; }
    if (line.startsWith('- '))   { html += `<ul><li>${escHtml(line.slice(2))}</li></ul>`; continue; }
    if (line.trim() === '')      { continue; }
    html += `<p>${inlineCode(escHtml(line))}</p>`;
  }
  return html.replace(/<\/ul><ul>/g, '');
}

function inlineCode(str) {
  return str.replace(/`([^`]+)`/g, '<code>$1</code>');
}

// ── UI ヘルパー ───────────────────────────────────────────────────

function showArticle() {
  loadingState.style.display = 'none';
  articleContent.style.display = 'block';
}

function showError() {
  loadingState.style.display = 'none';
  errorState.style.display = 'block';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
