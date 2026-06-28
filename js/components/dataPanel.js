/**
 * js/components/dataPanel.js
 * データパネルの状態管理
 * どのDBが「今動いているか」をリアルタイムに表示するシグネチャ機能
 */

const DB_TYPES = ['rdb', 'vec', 'graph', 'storage'];

const STATUS_LABELS = {
  idle:    '待機中',
  loading: '取得中...',
  active:  '完了',
  error:   'エラー',
};

/**
 * DBパネル行のステータスを更新する
 * @param {'rdb'|'vec'|'graph'|'storage'} db
 * @param {'idle'|'loading'|'active'|'error'} status
 * @param {string} [detail] - オプションで detail テキストを上書き
 */
export function setPanelStatus(db, status, detail = null) {
  const row = document.getElementById(`panel-${db}`);
  if (!row) return;

  // active クラス制御
  if (status === 'loading' || status === 'active') {
    row.classList.add('active');
  } else {
    row.classList.remove('active');
  }

  // status バッジ更新
  const statusEl = row.querySelector('.status');
  if (statusEl) statusEl.textContent = STATUS_LABELS[status] ?? status;

  // detail テキスト更新（任意）
  if (detail !== null) {
    const detailEl = row.querySelector('.detail');
    if (detailEl) detailEl.textContent = detail;
  }
}

/**
 * 全DBをリセット（ページ遷移・新規検索時）
 */
export function resetPanel() {
  DB_TYPES.forEach(db => setPanelStatus(db, 'idle'));
}
