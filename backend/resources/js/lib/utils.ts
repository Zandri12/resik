import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Mendeteksi fragmen HTML (CKEditor, dll.), bukan hanya Markdown. */
export function looksLikeHtml(s: string): boolean {
  const t = s.trim().replace(/^\uFEFF/, "")
  if (/<\s*(img|figure|picture|table|h[1-6]|p|div|span|section|article|blockquote|ul|ol)\b/i.test(t)) {
    return true
  }
  if (!t.startsWith("<")) return false
  return /<\/?[a-z][\s>/]/i.test(t)
}

/** URL gambar pertama dari HTML (kartu landing / meta). */
export function firstImageUrlFromHtml(html: string): string | null {
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch?.[1]) return imgMatch[1]
  const srcsetImg = html.match(/<img[^>]+srcset=["']([^"']+)["']/i)
  if (srcsetImg?.[1]) {
    const first = srcsetImg[1].split(",")[0]?.trim().split(/\s+/)[0]
    if (first) return first
  }
  const srcsetSource = html.match(/<source[^>]+srcset=["']([^"']+)["']/i)
  if (srcsetSource?.[1]) {
    const first = srcsetSource[1].split(",")[0]?.trim().split(/\s+/)[0]
    if (first) return first
  }
  return null
}
