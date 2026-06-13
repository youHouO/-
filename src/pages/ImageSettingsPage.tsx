import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Image, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * 图片设置页面
 */
export function ImageSettingsPage() {
  const navigate = useNavigate()
  const [saveOriginal, setSaveOriginal] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="h-12 flex items-center gap-3 px-4 bg-[#FAFAFA] border-b border-[#E5E7EB] shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">图片设置</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-lg">
        <div className="space-y-6">
          {/* 压缩说明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Image className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">图片自动压缩</p>
                <p className="text-blue-600 leading-relaxed">
                  插入图片时自动转换为 WebP 格式（质量 95%），去除 EXIF 信息和元数据冗余，不牺牲人眼可感知的画质。
                </p>
              </div>
            </div>
          </div>

          {/* 保存原图开关 */}
          <div className="flex items-center justify-between py-4 border-b border-[#E5E7EB]">
            <div className="flex-1">
              <h3 className="text-base font-medium">保存原图</h3>
              <p className="text-sm text-gray-400 mt-1">
                开启后同时保存原始图片文件，但会大幅增加存储空间和同步时间
              </p>
            </div>
            <button
              className={`relative w-12 h-6 rounded-full transition-colors ${
                saveOriginal ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              onClick={() => setSaveOriginal(!saveOriginal)}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  saveOriginal ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {saveOriginal && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 leading-relaxed">
                开启后大幅增加存储空间和同步时间。如果只是为了偶尔需要原图的场景，建议手动备份原图到其他位置。
              </p>
            </div>
          )}

          {/* 关于图片同步 */}
          <div className="py-4 border-b border-[#E5E7EB]">
            <h3 className="text-base font-medium mb-2">图片同步规则</h3>
            <ul className="text-sm text-gray-500 space-y-2 pl-4 list-disc">
              <li>插入图片后延迟 15 秒开始同步，期间修改或删除图片会取消同步</li>
              <li>多张图片会合并为一个批量同步任务</li>
              <li>退出笔记时强制同步所有未同步图片</li>
              <li>新设备默认不下载图片，打开书后按需加载</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
