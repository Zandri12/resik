import DOMPurify from 'dompurify'
import { MarkdownArticle } from '@/components/MarkdownArticle'
import { looksLikeHtml } from '@/lib/utils'

type ArticleBodyProps = {
  body: string | null | undefined
}

/**
 * Konten dari CKEditor (HTML) disanitasi; konten lama berbasis Markdown tetap diproses lewat react-markdown.
 */
export function ArticleBody({ body }: ArticleBodyProps) {
  if (!body?.trim()) {
    return <p className="text-on-surface-variant">Tidak ada isi tambahan.</p>
  }

  if (looksLikeHtml(body)) {
    const clean = DOMPurify.sanitize(body, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target', 'rel'],
    })
    return (
      <div
        className="article-body-html"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    )
  }

  return <MarkdownArticle markdown={body} />
}
