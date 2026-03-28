import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type MarkdownArticleProps = {
  markdown: string
  className?: string
}

export function MarkdownArticle({ markdown, className }: MarkdownArticleProps) {
  return (
    <div className={className ?? ''}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold underline-offset-2 hover:underline"
              {...props}
            >
              {children}
            </a>
          ),
          h1: ({ children }) => (
            <h1 className="font-headline text-2xl font-bold text-on-surface mt-10 mb-4 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-headline text-xl font-bold text-on-surface mt-8 mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-headline text-lg font-bold text-on-surface mt-6 mb-2">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-4 text-on-surface-variant leading-relaxed last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-4 list-disc pl-6 text-on-surface-variant space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal pl-6 text-on-surface-variant space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/40 pl-4 my-4 italic text-on-surface-variant">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes('language-')
            if (isBlock) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code
                className="rounded bg-surface-container-high px-1.5 py-0.5 text-sm font-mono text-on-surface"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="mb-4 overflow-x-auto rounded-xl bg-surface-container-high p-4 text-sm font-mono text-on-surface border border-outline-variant/20">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-8 border-outline-variant/30" />,
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto rounded-lg border border-outline-variant/20">
              <table className="w-full text-sm text-on-surface-variant">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-outline-variant/30 bg-surface-container-low px-3 py-2 text-left font-semibold text-on-surface">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-outline-variant/15 px-3 py-2 align-top">{children}</td>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
