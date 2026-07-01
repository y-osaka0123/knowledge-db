/**
 * js/pca.js
 * 高次元のEmbeddingを2次元（X, Y）にPCA削減する軽量ライブラリ
 */

export function computePCA2D(embeddings) {
  const n = embeddings.length;
  if (n === 0) return [];
  const d = embeddings[0].length;

  // 1. 各次元の平均値を算出して中心化（Mean Centering）
  const means = new Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      means[j] += embeddings[i][j];
    }
  }
  for (let j = 0; j < d; j++) means[j] /= n;

  const centered = [];
  for (let i = 0; i < n; i++) {
    centered.push(embeddings[i].map((val, j) => val - means[j]));
  }

  // 2. 共分散行列の簡易計算（またはベキ乗法による固有ベクトル抽出）
  // ライブラリなしで安定して2次元を抜くため、ベキ乗法(Power Iteration)を2回回します。

  function powerIteration(matrixData, maxIter = 100) {
    let v = new Array(d).fill(0).map(() => Math.random() - 0.5);
    // 正規化
    let len = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
    v = v.map(val => val / (len || 1));

    for (let iter = 0; iter < maxIter; iter++) {
      const nextV = new Array(d).fill(0);
      // 行列とベクトルの積 (X^T * (X * v)) を計算して共分散行列の計算を代替 (O(nd)化)
      const X_v = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < d; j++) {
          X_v[i] += matrixData[i][j] * v[j];
        }
      }
      for (let j = 0; j < d; j++) {
        for (let i = 0; i < n; i++) {
          nextV[j] += matrixData[i][j] * X_v[i];
        }
      }

      const nLen = Math.sqrt(nextV.reduce((sum, val) => sum + val * val, 0));
      if (nLen === 0) break;
      v = nextV.map(val => val / nLen);
    }
    return v;
  }

  // 第1主成分 (PC1)
  const pc1 = powerIteration(centered);

  // 第1主成分の成分を除去（直交化）して第2主成分を計算するためのデータ作成
  const residual = [];
  for (let i = 0; i < n; i++) {
    const dot = centered[i].reduce((sum, val, j) => sum + val * pc1[j], 0);
    residual.push(centered[i].map((val, j) => val - dot * pc1[j]));
  }

  // 第2主成分 (PC2)
  const pc2 = powerIteration(residual);

  // 3. データをPC1, PC2空間に射影
  return centered.map(row => {
    const x = row.reduce((sum, val, j) => sum + val * pc1[j], 0);
    const y = row.reduce((sum, val, j) => sum + val * pc2[j], 0);
    return { x, y };
  });
}