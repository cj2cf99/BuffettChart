import { freshness } from './freshness.js';
function updateStatus() {
  const status = document.querySelector('[data-updated-on]');
  if (!status) return;
  try {
    const { stale, dueOn } = freshness(status.dataset.updatedOn);
    status.classList.toggle('stale', stale);
    document.querySelector('#status-title').textContent = stale ? '数据超过 5 个月未更新，请更新后再观察' : '当前展示已保存的季度快照';
    document.querySelector('#status-detail').textContent = stale
      ? `快照最后更新于 ${status.dataset.updatedOn}，已超过 ${dueOn} 的五个月期限。请维护者核查官方数据并更新；当前数值保留供历史参考。`
      : `快照最后更新于 ${status.dataset.updatedOn}。如到 ${dueOn} 后仍未更新，这里将提示需要更新。`;
    document.querySelector('#status-label').textContent = stale ? '需要更新' : '季度快照';
  } catch {
    status.classList.add('stale');
    document.querySelector('#status-title').textContent = '无法确认更新日期，请维护者核查';
  }
}
updateStatus();
// A page kept open across the deadline must also change its status.
setInterval(updateStatus, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateStatus(); });
