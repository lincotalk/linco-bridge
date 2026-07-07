import type { BridgeConnectionRow } from '../database/database.service'
import type { BridgePresenceService } from '../bridge/bridge-presence.service'

/** Append device name to session title for multi-device bridge disambiguation. */
export function formatSessionListTitle(title: string, deviceName: string): string {
  const normalizedTitle = title.trim()
  const normalizedDevice = deviceName.trim()
  if (!normalizedDevice) return normalizedTitle

  const suffix = ` - ${normalizedDevice}`
  if (normalizedTitle.endsWith(suffix)) return normalizedTitle

  const parts = normalizedTitle.split(' - ')
  const trailing = parts[parts.length - 1]?.trim().toLowerCase() ?? ''
  if (trailing === normalizedDevice.toLowerCase()) return normalizedTitle

  return normalizedTitle ? `${normalizedTitle}${suffix}` : normalizedDevice
}

/** Remove trailing device suffix for agent landing/history pages. */
export function stripDeviceSuffixFromTitle(title: string, deviceName: string): string {
  const normalizedTitle = title.trim()
  const normalizedDevice = deviceName.trim()
  if (!normalizedTitle || !normalizedDevice) return normalizedTitle

  const suffix = ` - ${normalizedDevice}`
  if (normalizedTitle.endsWith(suffix)) {
    return normalizedTitle.slice(0, -suffix.length).trim() || normalizedTitle
  }

  const parts = normalizedTitle.split(' - ')
  if (parts.length >= 2) {
    const trailing = parts[parts.length - 1]?.trim().toLowerCase() ?? ''
    if (trailing === normalizedDevice.toLowerCase()) {
      return parts.slice(0, -1).join(' - ').trim() || normalizedTitle
    }
  }

  return normalizedTitle
}

export function resolveConnectionDeviceName(
  connectionId: string,
  presence: BridgePresenceService,
  connection?: Pick<BridgeConnectionRow, 'device_name' | 'device_id'>,
): string {
  const live = presence.getDeviceInfo(connectionId)
  const liveName = live?.name?.trim() || live?.id?.trim() || ''
  if (liveName) return liveName

  const storedName = connection?.device_name?.trim() || connection?.device_id?.trim() || ''
  return storedName
}

export function resolveSessionDeviceName(
  sessionDeviceName: string | null | undefined,
  connection: BridgeConnectionRow | undefined,
  presence: BridgePresenceService,
): string {
  const fromSession = sessionDeviceName?.trim() ?? ''
  if (fromSession) return fromSession
  if (!connection) return ''
  return resolveConnectionDeviceName(connection.id, presence, connection)
}
