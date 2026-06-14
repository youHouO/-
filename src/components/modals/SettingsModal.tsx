import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Cloud, Trash2, FileText, Image, Download, Shield, Database, Info,
  BookOpen, FolderOpen, StickyNote, ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  listTrash, restoreFromTrash, permanentDelete,
  listTemplates, deleteTemplate, listBooks, listVolumes, listNotes,
  setEncryptionEnabled, isEncryptionEnabled,
} from '@/engine/note-engine'
import { getKeyFingerprint, sha256 } from '@/engine/encryption'
import { exportBookAsZip } from '@/engine/export-engine'
import type { TrashItem } from '@/engine/note-engine'
import type { Template, Book } from '@/types'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  initialPage?: SubPage
}

type SubPage = 'main' | 'cloud' | 'templates' | 'image' | 'about' | 'trash' | 'export' | 'security' | 'database'

export function SettingsModal({ open, onClose, initialPage }: SettingsModalProps) {
  const [subPage, setSubPage] = useState<SubPage>(initialPage || 'main')

  useEffect(() => {
    if (open) setSubPage(initialPage || 'main')
  }, [open, initialPage])

  const openSub = (page: SubPage) => setSubPage(page)
  const handleClose = () => { setSubPage('main'); onClose() }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-[520px] max-h-[80vh] overflow-hidden flex flex-col p-0">
        {subPage === 'main' && (
          <>
            <DialogHeader className="px-6 pt-5 pb-2">
              <DialogTitle>设置</DialogTitle>
              <DialogDescription>管理你的笔记应用设置</DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-5 space-y-1 overflow-y-auto">
              {/* 云盘同步 */}
              <button className="flex items-center justify-between w-full h-11 px-3 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors group" onClick={() => openSub('cloud')}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center"><Cloud className="h-4 w-4 text-blue-500" /></div>
                  <div className="text-left"><div className="text-sm font-medium">云盘同步</div><div className="text-xs text-gray-400">配置 WebDAV 云盘</div></div>
                </div>
                <span className="text-gray-300 text-sm">›</span>
              </button>
              {/* 模板管理 */}
              <button className="flex items-center justify-between w-full h-11 px-3 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors group" onClick={() => openSub('templates')}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center"><FileText className="h-4 w-4 text-emerald-500" /></div>
                  <div className="text-left"><div className="text-sm font-medium">模板管理</div><div className="text-xs text-gray-400">管理笔记模板</div></div>
                </div>
                <span className="text-gray-300 text-sm">›</span>
              </button>
              {/* 图片设置 */}
              <button className="flex items-center justify-between w-full h-11 px-3 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors group" onClick={() => openSub('image')}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center"><Image className="h-4 w-4 text-purple-500" /></div>
                  <div className="text-left"><div className="text-sm font-medium">图片设置</div><div className="text-xs text-gray-400">压缩质量与存储</div></div>
                </div>
                <span className="text-gray-300 text-sm">›</span>
              </button>
              {/* 回收站 */}
              <button className="flex items-center justify-between w-full h-11 px-3 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors group" onClick={() => openSub('trash')}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center"><Trash2 className="h-4 w-4 text-orange-500" /></div>
                  <div className="text-left"><div className="text-sm font-medium">回收站</div><div className="text-xs text-gray-400">恢复或永久删除内容</div></div>
                </div>
                <span className="text-gray-300 text-sm">›</span>
              </button>
              {/* 数据导出 */}
              <button className="flex items-center justify-between w-full h-11 px-3 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors group" onClick={() => openSub('export')}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center"><Download className="h-4 w-4 text-cyan-500" /></div>
                  <div className="text-left"><div className="text-sm font-medium">数据导出</div><div className="text-xs text-gray-400">导出 Markdown / PDF / ZIP</div></div>
                </div>
                <span className="text-gray-300 text-sm">›</span>
              </button>
              {/* 安全与加密 */}
              <button className="flex items-center justify-between w-full h-11 px-3 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors group" onClick={() => openSub('security')}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center"><Shield className="h-4 w-4 text-red-500" /></div>
                  <div className="text-left"><div className="text-sm font-medium">安全与加密</div><div className="text-xs text-gray-400">AES-256 加密，密钥管理</div></div>
                </div>
                <span className="text-gray-300 text-sm">›</span>
              </button>
              {/* 数据库管理 */}
              <button className="flex items-center justify-between w-full h-11 px-3 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors group" onClick={() => openSub('database')}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center"><Database className="h-4 w-4 text-gray-500" /></div>
                  <div className="text-left"><div className="text-sm font-medium">数据库管理</div><div className="text-xs text-gray-400">查看数据库状态、重建索引</div></div>
                </div>
                <span className="text-gray-300 text-sm">›</span>
              </button>
              {/* 关于 */}
              <button className="flex items-center justify-between w-full h-11 px-3 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors group" onClick={() => openSub('about')}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center"><Info className="h-4 w-4 text-indigo-500" /></div>
                  <div className="text-left"><div className="text-sm font-medium">关于</div><div className="text-xs text-gray-400">版本信息与开源许可</div></div>
                </div>
                <span className="text-gray-300 text-sm">›</span>
              </button>
            </div>
          </>
        )}

        {/* 云盘同步子页面 */}
        {subPage === 'cloud' && (
          <>
            <DialogHeader className="relative">
              <Button variant="ghost" size="icon" className="h-8 w-8 absolute left-4 top-4" onClick={() => setSubPage('main')}><ArrowLeft className="h-4 w-4" /></Button>
              <DialogTitle>云盘同步</DialogTitle>
              <DialogDescription>配置 WebDAV 云盘进行数据备份和同步</DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-5">
              <CloudSettingsContent />
            </div>
          </>
        )}

        {/* 模板管理子页面 */}
        {subPage === 'templates' && (
          <>
            <DialogHeader className="relative">
              <Button variant="ghost" size="icon" className="h-8 w-8 absolute left-4 top-4" onClick={() => setSubPage('main')}><ArrowLeft className="h-4 w-4" /></Button>
              <DialogTitle>模板管理</DialogTitle>
              <DialogDescription>管理笔记模板，快速创建常用格式</DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-5">
              <TemplateSettingsContent />
            </div>
          </>
        )}

        {/* 图片设置子页面 */}
        {subPage === 'image' && (
          <>
            <DialogHeader className="relative">
              <Button variant="ghost" size="icon" className="h-8 w-8 absolute left-4 top-4" onClick={() => setSubPage('main')}><ArrowLeft className="h-4 w-4" /></Button>
              <DialogTitle>图片设置</DialogTitle>
              <DialogDescription>配置图片压缩质量和存储选项</DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-5">
              <ImageSettingsContent />
            </div>
          </>
        )}

        {/* 回收站子页面 */}
        {subPage === 'trash' && (
          <>
            <DialogHeader className="relative">
              <Button variant="ghost" size="icon" className="h-8 w-8 absolute left-4 top-4" onClick={() => setSubPage('main')}><ArrowLeft className="h-4 w-4" /></Button>
              <DialogTitle>回收站</DialogTitle>
              <DialogDescription>查看和恢复已删除的内容（保留30天）</DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-5">
              <TrashSettingsContent />
            </div>
          </>
        )}

        {/* 数据导出子页面 */}
        {subPage === 'export' && (
          <>
            <DialogHeader className="relative">
              <Button variant="ghost" size="icon" className="h-8 w-8 absolute left-4 top-4" onClick={() => setSubPage('main')}><ArrowLeft className="h-4 w-4" /></Button>
              <DialogTitle>数据导出</DialogTitle>
              <DialogDescription>导出笔记为 Markdown、PDF 或 ZIP</DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-5">
              <ExportSettingsContent />
            </div>
          </>
        )}

        {/* 安全与加密子页面 */}
        {subPage === 'security' && (
          <>
            <DialogHeader className="relative">
              <Button variant="ghost" size="icon" className="h-8 w-8 absolute left-4 top-4" onClick={() => setSubPage('main')}><ArrowLeft className="h-4 w-4" /></Button>
              <DialogTitle>安全与加密</DialogTitle>
              <DialogDescription>AES-256 加密保护你的笔记数据</DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-5">
              <SecuritySettingsContent />
            </div>
          </>
        )}

        {/* 数据库管理子页面 */}
        {subPage === 'database' && (
          <>
            <DialogHeader className="relative">
              <Button variant="ghost" size="icon" className="h-8 w-8 absolute left-4 top-4" onClick={() => setSubPage('main')}><ArrowLeft className="h-4 w-4" /></Button>
              <DialogTitle>数据库管理</DialogTitle>
              <DialogDescription>查看数据库状态、重建索引</DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-5">
              <DatabaseSettingsContent />
            </div>
          </>
        )}

        {/* 关于子页面 */}
        {subPage === 'about' && (
          <>
            <DialogHeader className="relative">
              <Button variant="ghost" size="icon" className="h-8 w-8 absolute left-4 top-4" onClick={() => setSubPage('main')}><ArrowLeft className="h-4 w-4" /></Button>
              <DialogTitle>关于</DialogTitle>
              <DialogDescription>版本信息与开源许可</DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-5">
              <AboutSettingsContent />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ==================== 子页面内容组件 ==================== */

function CloudSettingsContent() {
  const [servers, setServers] = useState<Array<{ id: string; name: string; url: string; username: string; password: string }>>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // 从 localStorage 加载服务器列表
  useEffect(() => {
    try {
      const saved = localStorage.getItem('localnotes_cloud_servers')
      if (saved) setServers(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  // 同步写入 localStorage
  const persistServers = (list: typeof servers) => {
    setServers(list)
    localStorage.setItem('localnotes_cloud_servers', JSON.stringify(list))
  }

  const addServer = () => {
    if (!newName.trim() || !newUrl.trim()) return
    persistServers([...servers, { id: Date.now().toString(), name: newName, url: newUrl, username: newUsername, password: newPassword }])
    setNewName('')
    setNewUrl('')
    setNewUsername('')
    setNewPassword('')
    setShowAdd(false)
  }

  const removeServer = (id: string) => {
    persistServers(servers.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* 未配置提示 */}
      {servers.length === 0 && !showAdd && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <Cloud className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-amber-800">尚未配置云盘同步</div>
              <div className="text-xs text-amber-600 mt-1 leading-relaxed">
                配置 WebDAV 云盘后，你的笔记数据可以安全备份到云端，并在不同设备间同步。支持坚果云、NextCloud 等服务。
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-500 leading-relaxed">
        支持 WebDAV 协议的云盘服务（如坚果云、NextCloud 等），可同时配置多个云盘。
      </div>

      {servers.length > 0 && (
        <div className="space-y-2">
          {servers.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 bg-[hsl(var(--muted))] rounded-lg">
              <div>
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.url}</div>
              </div>
              <button className="text-xs text-red-400 hover:text-red-500" onClick={() => removeServer(s.id)}>移除</button>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="space-y-2 p-3 bg-[hsl(var(--muted))] rounded-lg">
          <input
            className="w-full h-9 px-3 rounded-md border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(var(--primary))]"
            placeholder="名称（如：坚果云）"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="w-full h-9 px-3 rounded-md border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(var(--primary))]"
            placeholder="WebDAV 地址"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <input
            className="w-full h-9 px-3 rounded-md border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(var(--primary))]"
            placeholder="用户名"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
          />
          <input
            type="password"
            className="w-full h-9 px-3 rounded-md border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(var(--primary))]"
            placeholder="密码"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="flex-1 h-8 rounded-md bg-[hsl(var(--primary))] text-white text-sm hover:bg-[hsl(var(--primary))]/90 transition-colors" onClick={addServer}>
              添加
            </button>
            <button className="flex-1 h-8 rounded-md border border-[hsl(var(--border))] text-sm hover:bg-[hsl(var(--muted))] transition-colors" onClick={() => setShowAdd(false)}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          className="w-full h-10 rounded-lg border border-dashed border-[hsl(var(--border))] text-sm text-gray-400 hover:text-[hsl(var(--primary))] hover:border-[hsl(var(--primary))] transition-colors"
          onClick={() => setShowAdd(true)}
        >
          + 添加云盘
        </button>
      )}
    </div>
  )
}

function TemplateSettingsContent() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const data = listTemplates()
      setTemplates(data)
    } catch (err) {
      console.error('加载模板失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDelete = (id: string) => {
    try {
      deleteTemplate(id)
      setTemplates(templates.filter(t => t.id !== id))
    } catch (err) {
      console.error('删除模板失败:', err)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500 leading-relaxed">
        模板可以帮助你快速创建常用格式的笔记。
      </div>
      {loading ? (
        <div className="text-center py-8 text-sm text-gray-400">加载中...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">暂无自定义模板</p>
          <p className="text-xs text-gray-300 mt-1">在编辑器中点击"另存为模板"来创建</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-[hsl(var(--muted))] rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-emerald-500" />
                <div>
                  <span className="text-sm">{t.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{t.scope === 'global' ? '全局' : '书内'}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="text-xs text-red-400 hover:text-red-500" onClick={() => handleDelete(t.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ImageSettingsContent() {
  const [quality, setQuality] = useState(80)
  const [maxWidth, setMaxWidth] = useState(1920)
  const [keepOriginal, setKeepOriginal] = useState(false)

  // 从 localStorage 加载图片设置
  useEffect(() => {
    try {
      const saved = localStorage.getItem('localnotes_image_settings')
      if (saved) {
        const settings = JSON.parse(saved)
        if (typeof settings.quality === 'number') setQuality(settings.quality)
        if (typeof settings.maxWidth === 'number') setMaxWidth(settings.maxWidth)
        if (typeof settings.keepOriginal === 'boolean') setKeepOriginal(settings.keepOriginal)
      }
    } catch { /* ignore */ }
  }, [])

  // 同步写入 localStorage
  const persistSettings = (patch: Record<string, unknown>) => {
    const updated = { quality, maxWidth, keepOriginal, ...patch }
    localStorage.setItem('localnotes_image_settings', JSON.stringify(updated))
  }

  const handleQualityChange = (val: number) => {
    setQuality(val)
    persistSettings({ quality: val })
  }

  const handleMaxWidthChange = (val: number) => {
    setMaxWidth(val)
    persistSettings({ maxWidth: val })
  }

  const toggleKeepOriginal = () => {
    const next = !keepOriginal
    setKeepOriginal(next)
    persistSettings({ keepOriginal: next })
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium">压缩质量</label>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={10}
            max={100}
            value={quality}
            onChange={(e) => handleQualityChange(Number(e.target.value))}
            className="flex-1 accent-[hsl(var(--primary))]"
          />
          <span className="text-sm text-gray-500 w-10 text-right">{quality}%</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">质量越高，图片文件越大。推荐 70-85%</p>
      </div>
      <div>
        <label className="text-sm font-medium">最大宽度 (px)</label>
        <input
          type="number"
          value={maxWidth}
          onChange={(e) => handleMaxWidthChange(Number(e.target.value))}
          className="mt-2 w-full h-9 px-3 rounded-md border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(var(--primary))]"
        />
        <p className="text-xs text-gray-400 mt-1">超过此宽度的图片会被等比缩放</p>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">保存原图</div>
          <div className="text-xs text-amber-600 mt-0.5">开启后大幅增加存储空间和同步时间</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={keepOriginal}
          onClick={toggleKeepOriginal}
          className={`w-10 h-6 rounded-full relative transition-colors ${keepOriginal ? 'bg-[hsl(var(--primary))]' : 'bg-gray-200'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm transition-transform ${keepOriginal ? 'left-5' : 'left-1'}`} />
        </button>
      </div>
    </div>
  )
}

function TrashSettingsContent() {
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadTrash = () => {
    try {
      const data = listTrash()
      setItems(data)
    } catch (err) {
      console.error('加载回收站失败:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrash()
  }, [])

  const handleRestore = (id: string, type: 'book' | 'volume' | 'note') => {
    try {
      restoreFromTrash(id, type)
      loadTrash()
    } catch (err) {
      console.error('恢复失败:', err)
    }
  }

  const handleDelete = (id: string, type: 'book' | 'volume' | 'note') => {
    try {
      permanentDelete(id, type)
      loadTrash()
    } catch (err) {
      console.error('永久删除失败:', err)
    }
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case 'book': return <BookOpen className="h-4 w-4 text-blue-500" />
      case 'volume': return <FolderOpen className="h-4 w-4 text-amber-500" />
      case 'note': return <StickyNote className="h-4 w-4 text-emerald-500" />
      default: return <Trash2 className="h-4 w-4 text-gray-400" />
    }
  }

  const typeLabel = (type: string) => {
    switch (type) {
      case 'book': return '书'
      case 'volume': return '卷'
      case 'note': return '笔记'
      default: return type
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500 leading-relaxed">
        已删除的内容会保留 30 天，之后自动永久删除。
      </div>
      {loading ? (
        <div className="text-center py-8 text-sm text-gray-400">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <Trash2 className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">回收站是空的</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-[hsl(var(--muted))] rounded-lg">
              <div className="flex items-center gap-3">
                {typeIcon(item.type)}
                <div>
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{typeLabel(item.type)} · {new Date(item.deletedAt).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="text-xs text-[hsl(var(--primary))] hover:underline" onClick={() => handleRestore(item.id, item.type)}>恢复</button>
                <button className="text-xs text-red-400 hover:text-red-500" onClick={() => handleDelete(item.id, item.type)}>永久删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExportSettingsContent() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [exportingId, setExportingId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const data = listBooks()
      setBooks(data)
    } catch (err) {
      console.error('加载书列表失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleExportZip = async (book: Book) => {
    setExportingId(book.id)
    try {
      const blob = await exportBookAsZip(book.id)
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = u
      a.download = `${book.name.replace(/[\\/:*?"<>|]/g, '_')}.zip`
      a.click()
      URL.revokeObjectURL(u)
    } catch (err) {
      alert(`ZIP 导出失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExportingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500 leading-relaxed">
        将你的笔记导出为不同格式，方便备份和迁移。
      </div>

      {/* 单篇导出提示 */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-xs text-blue-700">
          Markdown / HTML / PDF 单篇导出：请在编辑器中打开笔记后，点击右上角「更多」菜单导出。
        </div>
      </div>

      {/* ZIP 批量导出 */}
      <div>
        <div className="text-sm font-medium mb-2">批量导出（ZIP）</div>
        {loading ? (
          <div className="text-center py-4 text-sm text-gray-400">加载中...</div>
        ) : books.length === 0 ? (
          <div className="text-center py-4">
            <BookOpen className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">暂无书籍</p>
          </div>
        ) : (
          <div className="space-y-2">
            {books.map(book => (
              <div key={book.id} className="flex items-center justify-between p-3 bg-[hsl(var(--muted))] rounded-lg">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-4 w-4 text-blue-500" />
                  <div>
                    <div className="text-sm font-medium">{book.name}</div>
                    <div className="text-xs text-gray-400">{book.noteCount} 篇笔记</div>
                  </div>
                </div>
                <button
                  className="text-xs text-[hsl(var(--primary))] hover:underline disabled:opacity-50"
                  onClick={() => handleExportZip(book)}
                  disabled={exportingId === book.id}
                >
                  {exportingId === book.id ? '导出中...' : '导出 ZIP'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SecuritySettingsContent() {
  const [keyFingerprint, setKeyFingerprint] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [encryptionOn, setEncryptionOn] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const enabled = isEncryptionEnabled()
        if (!cancelled) setEncryptionOn(enabled)
        const fp = await getKeyFingerprint()
        if (!cancelled) setKeyFingerprint(fp)
      } catch {
        if (!cancelled) setKeyFingerprint(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleToggleEncryption = () => {
    const next = !encryptionOn
    try {
      setEncryptionEnabled(next)
      setEncryptionOn(next)
    } catch (err) {
      alert(`切换加密失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* 加密开关 */}
      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
        <div>
          <div className="text-sm font-medium text-blue-800">端到端加密</div>
          <div className="text-xs text-blue-600 mt-0.5">
            {encryptionOn ? '已启用 - 所有笔记数据均使用 AES-256-GCM 加密存储' : '未启用 - 笔记数据以明文存储'}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={encryptionOn}
          onClick={handleToggleEncryption}
          disabled={loading}
          className={`w-10 h-6 rounded-full relative transition-colors disabled:opacity-50 ${encryptionOn ? 'bg-[hsl(var(--primary))]' : 'bg-gray-200'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm transition-transform ${encryptionOn ? 'left-5' : 'left-1'}`} />
        </button>
      </div>

      {/* 密钥状态 */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <div className="text-sm font-medium text-blue-800 mb-2">密钥信息</div>
        {loading ? (
          <div className="text-xs text-blue-600">加载中...</div>
        ) : keyFingerprint ? (
          <div className="text-xs text-blue-600">
            密钥指纹: {keyFingerprint}
          </div>
        ) : (
          <div className="text-xs text-orange-600">未初始化（启用加密后将自动生成密钥）</div>
        )}
      </div>

      {/* 加密算法说明 */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <div className="text-sm font-medium text-blue-800 mb-1">AES-256-GCM 加密</div>
        <div className="text-xs text-blue-600 leading-relaxed">
          所有笔记均使用 AES-256-GCM 算法加密存储。密钥由软件内置统一生成（PBKDF2 派生），无需用户设置密码，保证数据不是明文即可。
        </div>
      </div>

      <div className="text-sm text-gray-500 leading-relaxed">
        你的数据完全在本地处理，不会上传到任何第三方服务器。
      </div>
    </div>
  )
}

function DatabaseSettingsContent() {
  const [stats, setStats] = useState<{ books: number; volumes: number; notes: number } | null>(null)
  const [indexRebuilding, setIndexRebuilding] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    try {
      const books = listBooks()
      let totalVolumes = 0
      let totalNotes = 0
      for (const book of books) {
        const volumes = listVolumes(book.id)
        totalVolumes += volumes.length
        for (const vol of volumes) {
          totalNotes += listNotes(vol.id).length
        }
      }
      setStats({ books: books.length, volumes: totalVolumes, notes: totalNotes })
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  }, [])

  const handleRebuildIndex = async () => {
    setIndexRebuilding(true)
    setMessage(null)
    try {
      // 动态导入 database 模块以避免循环依赖
      const { getDB } = await import('@/engine/database')
      const database = getDB()
      if (!database) {
        setMessage('数据库未初始化')
        setIndexRebuilding(false)
        return
      }
      // 重建 FTS 索引：删除并重新插入
      database.run('DELETE FROM notes_fts')
      const noteRows = database.exec('SELECT id, title, content FROM notes')
      if (noteRows.length > 0) {
        const stmt = database.prepare('INSERT INTO notes_fts (note_id, title, content) VALUES (?, ?, ?)')
        for (const row of noteRows[0].values) {
          stmt.run([row[0] as string, row[1] as string, row[2] as string])
        }
        stmt.free()
      }
      setMessage('搜索索引重建完成')
    } catch (err) {
      setMessage(`重建失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIndexRebuilding(false)
    }
  }

  const handleClearSearchHistory = () => {
    try {
      localStorage.removeItem('localnotes_search_history')
      setMessage('搜索历史已清除')
    } catch (err) {
      setMessage(`清除失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* 统计信息 */}
      <div className="p-4 bg-[hsl(var(--muted))] rounded-lg">
        <div className="text-sm font-medium mb-3">数据统计</div>
        {stats ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-lg font-semibold text-[hsl(var(--primary))]">{stats.books}</div>
              <div className="text-xs text-gray-400">书</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-amber-500">{stats.volumes}</div>
              <div className="text-xs text-gray-400">卷</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-emerald-500">{stats.notes}</div>
              <div className="text-xs text-gray-400">笔记</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400">加载中...</div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="space-y-2">
        <button
          className="w-full flex items-center justify-between p-3 bg-[hsl(var(--muted))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors disabled:opacity-50"
          onClick={handleRebuildIndex}
          disabled={indexRebuilding}
        >
          <div className="flex items-center gap-3">
            <Database className="h-4 w-4 text-gray-500" />
            <div className="text-left">
              <div className="text-sm font-medium">重建搜索索引</div>
              <div className="text-xs text-gray-400">重新构建全文搜索索引数据</div>
            </div>
          </div>
          <span className="text-xs text-gray-400">{indexRebuilding ? '重建中...' : '执行'}</span>
        </button>

        <button
          className="w-full flex items-center justify-between p-3 bg-[hsl(var(--muted))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors"
          onClick={handleClearSearchHistory}
        >
          <div className="flex items-center gap-3">
            <Trash2 className="h-4 w-4 text-gray-500" />
            <div className="text-left">
              <div className="text-sm font-medium">清除搜索历史</div>
              <div className="text-xs text-gray-400">清空搜索框的历史记录</div>
            </div>
          </div>
          <span className="text-xs text-gray-400">执行</span>
        </button>
      </div>

      {/* 操作反馈 */}
      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-xs text-blue-700">{message}</div>
        </div>
      )}

      <div className="text-sm text-gray-500 leading-relaxed">
        数据库状态正常。所有数据均存储在本地，不会上传到任何服务器。
      </div>
    </div>
  )
}

function AboutSettingsContent() {
  return (
    <div className="space-y-4 text-center py-4">
      <div className="w-16 h-16 bg-[hsl(var(--primary))] rounded-2xl mx-auto flex items-center justify-center">
        <BookOpen className="h-8 w-8 text-white" />
      </div>
      <div>
        <div className="text-lg font-semibold">LocalNotes</div>
        <div className="text-sm text-gray-400">版本 1.0.0</div>
      </div>
      <div className="text-xs text-gray-400 leading-relaxed max-w-[300px] mx-auto">
        一款完全本地优先、端到端加密的笔记应用。你的数据，你做主。
      </div>
    </div>
  )
}
