import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FolderOpen, ShieldAlert, Info } from 'lucide-react'

interface WelcomePickerProps {
  onReady: () => void
  onFallback: () => void
  fallbackReason?: string | null
}

export function WelcomePicker({ onReady, onFallback, fallbackReason }: WelcomePickerProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPicking, setIsPicking] = useState(false)

  const handlePickDirectory = async () => {
    setError(null)
    setIsPicking(true)
    try {
      const handle = await window.showDirectoryPicker({
        id: 'localnotes-data',
        mode: 'readwrite',
        startIn: 'documents',
      })
      // 将 handle 传递给 storage-fsaa
      onReady()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('需要选择文件夹才能继续使用 LocalNotes')
      } else {
        setError(err instanceof Error ? err.message : '选择文件夹失败')
      }
    } finally {
      setIsPicking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="w-full max-w-md px-6 py-8 text-center">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-[hsl(var(--primary))] rounded-2xl flex items-center justify-center">
            <span className="text-white text-2xl font-bold">N</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">LocalNotes</h1>
        <p className="text-gray-500 mb-8">本地优先的 Markdown 笔记应用</p>

        <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left">
          <h2 className="font-semibold text-gray-800 mb-3">选择一个文件夹来存储你的笔记</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>你的所有数据都将保存在你自己的电脑上</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>应用卸载后数据不会丢失</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>你可以在文件管理器中直接查看和管理笔记文件</span>
            </li>
          </ul>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {fallbackReason && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">已自动降级到安全存储模式</p>
              <p className="text-amber-600 mt-1">原因：{fallbackReason}</p>
              <p className="text-amber-600 mt-1">数据将保存在浏览器内部，清除浏览器数据会丢失</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Button
            className="w-full h-11 text-base"
            onClick={handlePickDirectory}
            disabled={isPicking}
          >
            <FolderOpen className="w-5 h-5 mr-2" />
            {isPicking ? '正在打开...' : '选择文件夹'}
          </Button>

          <Button
            variant="outline"
            className="w-full h-11 text-base"
            onClick={onFallback}
          >
            <ShieldAlert className="w-4 h-4 mr-2" />
            使用浏览器安全存储（数据清除后丢失）
          </Button>
        </div>

        <p className="mt-4 text-xs text-gray-400">
          建议选择 Documents/LocalNotes 文件夹
        </p>
      </div>
    </div>
  )
}
