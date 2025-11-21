export const NOTIFICATIONS_KEY = "notifications"
export const NOTIFICATIONS_EVENT = "eventful:notifications"

export type StoredNotification = {
  message: string
  icon?: string
}

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined"
}

export function getStoredNotifications(): StoredNotification[] {
  if (!isBrowser()) {
    return []
  }

  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY)
    return raw ? (JSON.parse(raw) as StoredNotification[]) : []
  } catch (error) {
    console.error("Failed to read notifications from storage:", error)
    return []
  }
}

export function persistNotifications(notifications: StoredNotification[]) {
  if (!isBrowser()) {
    return
  }

  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications))
  window.dispatchEvent(
    new CustomEvent(NOTIFICATIONS_EVENT, { detail: notifications })
  )
}

export function addNotificationToStorage(
  notification: StoredNotification,
  options?: { dedupeByMessage?: boolean }
) {
  if (!isBrowser()) {
    return
  }

  const existing = getStoredNotifications()
  if (
    options?.dedupeByMessage &&
    existing.some((item) => item.message === notification.message)
  ) {
    return
  }

  const updated = [...existing, notification]
  persistNotifications(updated)
}
