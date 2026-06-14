import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Shield,
  Cloud,
  HardDrive,
  FolderOpen,
  ChevronRight,
  Check,
  Info,
  ShieldAlert,
} from 'lucide-react'
import { initStorageWithHandle } from '@/engine/storage'

interface WelcomePickerProps {
  onReady: () => void
  onFallback: () => void
  fallbackReason?: string | null
}

type Step = 'welcome' | 'location'


export function WelcomePicker({
  onReady,
  onFallback,
  fallbackReason,
}: WelcomePickerProps) {
  const [step, setStep] = useState<Step>('welcome')
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
      // 将 handle 传给 storage 层初始化，自动创建 LocalNotes 子目录
      await initStorageWithHandle(handle, { defaultPath: true })
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

  // 第一屏：欢迎介绍
  if (step === 'welcome') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="w-full max-w-lg px-6 py-8 text-center">
          {/* Logo */}
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 bg-[hsl(var(--primary))] rounded-2xl flex items-center justify-center">
              <span className="text-white text-2xl font-bold">N</span>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            欢迎使用 LocalNotes
          </h1>
          <p className="text-gray-500 mb-10 text-lg">
            本地优先的 Markdown 笔记应用，你的数据永远属于你
          </p>

          {/* 特性卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <div className="bg-gray-50 rounded-xl p-5 text-left">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                <HardDrive className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">数据存本地</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                笔记文件保存在你的电脑上，应用卸载不丢失
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-5 text-left">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">隐私安全</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                无需注册账号，可选 AES-256-GCM 加密
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-5 text-left">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <Cloud className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">云同步</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                支持 WebDAV/FTP/S3 等多种协议备份
              </p>
            </div>
          </div>

          <Button
            className="w-full h-12 text-base"
            onClick={() => setStep('location')}
          >
            开始使用
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  // 第二屏：存储位置确认
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="w-full max-w-md px-6 py-8 text-center">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-[hsl(var(--primary))] rounded-2xl flex items-center justify-center">
            <span className="text-white text-2xl font-bold">N</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          选择数据存储位置
        </h1>
        <p className="text-gray-500 mb-6">
          点击下方按钮后，系统会弹出文件夹选择器。选择任意文件夹后，LocalNotes 会自动在其中创建 <span className="font-medium text-gray-700">LocalNotes</span> 子文件夹来存放数据。
        </p>

        {/* 说明卡片 */}
        <div className="w-full bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-left text-sm text-blue-800">
              <p className="font-medium">推荐做法</p>
              <p className="mt-1">在弹出的选择器中选择「文档」文件夹，数据将保存在 <span className="font-semibold">文档/LocalNotes/</span> 下，方便查找和备份。</p>
            </div>
          </div>
        </div>

        {/* 选择文件夹按钮 */}
        <button
          onClick={handlePickDirectory}
          disabled={isPicking}
          className="w-full text-left bg-white border-2 border-[hsl(var(--primary))] rounded-xl p-4 mb-4 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <span className="font-semibold text-gray-900">
                {isPicking ? '请在弹出的窗口中选择文件夹...' : '选择文件夹'}
              </span>
              <p className="text-xs text-gray-400 mt-0.5">
                选择后自动创建 LocalNotes 子文件夹
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
          </div>
        </button>

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
              <p className="text-amber-600 mt-1">
                数据将保存在浏览器内部，清除浏览器数据会丢失
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Button
            className="w-full h-11 text-base"
            onClick={handlePickDirectory}
            disabled={isPicking}
          >
            <Check className="w-5 h-5 mr-2" />
            {isPicking ? '正在打开...' : '确认并继续'}
          </Button>

          <Button
            variant="outline"
            className="w-full h-11 text-base"
            onClick={onFallback}
          >
            <ShieldAlert className="w-4 h-4 mr-2" />
            使用浏览器安全存储（降级）
          </Button>
        </div>

        <button
          onClick={() => setStep('welcome')}
          className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          返回上一步
        </button>
      </div>
    </div>
  )
}
