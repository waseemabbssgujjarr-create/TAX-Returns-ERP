'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useRef, useState } from 'react'

const ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.xlsx,.csv,application/pdf,image/png,image/jpeg,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

type Props = {
  disabled?: boolean
  onUpload: (file: File) => Promise<void>
}

export function DocumentUploadDropzone({ disabled, onUpload }: Props) {
  const t = useTranslations('documents')
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || disabled || busy) return
      setBusy(true)
      try {
        await onUpload(files[0]!)
      } finally {
        setBusy(false)
      }
    },
    [busy, disabled, onUpload],
  )

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled || busy}
      aria-label={t('upload')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        void handleFiles(e.dataTransfer.files)
      }}
      className={`cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
        dragOver
          ? 'border-primary bg-primary/5'
          : 'border-border bg-surface hover:border-primary/50'
      } ${disabled || busy ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={ACCEPT}
        disabled={disabled || busy}
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <p className="text-foreground text-sm font-medium">
        {dragOver ? t('dropzoneActive') : t('dropzone')}
      </p>
      <p className="text-muted-foreground mt-2 text-xs">{t('dropzoneHint')}</p>
      {busy && (
        <p className="text-muted-foreground mt-3 text-sm" aria-live="polite">
          {t('processing')}
        </p>
      )}
    </div>
  )
}
