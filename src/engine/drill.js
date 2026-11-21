/** 是否快于给定样本的中位数（用于 mastered 判定） */
export function isFasterThanMedian(ms, samples) {
  if (samples.length === 0) return true;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  return ms <= mid;
}
