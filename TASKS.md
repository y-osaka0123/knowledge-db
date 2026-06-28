# knowledge-db 実装タスク

## Phase 1: プロジェクト基盤
- [x] ディレクトリ構造作成
- [x] TASKS.md作成
- [x] 環境変数ファイル（config.js）作成
- [x] index.html（骨格）実装
- [x] CSS（デザインシステム）実装
- [x] ナレッジ一覧ページUI実装
- [ ] ナレッジ詳細ページUI実装（detail.html）

## Phase 2: Supabase（RDB + Storage）
- [ ] Supabaseプロジェクト作成（手動）
- [ ] テーブル設計・SQL実行（手動）
- [ ] RLS設定（読み取り公開）（手動）
- [ ] js/db/supabase.js 実装（接続・CRUD）
- [ ] 記事一覧をRDBから取得・表示
- [ ] タグ絞り込み機能実装
- [ ] ファイルストレージ画像表示実装

## Phase 3: pgvector（ベクターDB）
- [ ] pgvector拡張有効化（手動）
- [ ] embeddingsテーブル作成（手動）
- [ ] Transformers.js導入
- [ ] js/db/vector.js 実装（Embedding生成・類似検索）
- [ ] 意味検索UIと結果表示実装

## Phase 4: Neo4j Aura（グラフDB）
- [ ] Neo4j Aura Freeインスタンス作成（手動）
- [ ] ノード・エッジ設計（手動）
- [ ] js/db/graph.js 実装（Bolt接続・Cypher実行）
- [ ] 関連タグ・記事のグラフ探索実装
- [ ] グラフ可視化（D3.js or vis.js）実装

## Phase 5: データ構造パネル
- [ ] js/components/dataPanel.js 実装
- [ ] 各DB操作時にパネルに表示する仕組み実装
- [ ] 記事詳細ページにパネル組み込み

## Phase 6: 公開
- [ ] GitHub Pages設定（手動）
- [ ] README.md作成
- [ ] 動作確認・スクリーンショット撮影
