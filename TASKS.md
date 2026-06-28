# knowledge-db 実装タスク

## Phase 1: プロジェクト基盤
- [x] ディレクトリ構造作成
- [x] TASKS.md作成
- [x] 環境変数ファイル（config.js）作成
- [x] index.html（骨格）実装
- [x] CSS（デザインシステム）実装
- [x] ナレッジ一覧ページUI実装
- [x] ナレッジ詳細ページUI実装（detail.html）[2026-06-28]

## Phase 2: Supabase（RDB + Storage）
- [x] ~~*Supabaseプロジェクト作成（手動）*~~ [2026-06-28]（
- [x] ~~*テーブル設計・SQL実行（手動）*~~ [2026-06-28]
- [x] ~~*RLS設定（読み取り公開）（手動）*~~ [2026-06-28]
- [x] js/db/supabase.js 実装（接続・CRUD）[2026-06-28]
- [x] 記事一覧をRDBから取得・表示 [2026-06-28]
- [x] タグ絞り込み機能実装 [2026-06-28]
- [x] ファイルストレージ画像表示実装 [2026-06-28]

## Phase 3: pgvector（ベクターDB）
- [ ] ~~*pgvector拡張有効化 + テーブル + 関数作成（手動）*~~ → sql/phase3_pgvector.sql を実行
- [ ] ~~*記事登録後に Embedding 投入（手動）*~~ → tools/embed_articles.html をブラウザで開いて実行
- [x] Transformers.js導入（CDN）[2026-06-28]
- [x] js/db/vector.js 実装（Embedding生成・類似検索）[2026-06-28]
- [x] 意味検索UI・類似記事サイドバー実装（detail.html）[2026-06-28]

## Phase 4: Neo4j Aura（グラフDB）
- [ ] ~~*Neo4j Aura Free インスタンス作成（手動）*~~
- [ ] ~~*ノード・エッジ投入（手動）*~~ → Cypher は下記参照
- [x] js/db/graph.js 実装（Bolt接続・Cypher実行）[2026-06-28]
- [ ] 関連グラフ vis.js 可視化（detail.html 組み込み済、接続後に動作確認）

## Phase 5: データ構造パネル
- [x] js/components/dataPanel.js 実装 [2026-06-28]
- [x] 各DB操作時にパネルに表示する仕組み実装 [2026-06-28]
- [x] 記事詳細ページにパネル組み込み [2026-06-28]

## Phase 6: 公開
- [ ] ~~*GitHub Pages 設定（手動）*~~
- [ ] README.md作成
- [ ] 動作確認・スクリーンショット撮影

---

## Phase 3 手動手順

### ① Supabase SQL Editor で実行
`sql/phase3_pgvector.sql` をそのままコピーして実行。

### ② 記事データを登録（Supabase Dashboard > Table Editor）
articles テーブルに数件記事を入れて `published = true` にする。

### ③ Embedding 投入ツールを実行
`tools/embed_articles.html` をブラウザで開いて「▶ 開始」ボタンを押す。
※ GitHub Pages には **含めない**（ローカル専用ツール）。

---

## Phase 4 手動手順（Neo4j Aura）

### ① Aura Free インスタンス作成
https://console.neo4j.io → New Instance → Free → URI・パスワードをメモ → config.js に記入

### ② ノード・エッジ投入 Cypher
Neo4j Aura Console の Query タブで実行：

```cypher
// 記事ノード（Supabase の UUID をそのまま使う）
MERGE (a:Article {supabase_id: "YOUR_ARTICLE_UUID", title: "記事タイトル"})

// タグノード
MERGE (t:Tag {name: "DB"})
MERGE (t2:Tag {name: "AWS"})

// 関係
MERGE (a)-[:HAS_TAG]->(t)
MERGE (a)-[:HAS_TAG]->(t2)
```

### ③ 動作確認クエリ
```cypher
MATCH (a:Article)-[:HAS_TAG]->(t:Tag)
RETURN a.title, collect(t.name) AS tags
```

---

## ファイル構成
```
knowledge-db/
├── index.html            一覧ページ（公開）
├── detail.html           詳細ページ（公開）
├── css/style.css         デザインシステム
├── js/
│   ├── config.js         接続情報（要記入）
│   ├── main.js           一覧ページロジック
│   ├── detail.js         詳細ページロジック
│   ├── db/
│   │   ├── supabase.js   RDB + Storage
│   │   ├── vector.js     pgvector 意味検索
│   │   └── graph.js      Neo4j グラフ探索
│   └── components/
│       └── dataPanel.js  DBパネル状態管理
├── sql/
│   └── phase3_pgvector.sql  pgvector セットアップSQL
└── tools/
    └── embed_articles.html  Embedding一括投入ツール（ローカル専用）
```
