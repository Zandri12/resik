import { api } from './apiClient'

export { authApi, type AuthUser } from './authApi'

export interface UsersListMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  counts?: { owner: number; admin: number; karyawan: number }
}

export const usersApi = {
  list: (params?: {
    search?: string
    role?: string
    page?: number
    per_page?: number
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  }) => api.get<{ data: unknown[]; meta: UsersListMeta }>('/users', { params }),
  get: (id: number) => api.get(`/users/${id}`),
  create: (data: { name: string; email: string; password: string; role: string }) =>
    api.post('/users', data),
  update: (id: number, data: Partial<{ name: string; email: string; password?: string; role: string }>) =>
    api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
  resetPassword: (id: number) =>
    api.post<{ message: string; temporary_password: string }>(`/users/${id}/reset-password`),
}

export const rolePermissionsApi = {
  list: () =>
    api.get<{
      permissions: Record<string, Record<string, boolean>>
      groups: Record<string, string[]>
      labels: Record<string, string>
    }>('/role-permissions'),
  update: (role: string, permissions: Record<string, boolean>) =>
    api.put('/role-permissions', { role, permissions }),
}

export const customersApi = {
  list: (params?: Record<string, string>, config?: { signal?: AbortSignal }) =>
    api.get('/customers', { params, ...config }),
  get: (id: number) => api.get(`/customers/${id}`),
  create: (data: Record<string, unknown>) => api.post('/customers', data),
  update: (id: number, data: Record<string, unknown>) =>
    api.put(`/customers/${id}`, data),
  delete: (id: number) => api.delete(`/customers/${id}`),
}

export const midtransApi = {
  config: () => api.get<{ enabled: boolean; client_key: string | null; is_production?: boolean }>('/midtrans/config'),
  createSnapToken: (orderId: number) =>
    api.post<{ token: string; order_id: number; order_number: string }>(`/orders/${orderId}/midtrans/snap-token`),
}

/** Optional fields on orders (pembukuan / selaras Excel klien). */
export type OrderBookkeepingPayload = {
  receipt_number?: string | null
  transaction_category?: string | null
  paid_at?: string | null
  taken_at?: string | null
  whatsapp_order_sent_at?: string | null
  whatsapp_done_sent_at?: string | null
  notes?: string | null
}

