/**
 * js/detail.js
 * detail.html のエントリポイント
 * RDB → Storage → pgvector → Neo4j の順にデータを取得・表示する
 *
 * ※ importパスはフラット構造（js/ 直下）に合わせている
 */

import { fetchArticleById, getImageUrl } from '../js/db/supabase.js';
import { searchByVector } from '../js/db/vector.js';
import { fetchRelatedGraph } from '../js/db/graph.js';

// ── DOM 参照 ──────────────────────────────────────────────────────
const loadingState = document.getElementById('loadingState');
const articleContent = document.getElementById('articleContent');
const errorState = document.getElementById('errorState');

// ── URL パラメータから記事ID取得 ──────────────────────────────────
const params = new URLSearchParams(location.search);
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
    const label = isExternal ? `外部URL使用` : `Storage: getPublicUrl('${article.thumbnail_url}')`;
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
    renderRelated(filtered, article.title);
  } catch (err) {
    console.error('[detail.js] ③ pgvectorエラー:', err);
    setFlowStatus('vec', 'error', `エラー: ${err.message}`);
    renderRelatedEmpty(`pgvectorエラー: ${err.message}`);
  }

  // ④ Neo4j（関連グラフ）
  console.log('[detail.js] ④ Neo4j処理開始. supabase_id として渡すID =', id);
  setFlowStatus('graph', 'active', `MATCH (a {supabase_id:'${id.slice(0, 8)}...'})-[:HAS_TAG]->(t)<-[:HAS_TAG]-(r)`);
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
      ? new Date(article.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';

  document.getElementById('articleBody').innerHTML = renderBody(article.body ?? '');

  document.getElementById('flow-rdb-query').textContent =
    `SELECT id, title, body, ... FROM articles WHERE id = '${article.id.slice(0, 8)}...'`;
}

function renderThumbnail(url) {
  const wrap = document.getElementById('articleThumbnail');
  const img = document.getElementById('thumbnailImg');
  img.src = url;
  img.alt = '';
  wrap.style.display = 'block';
  document.getElementById('flow-storage-query').textContent = url;
}

