import { useMemo } from 'react'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import {
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  Heading,
  Italic,
  Link,
  List,
  Paragraph,
  Underline,
} from 'ckeditor5'
import idTranslations from 'ckeditor5/translations/id.js'

import 'ckeditor5/ckeditor5.css'

type LandingContentBodyEditorProps = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
}

export function LandingContentBodyEditor({ value, onChange, disabled }: LandingContentBodyEditorProps) {
  const config = useMemo(
    () => ({
      licenseKey: 'GPL' as const,
      language: 'id',
      translations: [idTranslations],
      plugins: [Essentials, Paragraph, Bold, Italic, Underline, Heading, Link, List, BlockQuote],
      toolbar: [
        'undo',
        'redo',
        '|',
        'heading',
        '|',
        'bold',
        'italic',
        'underline',
        '|',
        'link',
        'bulletedList',
        'numberedList',
        '|',
        'blockQuote',
      ],
      heading: {
        options: [
          { model: 'paragraph' as const, title: 'Paragraf', class: 'ck-heading_paragraph' },
          { model: 'heading2' as const, view: 'h2', title: 'Judul 2', class: 'ck-heading_heading2' },
          { model: 'heading3' as const, view: 'h3', title: 'Judul 3', class: 'ck-heading_heading3' },
        ],
      },
      link: {
        decorators: {
          openInNewTab: {
            mode: 'manual' as const,
            label: 'Buka di tab baru',
            defaultValue: true,
            attributes: {
              target: '_blank',
              rel: 'noopener noreferrer',
            },
          },
        },
      },
    }),
    []
  )

  return (
    <div className="landing-content-ckeditor rounded-xl border border-outline-variant/30 overflow-hidden bg-surface-container-lowest [&_.ck.ck-editor]:border-0 [&_.ck.ck-toolbar]:rounded-t-xl [&_.ck.ck-editor__main]:rounded-b-xl [&_.ck-editor__editable]:min-h-[240px] [&_.ck-editor__editable]:max-h-[min(70vh,520px)] [&_.ck-editor__editable]:overflow-y-auto [&_.ck-editor__editable]:px-4 [&_.ck-editor__editable]:py-3">
      <CKEditor
        editor={ClassicEditor}
        config={config}
        data={value || ''}
        disabled={disabled}
        onChange={(_, editor) => onChange(editor.getData())}
      />
    </div>
  )
}
