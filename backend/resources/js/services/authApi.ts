import { api } from './apiClient'

export type AuthUser = {
  id: number
  name: string
  email: string
  role: string
  permissions?: Record<string, boolean>
  avatar_url?: string | null
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: AuthUser; token: string }>('/login', { email, password }),
  logout: () => api.post('/logout'),
  user: () => api.get<AuthUser>('/user'),
  updateProfile: (data: {
    name?: string
    email?: string
    password?: string
    password_confirmation?: string
    current_password?: string
  }) => api.patch<AuthUser>('/user', data),
  uploadAvatar: (file: File) => {
    const body = new FormData()
    body.append('avatar', file)
    return api.post<AuthUser>('/user/avatar', body)
  },
  deleteAvatar: () => api.delete<AuthUser>('/user/avatar'),
}
