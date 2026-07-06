
function extractHistoryTimestamp(item) {
  return item?.timestamp ||
    item?.created_at ||
    item?.createdAt ||
    item?.ts ||
    item?.payload?.timestamp ||
    item?.payload?.created_at ||
    item?.payload?.createdAt ||
    item?.payload?.ts ||
    null;
}

function timestampToMs(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : null;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareLocalSessions(a, b) {
  return (b.updatedAt || 0) - (a.updatedAt || 0);
}

function parseTimeMs(value) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function sqliteTimeMs(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return parseTimeMs(value);
  if (value > 100000000000) return value;
  if (value > 100000000) return value * 1000;
  return 0;
}

function formatDateTime(value) {
  const ms = typeof value === 'number' ? value : parseTimeMs(value);
  if (!ms) return '-';
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function truncateText(value, maxLength) {
  const text = stringOrEmpty(value).replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text || '(无标题)';
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function stringOrEmpty(value) {
  return typeof value === 'string' ? value.trim() : '';
}

module.exports = {
  compareLocalSessions,
  extractHistoryTimestamp,
  formatDateTime,
  parseTimeMs,
  sqliteTimeMs,
  stringOrEmpty,
  timestampToMs,
  truncateText,
};
