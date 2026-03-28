import { useMemo } from 'react'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import {
  Alignment,
  AutoImage,
  Autoformat,
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  FileRepository,
  Heading,
  Image,
  ImageCaption,
  ImageInsertViaUrl,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Indent,
  IndentBlock,
  Italic,
  Link,
  LinkImage,
  List,
  Paragraph,
  PasteFromOffice,
  PictureEditing,
  Plugin,
  Strikethrough,
  Table,
  TableToolbar,
  type EditorConfig,
  type FileLoader,
  type UploadAdapter,
  type UploadResponse,
  Underline,
} from 'ckeditor5'
import 'ckeditor5/ckeditor5.css'

declare module 'ckeditor5' {
  interface EditorConfig {
    landingUpload?: {
      uploadUrl: string
      getToken: () => string | null
    }
  }
}

class LandingContentUploadAdapter implements UploadAdapter {
  private xhr?: XMLHttpRequest
  private loader: FileLoader
  private uploadUrl: string
  private getToken: () => string | null

  constructor(loader: FileLoader, uploadUrl: string, getToken: () => string | null) {
    this.loader = loader
    this.uploadUrl = uploadUrl
    this.getToken = getToken
  }

  upload(): Promise<UploadResponse> {
    return this.loader.file.then((file) => {
      if (!file) {
        return Promise.reject(new Error('Berkas tidak tersedia.'))
      }
      return new Promise((resolve, reject) => {
        const xhr = (this.xhr = new XMLHttpRequest())
        xhr.open('POST', this.uploadUrl)
        xhr.responseType = 'json'
        xhr.withCredentials = true
        const token = this.getToken()
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        }
        xhr.setRequestHeader('Accept', 'application/json')
        xhr.addEventListener('error', () => reject(new Error('Gagal mengunggah gambar.')))
        xhr.addEventListener('abort', () => reject())
        xhr.addEventListener('load', () => {
          const status = xhr.status
          if (status >= 200 && status < 300) {
            const res = xhr.response as { url?: string } | null
            if (res?.url) {
              resolve({ default: res.url })
            } else {
              reject(new Error('Respons server tidak berisi URL gambar.'))
            }
          } else {
            const msg =
              (xhr.response as { message?: string } | null)?.message ??
              `Unggah gagal (${status}).`
            reject(new Error(msg))
          }
        })
        if (xhr.upload) {
          xhr.upload.addEventListener('progress', (evt) => {
            if (evt.lengthComputable) {
              this.loader.uploadTotal = evt.total
              this.loader.uploaded = evt.loaded
            }
          })
        }
        const data = new FormData()
        data.append('upload', file)
        xhr.send(data)
      })
    })
  }

  abort(): void {
    this.xhr?.abort()
  }
}

class LandingImageUploadAdapterPlugin extends Plugin {
  static get requires() {
    return [FileRepository]
  }

  static get pluginName() {
    return 'LandingImageUploadAdapter'
  }

  init() {
    const uploadUrl = this.editor.config.get('landingUpload.uploadUrl') as string | undefined
    const getToken = this.editor.config.get('landingUpload.getToken') as (() => string | null) | undefined
    if (!uploadUrl || !getToken) {
      return
    }
    this.editor.plugins.get(FileRepository).createUploadAdapter = (loader: FileLoader) =>
      new LandingContentUploadAdapter(loader, uploadUrl, getToken)
  }
}

type LandingContentEditorProps = {
  id?: string
  value: string
  onChange: (html: string) => void
  disabled?: boolean
}

export function LandingContentEditor({ id, value, onChange, disabled }: LandingContentEditorProps) {
  const editorConfig = useMemo((): EditorConfig => {
    return {
      licenseKey: 'GPL',
      plugins: [
        Essentials,
        Paragraph,
        Autoformat,
        Bold,
        Italic,
        Underline,
        Strikethrough,
        Heading,
        Link,
        List,
        BlockQuote,
        Alignment,
        Indent,
        IndentBlock,
        Image,
        ImageCaption,
        ImageStyle,
        ImageToolbar,
        ImageResize,
        ImageUpload,
        ImageInsertViaUrl,
        LinkImage,
        AutoImage,
        PictureEditing,
        Table,
        TableToolbar,
        PasteFromOffice,
        LandingImageUploadAdapterPlugin,
      ],
      toolbar: {
        items: [
          'heading',
          '|',
          'bold',
          'italic',
          'underline',
          'strikethrough',
          '|',
          'link',
          'bulletedList',
          'numberedList',
          '|',
          'outdent',
          'indent',
          '|',
          'alignment',
          '|',
          'uploadImage',
          'insertImage',
          'blockQuote',
          'insertTable',
          '|',
          'undo',
          'redo',
        ],
        shouldNotGroupWhenFull: true,
      },
      heading: {
        options: [
          { model: 'paragraph', title: 'Paragraf', class: 'ck-heading_paragraph' },
          { model: 'heading2', view: 'h2', title: 'Judul 2', class: 'ck-heading_heading2' },
          { model: 'heading3', view: 'h3', title: 'Judul 3', class: 'ck-heading_heading3' },
        ],
      },
      image: {
        toolbar: [
          'imageTextAlternative',
          'toggleImageCaption',
          '|',
          'imageStyle:inline',
          'imageStyle:block',
          'imageStyle:side',
          '|',
          'linkImage',
          'resizeImage',
        ],
      },
      table: {
        contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'],
      },
      landingUpload: {
        uploadUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/api/landing-contents/upload-image`,
        getToken: () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null),
      },
    }
  }, [])

  return (
    <div
      id={id}
      className={[
        'landing-content-ckeditor rounded-md border border-input overflow-hidden bg-background',
        disabled ? 'pointer-events-none opacity-60' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CKEditor
        editor={ClassicEditor}
        config={editorConfig}
        data={value}
        disabled={disabled}
        onChange={(_evt, editor) => {
          onChange(editor.getData())
        }}
      />
    </div>
  )
}