export const ordersApi = {
  list: (params?: Record<string, string>, config?: { signal?: AbortSignal }) =>
    api.get('/orders', { params, ...config }),
  get: (id: number) => api.get(`/orders/${id}`),
  create: (data: Record<string, unknown> & Partial<OrderBookkeepingPayload>) =>
    api.post('/orders', data),
  update: (id: number, data: Record<string, unknown> & Partial<OrderBookkeepingPayload>) =>
    api.put(`/orders/${id}`, data),
  updateStatus: (id: number, statusId: number) =>
    api.put(`/orders/${id}`, { status_id: statusId }),
  delete: (id: number) => api.delete(`/orders/${id}`),
  /** Ringkasan order ke WhatsApp outlet (Fonnte); sama seperti notifikasi saat order baru. */
  sendToWhatsApp: (id: number) =>
    api.post<{ success: boolean; reason?: string | null }>(`/orders/${id}/send-whatsapp`),
  uploadImage: (orderId: number, file: File, type?: string) => {
    const form = new FormData()
    form.append('image', file)
    if (type) form.append('type', type)
    return api.post(`/orders/${orderId}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteImage: (orderId: number, imageId: number) =>
    api.delete(`/orders/${orderId}/images/${imageId}`),
}

export const orderStatusesApi = {
  list: () => api.get('/order-statuses'),
}

export const servicePackagesApi = {
  list: (activeOnly = true) =>
    api.get('/service-packages', { params: { active_only: activeOnly } }),
  listAll: () => api.get('/service-packages'),
  get: (id: number) => api.get(`/service-packages/${id}`),
  create: (data: Record<string, unknown>) => api.post('/service-packages', data),
  update: (id: number, data: Record<string, unknown>) =>
    api.put(`/service-packages/${id}`, data),
  delete: (id: number) => api.delete(`/service-packages/${id}`),
}

export const expensesApi = {
  list: (params?: Record<string, string>) => api.get('/expenses', { params }),
  create: (data: Record<string, unknown>) => api.post('/expenses', data),
  update: (id: number, data: Record<string, unknown>) =>
    api.put(`/expenses/${id}`, data),
  delete: (id: number) => api.delete(`/expenses/${id}`),
}

export const expenseCategoriesApi = {
  list: () => api.get('/expense-categories'),
}

export const dashboardApi = {
  get: (period = 'today') => api.get('/dashboard', { params: { period } }),
  weeklyTrend: (options?: {
    offset?: number
    end_date?: string
    from_date?: string
    to_date?: string
    all_statuses?: boolean
  }) => {
    const params: Record<string, string | number | boolean> = {}
    if (options?.offset !== undefined) params.offset = options.offset
    if (options?.end_date) params.end_date = options.end_date
    if (options?.from_date) params.from_date = options.from_date
    if (options?.to_date) params.to_date = options.to_date
    if (options?.all_statuses) params.all_statuses = true
    return api.get('/dashboard/weekly-trend', { params })
  },
  monthlyTrend: (months = 12) =>
    api.get('/dashboard/monthly-trend', { params: { months } }),
}

export type PublicOutletProfile = {
  outlet_name: string
  address: string
  phone: string
}

export const publicOutletApi = {
  profile: () => api.get<PublicOutletProfile>('/public/outlet-profile'),
}

export const outletSettingsApi = {
  list: () => api.get('/outlet-settings'),
  update: (settings: { key: string; value: string }[]) =>
    api.post('/outlet-settings', { settings }),
  testWhatsApp: () => api.post('/outlet-settings/test-whatsapp'),
}

export type EmployeePerformanceRow = {
  user_id: number | null
  name: string
  orders_count: number
  completed_count: number
  cancelled_count: number
  total_revenue: number
  total_paid: number
  avg_order_value: number
  completion_rate: number
}

export type EmployeePerformanceSummary = {
  period_days: number
  total_orders: number
  total_completed: number
  total_cancelled: number
  total_revenue: number
  total_paid: number
  karyawan_count: number
}

export const employeePerformanceApi = {
  list: (
    params: {
      from: string
      to: string
      sort?: 'orders' | 'revenue' | 'paid' | 'name' | 'completed'
      dir?: 'asc' | 'desc'
    },
    config?: { signal?: AbortSignal }
  ) =>
    api.get<{
      from: string
      to: string
      sort: string
      dir: string
      summary: EmployeePerformanceSummary
      is_own_only: boolean
      rows: EmployeePerformanceRow[]
    }>('/employee-performance', { params, ...config }),
}

export type LandingContentKind = 'promo' | 'pengumuman' | 'info'

export type LandingContentItem = {
  id: number
  title: string
  slug: string | null
  excerpt: string | null
  body: string | null
  kind: LandingContentKind
  image_url: string | null
  link_url: string | null
  cta_label: string | null
  sort_order: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

/** Item publik di landing (tanpa body Markdown penuh). */
export type LandingContentPublicItem = {
  id: number
  title: string
  slug: string | null
  kind: LandingContentKind
  image_url: string | null
  link_url: string | null
  cta_label: string | null
  sort_order: number
  preview: string | null
}

/** Respons paginasi Laravel untuk `GET /landing-contents` */
export type LandingContentsPaginated = {
  data: LandingContentItem[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export const landingContentsApi = {
  /** Tanpa login — untuk halaman publik (maks. 100 item) */
  publicList: (params?: { limit?: number }) =>
    api.get<LandingContentPublicItem[]>('/public/landing-contents', { params }),
  /** Tanpa login — detail satu konten (Markdown) */
  publicGet: (slug: string) =>
    api.get<LandingContentItem & { created_at?: string; updated_at?: string }>(
      `/public/landing-contents/${encodeURIComponent(slug)}`
    ),
  list: (params?: {
    page?: number
    per_page?: number
    search?: string
    kind?: LandingContentKind
    status?: 'all' | 'active' | 'inactive'
  }) => api.get<LandingContentsPaginated>('/landing-contents', { params }),
  create: (data: {
    title: string
    slug?: string | null
    excerpt?: string | null
    body?: string | null
    kind: LandingContentKind
    image_url?: string | null
    link_url?: string | null
    cta_label?: string | null
    sort_order?: number
    is_active?: boolean
  }) => api.post<LandingContentItem>('/landing-contents', data),
  update: (
    id: number,
    data: Partial<{
      title: string
      slug: string | null
      excerpt: string | null
      body: string | null
      kind: LandingContentKind
      image_url: string | null
      link_url: string | null
      cta_label: string | null
      sort_order: number
      is_active: boolean
    }>
  ) => api.put<LandingContentItem>(`/landing-contents/${id}`, data),
  delete: (id: number) => api.delete(`/landing-contents/${id}`),
}

export const reportsApi = {
  getData: (params: { from: string; to: string; type: string }) =>
    api.get('/reports', { params }),
  download: (params: {
    from: string
    to: string
    type: string
    format: 'pdf' | 'excel'
    signature?: string
  }) =>
    api.get('/reports/download', {
      params,
      responseType: 'blob',
    }),
}
