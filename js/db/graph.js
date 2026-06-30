/**
 * js/graph.js  – Neo4j Aura グラフ操作
 * neo4j-driver は UMD版のため window.neo4j 経由（HTML側でscriptタグ読み込み済み前提）
 */
import { NEO4J_CONFIG } from '../config.js';

let _driver = null;

function getDriver() {
  if (_driver) return _driver;

  console.log('[graph.js] getDriver() 呼び出し. window.neo4j =', typeof window.neo4j);

  if (typeof window.neo4j === 'undefined') {
    throw new Error('neo4j-driver が読み込まれていません（window.neo4j is undefined）。HTMLのscriptタグ読み込み順序を確認してください。');
  }

  console.log('[graph.js] NEO4J_CONFIG.uri =', NEO4J_CONFIG.uri);
  console.log('[graph.js] NEO4J_CONFIG.username =', NEO4J_CONFIG.username);
  console.log('[graph.js] NEO4J_CONFIG.password =', NEO4J_CONFIG.password ? '(設定済み・非表示)' : '(未設定)');

  if (!NEO4J_CONFIG.uri || NEO4J_CONFIG.uri.includes('%%') || NEO4J_CONFIG.uri.includes('YOUR_')) {
    throw new Error(`NEO4J_CONFIG.uri が未設定またはプレースホルダーのままです: ${NEO4J_CONFIG.uri}`);
  }

  _driver = window.neo4j.driver(
    NEO4J_CONFIG.uri,
    window.neo4j.auth.basic(NEO4J_CONFIG.username, NEO4J_CONFIG.password)
  );
  console.log('[graph.js] driver 生成完了');
  return _driver;
}

export async function fetchRelatedGraph(articleId) {
  console.log('[graph.js] fetchRelatedGraph() 開始. articleId =', articleId);

  const driver = getDriver();
  const session = driver.session({ defaultAccessMode: 'READ' });

  try {
    console.log('[graph.js] Cypher実行中... (記事-タグ-記事)');
    const result = await session.run(
      `MATCH (a:Article {supabase_id: $articleId})-[:HAS_TAG]->(t:Tag)<-[:HAS_TAG]-(r:Article)
       RETURN a, t, r LIMIT 20`,
      { articleId }
    );
    console.log('[graph.js] Cypher実行完了. records数 =', result.records.length);

    const nodes = [], edges = [], seen = new Set();
    result.records.forEach(rec => {
      [rec.get('a'), rec.get('t'), rec.get('r')].forEach(n => {
        const id = n.identity.toString();
        if (!seen.has(id)) { seen.add(id); nodes.push({ id, label: n.labels[0], ...n.properties }); }
      });
      edges.push(
        { from: rec.get('a').identity.toString(), to: rec.get('t').identity.toString() },
        { from: rec.get('r').identity.toString(), to: rec.get('t').identity.toString() }
      );
    });

    if (result.records.length === 0) {
      console.warn('[graph.js] 0件ヒット。Neo4j側に supabase_id =', articleId, 'のArticleノードが存在しない可能性があります。');
    }

    // ── タグ同士の共起関係も取得（「友達の友達」的な構造を補強） ─────
    // 同じ記事に同時に貼られているタグ同士を繋ぐ
    console.log('[graph.js] Cypher実行中... (タグ-タグ共起)');
    const coResult = await session.run(
      `MATCH (a:Article {supabase_id: $articleId})-[:HAS_TAG]->(t1:Tag)
       MATCH (a)-[:HAS_TAG]->(t2:Tag)
       WHERE id(t1) < id(t2)
       RETURN t1, t2, a.title AS via`,
      { articleId }
    );
    console.log('[graph.js] タグ共起 records数 =', coResult.records.length);

    coResult.records.forEach(rec => {
      const t1 = rec.get('t1');
      const t2 = rec.get('t2');
      [t1, t2].forEach(n => {
        const id = n.identity.toString();
        if (!seen.has(id)) { seen.add(id); nodes.push({ id, label: n.labels[0], ...n.properties }); }
      });
      edges.push({
        from: t1.identity.toString(),
        to: t2.identity.toString(),
        cooccurrence: true,
        via: rec.get('via'),
      });
    });

    return { nodes, edges };
  } catch (err) {
    console.error('[graph.js] session.run() でエラー:', err);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * タグ単体を起点にした共起グラフ取得（タグページ等で使う場合に拡張可能）
 * 同じタグを共有する記事の集合 → その記事群が持つ他のタグも辿る
 */
export async function fetchTagCooccurrenceGraph(tagName, depth = 2) {
  const driver = getDriver();
  const session = driver.session({ defaultAccessMode: 'READ' });

  try {
    const result = await session.run(
      `MATCH (t1:Tag {name: $tagName})<-[:HAS_TAG]-(a:Article)-[:HAS_TAG]->(t2:Tag)
       WHERE t1 <> t2
       RETURN t1, t2, a, count(a) AS strength`,
      { tagName }
    );

    const nodes = [], edges = [], seen = new Set();
    result.records.forEach(rec => {
      [rec.get('t1'), rec.get('t2'), rec.get('a')].forEach(n => {
        const id = n.identity.toString();
        if (!seen.has(id)) { seen.add(id); nodes.push({ id, label: n.labels[0], ...n.properties }); }
      });
      edges.push({
        from: rec.get('t1').identity.toString(),
        to: rec.get('t2').identity.toString(),
        strength: rec.get('strength').toNumber(),
      });
    });

    return { nodes, edges };
  } finally {
    await session.close();
  }
}
