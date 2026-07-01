/**
 * js/map.js
 * 知識マップのエントリポイント
 */

import { fetchAllEmbeddings } from './db/vector.js';
import { computePCA2D } from './pca.js';

const container = document.getElementById('mapContainer');
const tooltip = d3.select('#tooltip');
const width = container.clientWidth;
const height = container.clientHeight;

async function initMap() {
  try {
    // 1. Supabase から全件データをロード
    const rawArticles = await fetchAllEmbeddings();
    if (!rawArticles.length) {
      document.getElementById('loading').textContent = '⚠️ 記事データがありません。';
      return;
    }

    // 2. Embeddingを配列に抽出してPCAを適用
    const embeddings = rawArticles.map(a => a.embedding);
    console.log(`[map.js] ${rawArticles.length} 件のEmbeddingをPCA圧縮中...`);
    const coords = computePCA2D(embeddings);

    // 記事情報と座標をマージ
    const nodes = rawArticles.map((art, idx) => ({
      id: art.id,
      title: art.title,
      excerpt: art.excerpt || '',
      x: coords[idx].x,
      y: coords[idx].y
    }));

    // 3. ローディングを非表示に
    document.getElementById('loading').style.display = 'none';

    // 4. D3.js 描画セットアップ
    const svg = d3.select('#mapContainer')
      .append('svg')
      .attr('viewBox', [0, 0, width, height]);

    // ズーム対象となる全体グループ
    const g = svg.append('g');

    // スケールの設定（PCAの出力を画面サイズにフィットさせる）
    const padding = 60;
    const xScale = d3.scaleLinear()
      .domain(d3.extent(nodes, d => d.x))
      .range([padding, width - padding]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(nodes, d => d.y))
      .range([height - padding, padding]);

    // 座標の正規化マッピング
    nodes.forEach(n => {
      n.x = xScale(n.x);
      n.y = yScale(n.y);
    });

    // ズーム・パン機能の定義
    const zoom = d3.zoom()
      .scaleExtent([0.5, 8]) // ズーム倍率範囲
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // プロット（ドット）の描画
    const dots = g.selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        location.href = `detail.html?id=${d.id}`;
      });

    // ドットの円
    dots.append('circle')
      .attr('r', 6)
      .attr('fill', '#A855F7')
      .attr('fill-opacity', 0.6)
      .attr('stroke', '#C084FC')
      .attr('stroke-width', 1.5)
      .on('mouseover', function (event, d) {
        d3.select(this)
          .transition().duration(150)
          .attr('r', 10)
          .attr('fill-opacity', 0.9)
          .attr('fill', '#F472B6'); // ホバー時に色変更

        tooltip.style('opacity', 1)
          .html(`
            <strong style="color:#C084FC;font-size:12px;">${escapeHtml(d.title)}</strong>
            <p style="margin:4px 0 0 0;color:#94A3B8;font-size:10px;">${escapeHtml(d.excerpt.slice(0, 60))}...</p>
          `);
      })
      .on('mousemove', function (event) {
        tooltip
          .style('left', (event.pageX + 15) + 'px')
          .style('top', (event.pageY - 15) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this)
          .transition().duration(150)
          .attr('r', 6)
          .attr('fill-opacity', 0.6)
          .attr('fill', '#A855F7');

        tooltip.style('opacity', 0);
      });

    // 微小な文字ラベルをノードの横に添える（拡大した時に見えるようにする）
    dots.append('text')
      .attr('x', 10)
      .attr('y', 4)
      .attr('font-size', '9px')
      .attr('fill', '#94A3B8')
      .style('pointer-events', 'none')
      .text(d => d.title.length > 10 ? d.title.slice(0, 10) + '…' : d.title);

  } catch (err) {
    console.error('[map.js] 初期化エラー:', err);
    document.getElementById('loading').textContent = `❌ エラーが発生しました: ${err.message}`;
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.addEventListener('DOMContentLoaded', initMap);