function renderRelated(articles, centerTitle) {
  const list = document.getElementById('relatedList');

  if (!articles.length) {
    renderRelatedEmpty('類似記事が見つかりませんでした。');
    return;
  }

  const top = articles.slice(0, 6);

  // ── バブルチャート（D3.js）：中心=現在の記事、距離=非類似度 ──────
  const width = list.clientWidth || 280;
  const height = 220;
  const cx = width / 2, cy = height / 2;

  list.innerHTML = `<svg id="bubbleSvg" width="${width}" height="${height}" style="overflow:visible"></svg>`;
  const svg = d3.select('#bubbleSvg');

  // 中心ノード（現在の記事）
  const centerNode = { id: 'center', title: centerTitle, similarity: 1, isCenter: true };
  const nodes = [centerNode, ...top.map(a => ({ ...a, isCenter: false }))];

  // similarity が高いほど中心に近い半径（距離）
  // similarity: 0.3〜1.0 を 距離: maxR〜minR にマッピング
  const maxR = Math.min(width, height) / 2 - 24;
  const minR = 28;
  const radiusScale = d3.scaleLinear().domain([0.3, 1.0]).range([maxR, minR]).clamp(true);

  nodes.forEach((n, i) => {
    if (n.isCenter) { n.r = cx; n.fx = cx; n.fy = cy; return; }
    const dist = radiusScale(n.similarity ?? 0.5);
    const angle = (i / top.length) * Math.PI * 2 - Math.PI / 2;
    n.x = cx + Math.cos(angle) * dist;
    n.y = cy + Math.sin(angle) * dist;
  });

  // 接続線（中心 → 各ノード、距離が近いほど濃い線）
  const g = svg.append('g');

  nodes.filter(n => !n.isCenter).forEach(n => {
    g.append('line')
      .attr('x1', cx).attr('y1', cy)
      .attr('x2', n.x).attr('y2', n.y)
      .attr('stroke', '#A855F7')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', n.similarity ?? 0.3)
      .attr('stroke-dasharray', '2,2');
  });

  // ノード（円 + ラベル）
  const nodeG = g.selectAll('.bubble-node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .style('cursor', d => d.isCenter ? 'default' : 'pointer')
    .on('click', (_, d) => { if (!d.isCenter) location.href = `detail.html?id=${d.id}`; });

  nodeG.append('circle')
    .attr('r', d => d.isCenter ? 22 : 14)
    .attr('fill', d => d.isCenter ? '#A855F730' : '#A855F715')
    .attr('stroke', '#A855F7')
    .attr('stroke-width', d => d.isCenter ? 2 : 1.5);

  nodeG.append('text')
    .attr('y', d => d.isCenter ? 36 : 26)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('font-size', d => d.isCenter ? '10px' : '9px')
    .attr('fill', d => d.isCenter ? '#E8EDF5' : '#A855F7')
    .each(function (d) {
      const title = d.title ?? '';
      const truncated = title.length > 12 ? title.slice(0, 12) + '…' : title;
      d3.select(this).text(truncated);
    });

  nodeG.filter(d => !d.isCenter).append('text')
    .attr('y', d => 38)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('font-size', '8px')
    .attr('fill', '#7A8FAD')
    .text(d => `${((d.similarity ?? 0) * 100).toFixed(0)}%`);

  // 凡例
  list.insertAdjacentHTML('beforeend', `
    <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-dim);margin-top:8px;display:flex;align-items:center;gap:6px">
      <span style="width:8px;height:8px;border-radius:50%;background:#A855F730;border:1px solid #A855F7;display:inline-block"></span>
      中心に近いほど意味的に類似（クリックで遷移）
    </div>
  `);
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
    id: n.id,
    label: n.title ?? n.name ?? n.id,
    color: n.label === 'Tag'
      ? { background: '#10B98120', border: '#10B981' }
      : { background: '#3B82F620', border: '#3B82F6' },
    shape: n.label === 'Tag' ? 'box' : 'dot',
    font: { color: '#E8EDF5', size: 11, face: 'JetBrains Mono' },
  }));

  // cooccurrence: true のエッジ（タグ同士の共起関係）は緑の点線で区別
  const visEdges = edges.map((e, i) => ({
    id: i, from: e.from, to: e.to,
    color: e.cooccurrence
      ? { color: '#10B981', highlight: '#10B981' }
      : { color: '#2A3F5F', highlight: '#3B82F6' },
    width: e.cooccurrence ? 2 : 1,
    dashes: !!e.cooccurrence,
    title: e.cooccurrence ? `共起元の記事: ${e.via ?? ''}` : undefined,
  }));

  const data = { nodes: new vis.DataSet(visNodes), edges: new vis.DataSet(visEdges) };
  const options = {
    physics: { stabilization: { iterations: 100 } },
    interaction: { hover: true, dragNodes: true },
    nodes: { shape: 'dot', size: 10, borderWidth: 2 },
    edges: { smooth: { type: 'continuous' } },
  };

  container.innerHTML = '';
  new vis.Network(container, data, options);

  // 凡例
  const legend = document.createElement('div');
  legend.style.cssText = 'font-family:var(--font-mono);font-size:9px;color:var(--text-dim);margin-top:6px;display:flex;gap:12px;flex-wrap:wrap';
  legend.innerHTML = `
    <span><span style="display:inline-block;width:14px;border-top:2px solid #2A3F5F;margin-right:4px;vertical-align:middle"></span>記事⇄タグ</span>
    <span><span style="display:inline-block;width:14px;border-top:2px dashed #10B981;margin-right:4px;vertical-align:middle"></span>タグ同士の共起</span>
  `;
  container.parentElement.appendChild(legend);
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
    if (line.startsWith('## ')) { html += `<h2>${escHtml(line.slice(3))}</h2>`; continue; }
    if (line.startsWith('### ')) { html += `<h3>${escHtml(line.slice(4))}</h3>`; continue; }
    if (line.startsWith('- ')) { html += `<ul><li>${escHtml(line.slice(2))}</li></ul>`; continue; }
    if (line.trim() === '') { continue; }
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
