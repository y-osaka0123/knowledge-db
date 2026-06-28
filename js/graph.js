/**
 * js/db/graph.js
 * Neo4j Aura（グラフDB）との接続・Cypher クエリ実行
 * neo4j-driver を CDN から読み込む前提
 */

import { NEO4J_CONFIG } from '../config.js';

let _driver = null;

/**
 * Neo4j ドライバをシングルトンで返す
 */
function getDriver() {
  if (_driver) return _driver;
  const neo4j = window.neo4j;
  _driver = neo4j.driver(
    NEO4J_CONFIG.uri,
    neo4j.auth.basic(NEO4J_CONFIG.username, NEO4J_CONFIG.password)
  );
  return _driver;
}

/**
 * 指定した記事IDに関連する記事・タグをグラフ探索で取得する
 * @param {string} articleId
 * @returns {Promise<{ nodes: Array, edges: Array }>}
 */
export async function fetchRelatedGraph(articleId) {
  const driver = getDriver();
  const session = driver.session({ defaultAccessMode: 'READ' });

  try {
    const result = await session.run(
      `
      MATCH (a:Article {supabase_id: $articleId})-[:HAS_TAG]->(t:Tag)<-[:HAS_TAG]-(related:Article)
      RETURN
        a, t, related,
        [(a)-[:HAS_TAG]->(tag) | tag] AS aTags,
        [(related)-[:HAS_TAG]->(tag) | tag] AS relatedTags
      LIMIT 20
      `,
      { articleId }
    );

    const nodes = [];
    const edges = [];
    const seen = new Set();

    result.records.forEach(record => {
      const articleNode  = record.get('a');
      const tagNode      = record.get('t');
      const relatedNode  = record.get('related');

      // ノード追加（重複排除）
      [articleNode, tagNode, relatedNode].forEach(n => {
        const id = n.identity.toString();
        if (!seen.has(id)) {
          seen.add(id);
          nodes.push({
            id,
            label: n.labels[0],
            ...n.properties,
          });
        }
      });

      // エッジ追加
      edges.push(
        { from: articleNode.identity.toString(), to: tagNode.identity.toString(), label: 'HAS_TAG' },
        { from: relatedNode.identity.toString(), to: tagNode.identity.toString(), label: 'HAS_TAG' }
      );
    });

    return { nodes, edges };
  } finally {
    await session.close();
  }
}

/**
 * タグ名から関連タグを取得する（タグのタグ探索）
 * @param {string} tagName
 * @returns {Promise<Array<{ name: string, count: number }>>}
 */
export async function fetchRelatedTags(tagName) {
  const driver = getDriver();
  const session = driver.session({ defaultAccessMode: 'READ' });

  try {
    const result = await session.run(
      `
      MATCH (t:Tag {name: $tagName})<-[:HAS_TAG]-(a:Article)-[:HAS_TAG]->(related:Tag)
      WHERE related.name <> $tagName
      RETURN related.name AS name, count(a) AS count
      ORDER BY count DESC
      LIMIT 10
      `,
      { tagName }
    );

    return result.records.map(r => ({
      name:  r.get('name'),
      count: r.get('count').toNumber(),
    }));
  } finally {
    await session.close();
  }
}

/**
 * ドライバを閉じる（ページアンロード時に呼ぶ）
 */
export async function closeDriver() {
  if (_driver) {
    await _driver.close();
    _driver = null;
  }
}
