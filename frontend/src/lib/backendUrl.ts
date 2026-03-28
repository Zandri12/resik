/** Laravel app origin, no trailing slash. Kosong = same-origin (proxy dev Vite). */
function backendOrigin(): string {
  return (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, '') ?? ''
}

export function apiBaseURL(): string {
  const o = backendOrigin()
  return o ? `${o}/api` : '/api'
}

export function storagePublicURL(path: string): string {
  const o = backendOrigin()
  const p = path.replace(/^\//, '')
  return o ? `${o}/storage/${p}` : `/storage/${p}`
}
