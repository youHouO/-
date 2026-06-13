import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Cloud, Plus, Trash2, Power, PowerOff, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { testConnection } from '@/engine/sync-engine'
import type { CloudDriveConfig } from '@/types'

/**
 * 云盘管理页面
 * 支持添加/删除/启用/禁用 WebDAV 云盘
 */
export function CloudManagePage() {
  const navigate = useNavigate()
  const [drives, setDrives] = useState<CloudDriveConfig[]>([])
  const [addModalOpen, setAddModalOpen] = useState(false)

  // 新建云盘表单
  const [formUrl, setFormUrl] = useState('')
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formName, setFormName] = useState('')
  const [testing, setTesting] = useState(false)

  const handleAdd = () => {
    setFormUrl('')
    setFormUsername('')
    setFormPassword('')
    setFormName('')
    setAddModalOpen(true)
  }

  const handleConnect = async () => {
    if (!formUrl || !formUsername || !formPassword) {
      alert('请填写完整的连接信息')
      return
    }

    setTesting(true)
    try {
      const tempConfig: CloudDriveConfig = {
        id: crypto.randomUUID(),
        name: formName || new URL(formUrl).hostname,
        type: 'webdav',
        url: formUrl,
        username: formUsername,
        password: formPassword,
        enabled: true,
        lastSyncAt: null,
        syncStatus: 'idle',
      }

      // 测试连接
      const result = await testConnection(tempConfig)
      if (!result.success) {
        alert(`连接失败: ${result.error}`)
        return
      }

      setDrives([...drives, tempConfig])
      setAddModalOpen(false)
    } catch (err) {
      alert(`连接失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  const handleToggle = (driveId: string) => {
    setDrives(drives.map(d =>
      d.id === driveId ? { ...d, enabled: !d.enabled } : d
    ))
  }

  const handleRemove = (driveId: string) => {
    setDrives(drives.filter(d => d.id !== driveId))
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="h-12 flex items-center gap-3 px-4 bg-[#FAFAFA] border-b border-[#E5E7EB] shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">云盘管理</h1>
        <Button variant="outline" size="sm" className="ml-auto" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" /> 添加云盘
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {drives.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Cloud className="h-16 w-16 mb-4 text-gray-200" />
            <p className="text-lg">未配置云盘</p>
            <p className="text-sm mt-2 text-center max-w-sm px-4">
              添加 WebDAV 云盘实现数据自动备份。<br />
              支持坚果云、TeraCloud、自建 NAS 等
            </p>
            <Button className="mt-6" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-1" /> 添加 WebDAV 云盘
            </Button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-4 px-4 space-y-3">
            {drives.map((drive) => (
              <div
                key={drive.id}
                className="flex items-center justify-between h-16 px-4 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="text-sm font-medium">{drive.name}</div>
                    <div className="text-xs text-gray-400">{drive.url}</div>
                  </div>
                  {drive.lastSyncAt && (
                    <span className="text-xs text-gray-400">
                      上次同步: {new Date(drive.lastSyncAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => handleToggle(drive.id)}
                  >
                    {drive.enabled ? (
                      <><PowerOff className="h-3 w-3 mr-1 text-green-600" /> 已开启</>
                    ) : (
                      <><Power className="h-3 w-3 mr-1 text-gray-400" /> 已关闭</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-red-500"
                    onClick={() => handleRemove(drive.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> 删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 添加云盘弹窗 */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>添加 WebDAV 云盘</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">显示名称（可选）</label>
              <Input
                placeholder="如：坚果云"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">服务器地址</label>
              <Input
                placeholder="https://dav.jianguoyun.com/dav/"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">用户名</label>
              <Input
                placeholder="WebDAV 用户名"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">密码</label>
              <Input
                type="password"
                placeholder="WebDAV 密码"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>取消</Button>
            <Button onClick={handleConnect} disabled={testing}>
              {testing ? '测试连接中...' : '连接'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
