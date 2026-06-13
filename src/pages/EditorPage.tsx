import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { NoteEditor } from '@/components/NoteEditor'

/**
 * 全屏编辑页 — NoteEditor 的独立包装
 */
export function EditorPage() {
  const navigate = useNavigate()
  const { noteId } = useParams<{ noteId: string }>()

  if (!noteId) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center">
        <p className="text-gray-400 mb-4">未找到笔记</p>
        <Button variant="outline" onClick={() => navigate('/')}>返回首页</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex-1 overflow-hidden">
        <NoteEditor noteId={noteId} onBack={() => navigate('/')} />
      </div>
    </div>
  )
}
