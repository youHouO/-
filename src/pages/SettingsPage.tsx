import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Cloud, Trash2, FileText, Image, Info, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { APP_VERSION } from '@/config'

/** 设置项配置 */
const SETTINGS_ITEMS = [
  { icon: Cloud, label: '云盘管理', path: '/settings/cloud' },
  { icon: Trash2, label: '回收站', path: '/settings/trash' },
  { icon: FileText, label: '模板管理', path: '/settings/templates' },
  { icon: Image, label: '图片设置', path: '/settings/images' },
  { icon: Info, label: '关于', path: '/settings/about' },
]

/**
 * 设置页
 */
export function SettingsPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* 顶部栏 */}
      <header className="h-12 flex items-center justify-center relative px-4 bg-[#FAFAFA] border-b border-[#E5E7EB] shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 absolute left-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">设置</h1>
      </header>

      {/* 设置项列表 */}
      <main className="flex-1 overflow-y-auto">
        <div className="py-2">
          {SETTINGS_ITEMS.map((item) => (
            <button
              key={item.label}
              className="flex items-center w-full h-14 px-4 border-b border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors"
              onClick={() => navigate(item.path)}
            >
              <item.icon className="h-6 w-6 text-gray-600 mr-3" />
              <span className="flex-1 text-left text-base">{item.label}</span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          ))}
        </div>
      </main>

      {/* 底部版本号 */}
      <footer className="text-center pb-4 shrink-0">
        <span className="text-xs text-gray-400">
          版本 {APP_VERSION}
        </span>
      </footer>
    </div>
  )
}
