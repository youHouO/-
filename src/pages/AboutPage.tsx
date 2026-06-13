import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield, Lock, FileJson, Github, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { APP_NAME, APP_VERSION } from '@/config'

/**
 * 关于页面
 */
export function AboutPage() {
  const navigate = useNavigate()

  const features = [
    {
      icon: Lock,
      title: '数据加密',
      desc: 'AES-256-CTR 加密存储，本地和云端均为密文',
    },
    {
      icon: Shield,
      title: '本地优先',
      desc: '所有数据保存在你的设备上，离线完全可用',
    },
    {
      icon: Globe,
      title: '多网盘备份',
      desc: '支持同时连接多个 WebDAV 云盘并行同步',
    },
    {
      icon: FileJson,
      title: '格式公开',
      desc: '数据格式透明，提供独立解密工具，永不锁定',
    },
  ]

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="h-12 flex items-center gap-3 px-4 bg-[#FAFAFA] border-b border-[#E5E7EB] shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">关于</h1>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto py-8 px-4">
          {/* 应用信息 */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-blue-600">N</span>
            </div>
            <h2 className="text-xl font-bold mb-1">{APP_NAME}</h2>
            <p className="text-sm text-gray-400">版本 {APP_VERSION}</p>
            <p className="text-sm text-gray-500 mt-4 leading-relaxed">
              一款以数据安全和一致性为绝对底线的个人笔记软件。
              <br />
              本地唯一真相源 + 多网盘镜像备份。
            </p>
          </div>

          {/* 特性列表 */}
          <div className="space-y-4 mb-10">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3 p-3 rounded-lg">
                <f.icon className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-medium">{f.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 独立解密工具说明 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-10">
            <h3 className="text-sm font-medium mb-2">🔓 独立解密工具</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              我们提供了一个独立的单网页解密工具，无需输入任何密码，只需拖入 .note 文件即可解密。
              <br />
              即使本软件不再维护，你的数据永远不会被锁定。
              <br />
              解密工具代码完全开源，支持离线运行。
            </p>
          </div>

          {/* GitHub 链接 */}
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-4">
              本项目代码在 GitHub 开源
            </p>
            <Button variant="outline" size="sm" className="gap-2">
              <Github className="h-4 w-4" />
              GitHub
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
