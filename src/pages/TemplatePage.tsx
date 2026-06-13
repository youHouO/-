import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateModal } from '@/components/modals/CreateModal'
import { RenameModal } from '@/components/modals/RenameModal'
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal'
import { createTemplate, listTemplates, deleteTemplate, updateTemplate, loadTemplate } from '@/engine/note-engine'
import type { Template } from '@/types'

/**
 * 模板管理页面
 */
export function TemplatePage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<Template[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Template | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const loadTemplates = useCallback(() => {
    try {
      const list = listTemplates()
      setTemplates(list)
    } catch (err) {
      console.error('加载模板失败:', err)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const handleCreate = async (name: string) => {
    try {
      await createTemplate(name, '', 'global')
      loadTemplates()
    } catch (err) {
      alert(`创建模板失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleRename = async (newName: string) => {
    if (!renameTarget) return
    try {
      const full = await loadTemplate(renameTarget.id)
      await updateTemplate(renameTarget.id, newName, full.content)
      loadTemplates()
    } catch (err) {
      alert(`重命名失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteTemplate(deleteTarget.id)
      setDeleteTarget(null)
      loadTemplates()
    } catch (err) {
      alert(`删除模板失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleStartEdit = async (template: Template) => {
    try {
      const full = await loadTemplate(template.id)
      setEditingTemplate(template.id)
      setEditContent(full.content)
    } catch (err) {
      alert(`加载模板失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingTemplate) return
    const target = templates.find(t => t.id === editingTemplate)
    if (!target) return
    try {
      await updateTemplate(editingTemplate, target.name, editContent)
      setEditingTemplate(null)
      setEditContent('')
    } catch (err) {
      alert(`保存模板失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="h-12 flex items-center gap-3 px-4 bg-[#FAFAFA] border-b border-[#E5E7EB] shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">模板管理</h1>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => setCreateModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" /> 新建模板
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FileText className="h-16 w-16 mb-4 text-gray-200" />
            <p className="text-lg">还没有模板</p>
            <p className="text-sm mt-2">创建模板后新建笔记时可以快速应用</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-4 px-4 space-y-2">
            {templates.map((tpl) => (
              <div key={tpl.id} className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                {editingTemplate === tpl.id ? (
                  /* 编辑模式 */
                  <div className="p-4">
                    <textarea
                      className="w-full h-48 font-mono text-sm p-3 border border-[#E5E7EB] rounded resize-none outline-none focus:border-blue-400"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="输入模板内容（Markdown）..."
                    />
                    <div className="flex justify-end gap-2 mt-3">
                      <Button variant="outline" size="sm" onClick={() => setEditingTemplate(null)}>取消</Button>
                      <Button size="sm" onClick={handleSaveEdit}>保存</Button>
                    </div>
                  </div>
                ) : (
                  /* 查看模式 */
                  <div className="flex items-center justify-between h-14 px-4 hover:bg-[#F9FAFB] transition-colors group">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium">{tpl.name}</span>
                      <span className="text-xs text-gray-400 bg-[#F3F4F6] px-2 py-0.5 rounded">
                        {tpl.scope === 'global' ? '全局' : '本书'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => handleStartEdit(tpl)}>
                        <Pencil className="h-3 w-3 mr-1" /> 编辑
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => setRenameTarget(tpl)}>
                        重命名
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-red-500"
                        onClick={() => setDeleteTarget(tpl)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> 删除
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <CreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onConfirm={handleCreate}
        title="新建模板"
        placeholder="请输入模板名称"
      />

      {renameTarget && (
        <RenameModal
          open={!!renameTarget}
          onClose={() => setRenameTarget(null)}
          onConfirm={handleRename}
          title="重命名模板"
          currentName={renameTarget.name}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="删除模板"
          description={`删除模板「${deleteTarget.name}」后不会影响已使用该模板创建的笔记`}
          confirmLabel="删除"
        />
      )}
    </div>
  )
}
