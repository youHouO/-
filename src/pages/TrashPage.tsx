import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal'
import { listTrash, restoreFromTrash, permanentDelete, type TrashItem } from '@/engine/note-engine'

/**
 * 回收站页面
 * 显示所有已删除的内容（30天内），支持恢复和永久删除
 */
export function TrashPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<TrashItem[]>([])
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<TrashItem | null>(null)

  const loadItems = useCallback(() => {
    try {
      const trashItems = listTrash()
      setItems(trashItems)
    } catch (err) {
      console.error('加载回收站失败:', err)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handleRestore = async (item: TrashItem) => {
    try {
      await restoreFromTrash(item.id, item.type)
      loadItems()
    } catch (err) {
      alert(`恢复失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return
    try {
      await permanentDelete(permanentDeleteTarget.id, permanentDeleteTarget.type)
      setPermanentDeleteTarget(null)
      loadItems()
    } catch (err) {
      alert(`永久删除失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const typeLabel = (type: 'book' | 'volume' | 'note') => {
    return type === 'book' ? '📚 书' : type === 'volume' ? '📁 卷' : '📝 笔记'
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* 顶部栏 */}
      <header className="h-12 flex items-center gap-3 px-4 bg-[#FAFAFA] border-b border-[#E5E7EB] shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">回收站</h1>
        <span className="text-sm text-gray-400 ml-2">
          {items.length > 0 ? `${items.length} 项，保留30天` : '回收站为空'}
        </span>
      </header>

      {/* 内容区 */}
      <main className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Trash2 className="h-16 w-16 mb-4 text-gray-200" />
            <p className="text-lg">回收站为空</p>
            <p className="text-sm mt-2">删除的内容会在这里保留30天</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-4 px-4">
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center justify-between h-16 px-4 rounded-lg hover:bg-[#F3F4F6] transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg shrink-0">
                      {item.type === 'book' ? '📚' : item.type === 'volume' ? '📁' : '📝'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{item.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">{typeLabel(item.type)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        <span>删除于 {formatDate(item.deletedAt)}</span>
                        <span>·</span>
                        <span>{Math.ceil((item.expiresAt - Date.now()) / (24 * 60 * 60 * 1000))} 天后过期</span>
                        {item.bookId && <span>· 所属书: {item.bookId}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-blue-600"
                      onClick={() => handleRestore(item)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      恢复
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-red-500"
                      onClick={() => setPermanentDeleteTarget(item)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      永久删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 永久删除确认弹窗 */}
      {permanentDeleteTarget && (
        <DeleteConfirmModal
          open={!!permanentDeleteTarget}
          onClose={() => setPermanentDeleteTarget(null)}
          onConfirm={handlePermanentDelete}
          title="永久删除"
          description={`永久删除「${permanentDeleteTarget.name}」后无法恢复，云端备份也会在下次同步时被移除`}
          confirmLabel="永久删除"
          permanent
        />
      )}
    </div>
  )
}
