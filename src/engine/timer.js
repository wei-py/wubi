/** 为新的当前字开始计时 */
export function startChar(now) {
  return { charStartAt: now, timeouts: 0 };
}

/**
 * 检查是否到达新的超时点（每超过 timeoutMs 触发一次）。
 * timeoutMs <= 0 表示不启用超时。
 */
export function checkTimeout(timer, timeoutMs, now) {
  if (timeoutMs <= 0) return { timer, timedOut: false };
  if (now - timer.charStartAt >= (timer.timeouts + 1) * timeoutMs) {
    return {
      timer: { charStartAt: timer.charStartAt, timeouts: timer.timeouts + 1 },
      timedOut: true,
    };
  }
  return { timer, timedOut: false };
}

/** 当前字已耗时（毫秒） */
export function elapsed(timer, now) {
  return Math.max(0, now - timer.charStartAt);
}
