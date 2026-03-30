import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { cn } from '../lib/utils'

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void
  files: File[]
  onRemoveFile: (index: number) => void
  accept?: string
  multiple?: boolean
  className?: string
}

export default function UploadZone({
  onFilesSelected,
  files,
  onRemoveFile,
  accept = 'image/*',
  multiple = true,
  className,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length) onFilesSelected(dropped)
  }, [onFilesSelected])

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length) onFilesSelected(selected)
    e.target.value = ''
  }, [onFilesSelected])

  return (
    <div className={className}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-nha-sky bg-nha-sky-light'
            : 'border-nha-gray-300 hover:border-nha-sky hover:bg-nha-gray-50',
        )}
      >
        <Upload className="mx-auto mb-3 text-nha-gray-400" size={32} />
        <p className="text-sm text-nha-gray-600 font-medium">
          Drop screenshots here or click to browse
        </p>
        <p className="text-xs text-nha-gray-400 mt-1">PNG, JPG up to 10MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-3 bg-white rounded-lg border border-nha-gray-200 p-3">
              <ImageIcon size={16} className="text-nha-gray-400 shrink-0" />
              <span className="text-sm text-nha-gray-700 truncate flex-1">{file.name}</span>
              <span className="text-xs text-nha-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveFile(i) }}
                className="text-nha-gray-400 hover:text-red-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
