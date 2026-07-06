function ensurePendingPermissionMap(session) {
  if (session.pendingPermissions instanceof Map) return session.pendingPermissions;

  const map = new Map();
  if (session.pendingPermission?.requestId) {
    map.set(String(session.pendingPermission.requestId), session.pendingPermission);
  }
  session.pendingPermissions = map;
  return map;
}

function setPendingPermission(session, pending) {
  if (!pending?.requestId) return;
  const map = ensurePendingPermissionMap(session);
  map.set(String(pending.requestId), pending);
  syncLegacyPendingPermission(session);
}

function getPendingPermission(session, requestId, provider) {
  const map = ensurePendingPermissionMap(session);
  const normalized = String(requestId || '').trim();

  if (normalized) {
    const pending = map.get(normalized) || null;
    return matchesProvider(pending, provider) ? pending : null;
  }

  const matching = Array.from(map.values()).filter(pending => matchesProvider(pending, provider));
  return matching.length === 1 ? matching[0] : null;
}

function removePendingPermission(session, requestId) {
  const map = ensurePendingPermissionMap(session);
  const normalized = String(requestId || '').trim();
  if (normalized) map.delete(normalized);
  syncLegacyPendingPermission(session);
}

function clearPendingPermissions(session, provider) {
  const map = ensurePendingPermissionMap(session);
  if (!provider) {
    map.clear();
    syncLegacyPendingPermission(session);
    return;
  }

  for (const [requestId, pending] of map) {
    if (matchesProvider(pending, provider)) map.delete(requestId);
  }
  syncLegacyPendingPermission(session);
}

function hasPendingPermissions(session, provider) {
  const map = ensurePendingPermissionMap(session);
  if (!provider) return map.size > 0;
  return Array.from(map.values()).some(pending => matchesProvider(pending, provider));
}

function pendingPermissionIds(session, provider) {
  return Array.from(ensurePendingPermissionMap(session).values())
    .filter(pending => matchesProvider(pending, provider))
    .map(pending => String(pending.requestId));
}

function matchesProvider(pending, provider) {
  if (!pending) return false;
  return !provider || pending.provider === provider;
}

function syncLegacyPendingPermission(session) {
  const remaining = Array.from(ensurePendingPermissionMap(session).values());
  session.pendingPermission = remaining.length ? remaining[remaining.length - 1] : null;
}

module.exports = {
  clearPendingPermissions,
  ensurePendingPermissionMap,
  getPendingPermission,
  hasPendingPermissions,
  pendingPermissionIds,
  removePendingPermission,
  setPendingPermission,
};
