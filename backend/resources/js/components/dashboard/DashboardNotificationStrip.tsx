import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { dashNoticePanel, dashPanelHeader } from '@/components/dashboard/dashboard-card-styles'
import { cn } from '@/lib/utils'
import { notificationsApi, type DashboardNotificationRow } from '@/services/api'

function notificationPreviewText(n: DashboardNotificationRow): string {
  const d = n.data ?? {}
  const msg = d.message
  if (typeof msg === 'string' && msg.trim()) return msg.trim()
  const title = d.title
  if (typeof title === 'string' && title.trim()) return title.trim()
  const parts = n.type.split('\\')
  const short = parts[parts.length - 1] ?? 'Notifikasi'
  return short.replace(/Notification$/, '').replace(/([a-z])([A-Z])/g, '$1 $2') || 'Notifikasi'
}

export function DashboardNotificationStrip() {
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<DashboardNotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [countRes, listRes] = await Promise.all([
        notificationsApi.unreadCount(),
        notificationsApi.list({ per_page: 5 }),
      ])
      const countBody = countRes.data as { count?: number }
      setUnread(typeof countBody?.count === 'number' ? countBody.count : 0)

      const listBody = listRes.data as { data?: DashboardNotificationRow[] }
      const rows = Array.isArray(listBody?.data) ? listBody.data : []
      setItems(rows)
    } catch {
      setUnread(0)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const markOne = async (id: string) => {
    setBusy(true)
    try {
      await notificationsApi.markRead(id)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const markAll = async () => {
    setBusy(true)
    try {
      await notificationsApi.markAllRead()
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (loading && items.length === 0 && unread === 0) {
    return (
      <Card className={cn(dashNoticePanel, 'py-4')} aria-hidden>
        <CardHeader className={cn(dashPanelHeader, 'space-y-2')}>
          <Skeleton className="h-5 w-48 rounded-md" />
          <Skeleton className="h-4 w-full max-w-md rounded-md" />
        </CardHeader>
      </Card>
    )
  }

  if (!loading && items.length === 0 && unread === 0) {
    return null
  }

  return (
    <Card className={dashNoticePanel}>
      <CardHeader
        className={cn(
          dashPanelHeader,
          'flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between'
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="material-symbols-outlined shrink-0 text-primary text-xl" aria-hidden>
            notifications
          </span>
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">Notifikasi</CardTitle>
          {unread > 0 ? (
            <Badge
              variant="outline"
              className="h-auto border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary tabular-nums"
            >
              {unread} belum dibaca
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Semua sudah dibaca</span>
          )}
        </div>
        {unread > 0 ? (
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void markAll()}
              className="h-8 rounded-xl text-xs font-semibold"
            >
              Tandai semua dibaca
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2 px-5 pb-5 pt-3 sm:px-6">
      {items.length === 0 && unread > 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada daftar notifikasi terbaru. Anda masih punya pesan belum dibaca.</p>
      ) : null}
      <ul className="space-y-2">
        {items.map((n) => {
          const isUnread = n.read_at == null
          return (
            <li
              key={n.id}
              className={cn(
                'flex flex-col gap-1 rounded-xl border border-border/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between',
                isUnread ? 'bg-primary/5' : 'bg-muted/25'
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-2">{notificationPreviewText(n)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {format(new Date(n.created_at), 'd MMM yyyy, HH:mm', { locale: id })}
                </p>
              </div>
              {isUnread ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void markOne(n.id)}
                  className="h-8 shrink-0 self-start rounded-lg text-xs font-semibold sm:self-center"
                >
                  Tandai dibaca
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>
      </CardContent>
    </Card>
  )
}
