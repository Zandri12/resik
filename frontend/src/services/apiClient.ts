import axios from 'axios'
import { apiBaseURL } from '@/lib/backendUrl'

export const api = axios.create({
  baseURL: apiBaseURL(),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (config.data instanceof FormData) {
    config.headers.delete('Content-Type')
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(e)
  }
)
