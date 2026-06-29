const SESSION_KEY = "echohex_temp_user_id"

export function getTempUserId(): string {
  if (typeof window === "undefined") return crypto.randomUUID()

  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}
