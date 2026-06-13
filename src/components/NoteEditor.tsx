import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye, Edit3, MoreHorizontal, Loader2, Maximize2, Minimize2,
  PanelLeftClose, PanelLeftOpen, Hash, Undo2, Redo2, CalendarPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal'
import { RenameModal } from '@/components/modals/RenameModal'
import { loadNote, saveNote, deleteNote, createTemplate } from '@/engine/note-engine'
import { AUTO_SAVE_DELAY } from '@/config'
import type { ViewMode } from '@/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'

// CodeMirror 静态导入 — 不使用 codemirror 聚合包，避免多实例冲突
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { undo, redo, history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap } from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { lintKeymap } from '@codemirror/lint'

/** 自定义亮色编辑器主题 */
const lightTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff', color: '#1f2937' },
  '.cm-content': { caretColor: '#6366f1' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#6366f1', borderLeftWidth: '2px' },
  '.cm-activeLine': { backgroundColor: '#f8fafc' },
  '.cm-activeLineGutter': { backgroundColor: '#f8fafc' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: '#e0e7ff' },
  '.cm-gutters': { backgroundColor: '#fafafa', color: '#9ca3af', borderRight: '1px solid #f0f0f0' },
  '.cm-lineNumbers .cm-gutterElement': { color: '#c0c0c0', fontSize: '12px' },
  '.cm-foldGutter .cm-gutterElement': { color: '#c0c0c0' },
}, { dark: false })

interface HeadingItem { level: number; text: string; lineIndex: number }

function parseHeadings(md: string): HeadingItem[] {
  const hs: HeadingItem[] = []
  const lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+)$/)
    if (m && m[1].length <= 3) hs.push({ level: m[1].length, text: m[2].trim(), lineIndex: i })
  }
  return hs
}

interface NoteEditorProps {
  noteId: string
  embedded?: boolean
  onBack?: () => void   // 全屏模式下的返回回调
  /** 搜索关键词，用于定位和高亮匹配文本 */
  searchKeyword?: string
  /** 搜索匹配的行号（从0开始） */
  searchMatchLine?: number
}

export function NoteEditor({ noteId, embedded = false, onBack, searchKeyword, searchMatchLine }: NoteEditorProps) {
  const navigate = useNavigate()

  const [bookId, setBookId] = useState('')
  const [title, setTitle] = useState('无标题笔记')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('edit')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const [wordCount, setWordCount] = useState(0)
  const [unsyncedImages, setUnsyncedImages] = useState(0)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [saveAsTemplateModalOpen, setSaveAsTemplateModalOpen] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(true)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<any>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isExternalUpdate = useRef(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const headings = useMemo(() => parseHeadings(content), [content])

  // ==================== 图片 ====================
  const handleImageFile = useCallback(async (blob: Blob) => {
    if (!blob.type?.startsWith('image/')) return
    try {
      const { compressImage, saveImage, enqueueImageSync } = await import('@/engine/image-engine')
      const file = blob instanceof File ? blob : new globalThis.File([blob], 'image.png', { type: blob.type })
      const compressed = await compressImage(file)
      const { localPath } = await saveImage(bookId, compressed, noteId)
      if (editorViewRef.current) {
        editorViewRef.current.dispatch({
          changes: { from: editorViewRef.current.state.selection.main.head, insert: `![](${localPath})` },
        })
      }
      enqueueImageSync({
        id: localPath.split('/').pop() || '', bookId, noteId: noteId || '',
        localPath, size: compressed.size, addedAt: Date.now(),
      })
      setUnsyncedImages((await import('@/engine/image-engine')).getUnsyncedImageCount())
    } catch (err) { console.error('处理图片失败:', err) }
  }, [bookId, noteId])

  // ==================== 加载 ====================
  useEffect(() => {
    if (!noteId) return
    loadNoteData()
    const interval = setInterval(async () => {
      try {
        setUnsyncedImages((await import('@/engine/image-engine')).getUnsyncedImageCount())
      } catch (err) {
        console.warn('[NoteEditor] 获取未同步图片数失败:', err)
      }
    }, 2000)
    return () => {
      clearInterval(interval)
      if (editorViewRef.current) { editorViewRef.current.destroy(); editorViewRef.current = null }
    }
  }, [noteId])

  const loadNoteData = async () => {
    try {
      setLoading(true); setError(null)
      const { note: d, content: c } = await loadNote(noteId)
      setBookId(d.bookId); setTitle(d.title); setContent(c); setWordCount(d.wordCount)
    } catch (err) {
      setError(`加载笔记失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally { setLoading(false) }
  }

  // 搜索定位：加载完成后滚动到匹配行并高亮
  useEffect(() => {
    if (!loading && searchKeyword && editorViewRef.current) {
      const view = editorViewRef.current
      // 在编辑器中搜索关键词并滚动到匹配位置
      const docText = view.state.doc.toString()
      const keywordLower = searchKeyword.toLowerCase()
      const lines = docText.split('\n')

      // 找到匹配行
      let targetLine = searchMatchLine
      if (targetLine === undefined) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(keywordLower)) {
            targetLine = i
            break
          }
        }
      }

      if (targetLine !== undefined && targetLine >= 0 && targetLine < lines.length) {
        const lineInfo = view.state.doc.line(targetLine + 1)
        // 选中匹配文本
        const lineText = lines[targetLine]
        const matchIndex = lineText.toLowerCase().indexOf(keywordLower)
        if (matchIndex >= 0) {
          const from = lineInfo.from + matchIndex
          const to = from + searchKeyword.length
          view.dispatch({
            selection: { anchor: from, head: to },
            scrollIntoView: true,
          })
        } else {
          view.dispatch({
            selection: { anchor: lineInfo.from },
            scrollIntoView: true,
          })
        }
      }
    }
  }, [loading, searchKeyword, searchMatchLine])

  // ==================== 编辑器 ====================
  const isEditing = viewMode === 'edit'

  useEffect(() => {
    if (loading || error || !editorRef.current) return
    if (!isEditing) {
      // 切换到预览模式：销毁编辑器实例并清空DOM
      if (editorViewRef.current) { editorViewRef.current.destroy(); editorViewRef.current = null }
      if (editorRef.current) editorRef.current.innerHTML = ''
      return
    }
    // 切换到编辑模式：如果编辑器已存在则不再初始化
    if (editorViewRef.current) return
    initEditor()
  }, [loading, error, isEditing])

  // content 变化时同步到编辑器（处理异步加载时序问题）
  useEffect(() => {
    if (!isEditing || !editorViewRef.current) return
    const view = editorViewRef.current
    const currentContent = view.state.doc.toString()
    if (currentContent !== content) {
      isExternalUpdate.current = true
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: content }
      })
      isExternalUpdate.current = false
    }
  }, [content, isEditing])

  const initEditor = () => {
    if (!editorRef.current) return
    try {
      const updateListener = EditorView.updateListener.of((update: any) => {
        if (update.docChanged && !isExternalUpdate.current) {
          const c = update.state.doc.toString(); setContent(c)
          setWordCount(c.replace(/\s/g, '').length); scheduleSave(c)
        }
      })
      // 插入日期时间快捷键 Ctrl+Shift+D
      const insertDateTime = ({ state, dispatch }: any) => {
        const now = new Date()
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        dispatch(state.update(state.replaceSelection(dateStr)))
        return true
      }
      const dateTimeKeymap = keymap.of([{ key: 'Mod-Shift-d', run: insertDateTime }])
      const handlers = EditorView.domEventHandlers({
        paste: (e: ClipboardEvent) => {
          const items = e.clipboardData?.items; if (!items) return false
          for (let i = 0; i < items.length; i++)
            if (items[i].type.startsWith('image/')) { e.preventDefault(); const f = items[i].getAsFile(); if (f) handleImageFile(f); return true }
          return false
        },
        drop: (e: DragEvent) => {
          const files = e.dataTransfer?.files; if (!files) return false
          for (let i = 0; i < files.length; i++)
            if (files[i].type.startsWith('image/')) { e.preventDefault(); for (let j = 0; j < files.length; j++) if (files[j].type.startsWith('image/')) handleImageFile(files[j]); return true }
          return false
        },
        dragover: (e: DragEvent) => {
          const items = e.dataTransfer?.items; if (!items) return false
          for (let i = 0; i < items.length; i++) if (items[i].type.startsWith('image/')) { e.preventDefault(); return true }
          return false
        },
      })
      const mdExt = markdown()
      // 手动组装 basicSetup（不使用 codemirror 聚合包）
      const basicSetupExtensions = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...lintKeymap,
        ]),
      ]
      editorViewRef.current = new EditorView({
        state: EditorState.create({
          doc: content,
          extensions: [
            basicSetupExtensions,
            mdExt,
            lightTheme,
            updateListener,
            EditorView.lineWrapping,
            handlers,
            dateTimeKeymap,
          ],
        }),
        parent: editorRef.current,
      })
    } catch (err) { console.error('初始化编辑器失败:', err) }
  }

  // ==================== 保存 ====================
  const scheduleSave = useCallback((c?: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setIsSaving(true)
    saveTimerRef.current = setTimeout(() => doSave(c), AUTO_SAVE_DELAY)
  }, [noteId, title])

  const doSave = useCallback(async (c?: string) => {
    if (!noteId) return
    try { await saveNote(noteId, c ?? content, title); setLastSaved(Date.now()) }
    catch (err) { console.error('保存失败:', err) }
    finally { setIsSaving(false) }
  }, [noteId, content, title])

  // ==================== 操作 ====================
  const handleDelete = async () => {
    if (!noteId) return
    try {
      await deleteNote(noteId)
      // 显示 Toast 提示
      const toast = document.createElement('div')
      toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2'
      toast.textContent = '已移至回收站'
      document.body.appendChild(toast)
      setTimeout(() => { toast.remove() }, 2000)
      // 返回上一级（调用 onBack 或首页）
      if (onBack) onBack(); else navigate('/')
    }
    catch (err) { alert(`删除失败: ${err instanceof Error ? err.message : String(err)}`) }
  }
  const handleExportMarkdown = () => {
    const b = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `${title}.md`; a.click(); URL.revokeObjectURL(u)
  }
  const handleExportPDF = async () => {
    try { const { exportNoteAsPDF } = await import('@/engine/export-engine'); exportNoteAsPDF(noteId) }
    catch (err) { alert(`PDF导出失败: ${err instanceof Error ? err.message : String(err)}`) }
  }
  const handleSaveAsTemplate = async (name: string) => {
    try { await createTemplate(name, content, 'global') }
    catch (err) { alert(`保存模板失败: ${err instanceof Error ? err.message : String(err)}`) }
  }
  const scrollToHeading = (lineIndex: number) => {
    if (isEditing && editorViewRef.current) {
      const v = editorViewRef.current; const l = v.state.doc.line(lineIndex + 1)
      v.dispatch({ selection: { anchor: l.from, head: l.from }, scrollIntoView: true })
    } else {
      const p = previewRef.current; if (!p) return
      const t = content.split('\n')[lineIndex]?.replace(/^#+\s*/, '').trim(); if (!t) return
      for (const el of p.querySelectorAll('h1,h2,h3'))
        if (el.textContent?.trim() === t) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
    }
  }

  const handleBack = () => {
    // 退出前检查未同步图片
    if (unsyncedImages > 3) {
      const confirmed = window.confirm(`有 ${unsyncedImages} 张图片尚未同步，退出后可能丢失。确定要退出吗？`)
      if (!confirmed) return
    } else if (unsyncedImages > 0) {
      // 0-3 张：直接退出（后续可改为 toast 提示）
    }
    if (onBack) onBack()
    else navigate('/')
  }

  const handleUndo = () => {
    if (editorViewRef.current) undo(editorViewRef.current)
  }
  const handleRedo = () => {
    if (editorViewRef.current) redo(editorViewRef.current)
  }
  const handleInsertDateTime = () => {
    if (!editorViewRef.current) return
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const v = editorViewRef.current
    v.dispatch(v.state.update(v.state.replaceSelection(dateStr)))
  }

  // ==================== 渲染 ====================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
          <p className="text-gray-400 text-sm">加载笔记中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={loadNoteData}>重试</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏：一行整合所有操作 */}
      <div className="h-10 md:h-10 flex items-center px-2 bg-white border-b border-[hsl(var(--border))] shrink-0">
        {/* 左侧：编辑操作按钮 */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* 撤销/重做/插入日期（仅编辑模式） */}
          {isEditing && (
            <>
              <Button variant="ghost" size="icon"
                className="h-9 w-9 md:h-7 md:w-7 text-gray-400 hover:text-gray-600 hover:bg-[hsl(var(--muted))]"
                onClick={handleUndo} title="撤销 (Ctrl+Z)"><Undo2 className="h-4 w-4 md:h-3.5 md:w-3.5" /></Button>
              <Button variant="ghost" size="icon"
                className="h-9 w-9 md:h-7 md:w-7 text-gray-400 hover:text-gray-600 hover:bg-[hsl(var(--muted))]"
                onClick={handleRedo} title="重做 (Ctrl+Shift+Z)"><Redo2 className="h-4 w-4 md:h-3.5 md:w-3.5" /></Button>
              <div className="hidden md:block w-px h-4 bg-[hsl(var(--border))] mx-0.5" />
              <Button variant="ghost" size="icon"
                className="h-9 w-9 md:h-7 md:w-7 text-gray-400 hover:text-gray-600 hover:bg-[hsl(var(--muted))]"
                onClick={handleInsertDateTime} title="插入日期时间 (Ctrl+Shift+D)"><CalendarPlus className="h-4 w-4 md:h-3.5 md:w-3.5" /></Button>
              <div className="hidden md:block w-px h-4 bg-[hsl(var(--border))] mx-0.5" />
            </>
          )}
        </div>

        {/* 中间：标题 */}
        <input
          className="flex-1 h-7 border-none bg-transparent text-sm font-medium text-center outline-none min-w-0 mx-2"
          placeholder="无标题笔记"
          value={title}
          onChange={(e) => { setTitle(e.target.value); scheduleSave(content) }}
          onBlur={() => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); doSave(content) }}
        />

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant={viewMode === 'preview' ? 'default' : 'ghost'} size="icon"
            className={`h-9 w-9 md:h-7 md:w-7 ${viewMode === 'preview' ? '' : 'text-gray-500 hover:bg-[hsl(var(--muted))]'}`}
            onClick={() => setViewMode('preview')} title="预览"><Eye className="h-4 w-4 md:h-3.5 md:w-3.5" /></Button>
          <Button variant={viewMode === 'edit' ? 'default' : 'ghost'} size="icon"
            className={`h-9 w-9 md:h-7 md:w-7 ${viewMode === 'edit' ? '' : 'text-gray-500 hover:bg-[hsl(var(--muted))]'}`}
            onClick={() => setViewMode('edit')} title="编辑"><Edit3 className="h-4 w-4 md:h-3.5 md:w-3.5" /></Button>

          {embedded ? (
            <Button variant="ghost" size="icon" className="hidden md:flex h-7 w-7 text-gray-500 hover:bg-[hsl(var(--muted))]"
              onClick={() => navigate(`/editor/${noteId}`)} title="全屏编辑"><Maximize2 className="h-3.5 w-3.5" /></Button>
          ) : (
            <Button variant="ghost" size="icon" className="hidden md:flex h-7 w-7 text-gray-500 hover:bg-[hsl(var(--muted))]"
              onClick={handleBack} title="退出全屏"><Minimize2 className="h-3.5 w-3.5" /></Button>
          )}

          <div className="relative">
            <Button variant="ghost" size="icon" className="h-9 w-9 md:h-7 md:w-7" title="更多" onClick={() => setMoreMenuOpen(!moreMenuOpen)}><MoreHorizontal className="h-5 w-5 md:h-4 md:w-4" /></Button>
            {moreMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-[hsl(var(--border))] rounded-xl shadow-lg shadow-black/10 z-50">
                  <button className="w-full text-left px-3 py-2 md:py-1.5 text-sm md:text-xs hover:bg-[hsl(var(--muted))] rounded-t-lg transition-colors" onClick={() => { setMoreMenuOpen(false); handleExportMarkdown() }}>导出 Markdown</button>
                  <button className="w-full text-left px-3 py-2 md:py-1.5 text-sm md:text-xs hover:bg-[hsl(var(--muted))]" onClick={() => { setMoreMenuOpen(false); handleExportPDF() }}>导出 PDF</button>
                  <button className="w-full text-left px-3 py-2 md:py-1.5 text-sm md:text-xs hover:bg-[hsl(var(--muted))]" onClick={() => { setMoreMenuOpen(false); setSaveAsTemplateModalOpen(true) }}>另存为模板</button>
                  <button className="w-full text-left px-3 py-2 md:py-1.5 text-sm md:text-xs text-red-500 hover:bg-red-50 rounded-b-lg transition-colors" onClick={() => { setMoreMenuOpen(false); setDeleteModalOpen(true) }}>删除笔记</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 主区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 章节目录 — 移动端默认隐藏，可切换 */}
        {outlineOpen && (
          <aside className="hidden md:flex w-[180px] bg-[hsl(220 14% 98%)] border-r border-[hsl(var(--border))] flex-col shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide flex items-center gap-1">
                <Hash className="h-3 w-3" />目录
              </span>
              <button
                className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setOutlineOpen(false)}
                title="收起目录"
              >
                <PanelLeftClose className="h-3 w-3" />
              </button>
            </div>
            {headings.length === 0 ? (
              <p className="px-3 py-6 text-xs text-gray-400 text-center leading-relaxed">使用 # 标题<br/>自动生成目录</p>
            ) : (
              <nav className="flex-1 pb-2">
                {headings.map((h, i) => (
                  <button key={i}
                    className="flex items-center w-full text-left py-1.5 hover:bg-[hsl(var(--muted))] transition-colors group border-l-2 border-transparent hover:border-[hsl(var(--primary))]/30"
                    style={{ paddingLeft: `${10 + (h.level - 1) * 12}px`, paddingRight: '8px' }}
                    onClick={() => scrollToHeading(h.lineIndex)} title={h.text}
                  >
                    <span className={`text-[12px] leading-tight truncate ${h.level === 1 ? 'font-semibold text-gray-800' : h.level === 2 ? 'font-medium text-gray-600' : 'text-gray-500'}`}>
                      {h.text}
                    </span>
                  </button>
                ))}
              </nav>
            )}
          </aside>
        )}

        {/* 内容 */}
        <div className="flex-1 overflow-hidden relative">
          {/* 目录关闭时显示展开按钮 */}
          {!outlineOpen && (
            <button
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-white border border-[hsl(var(--border))] rounded-r-md hover:bg-[hsl(var(--muted))] transition-colors shadow-sm"
              onClick={() => setOutlineOpen(true)} title="展开目录"
            >
              <PanelLeftOpen className="h-3.5 w-3.5 text-gray-400" />
            </button>
          )}

          {/* 编辑器容器 - 始终挂载，通过CSS控制显示/隐藏 */}
          <div className="h-full overflow-hidden" style={{ display: isEditing ? 'block' : 'none' }}>
            <div ref={editorRef} className="w-full h-full" />
          </div>
          {/* 预览容器 - 始终挂载，通过CSS控制显示/隐藏 */}
          <div ref={previewRef} className="h-full overflow-y-auto" style={{ display: isEditing ? 'none' : 'block' }}>
            <div className="max-w-[780px] mx-auto p-4 md:p-6 markdown-preview">
              {content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
              ) : (
                <div className="text-center mt-[60px]">
                  <p className="text-gray-400 text-sm mb-4">这篇笔记还没有内容</p>
                  <Button variant="outline" size="sm" onClick={() => setViewMode('edit')}>
                    <Edit3 className="h-4 w-4 mr-1.5" />开始写作
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className="h-7 flex items-center justify-between px-3 bg-white text-[11px] text-gray-400 shrink-0 border-t border-[hsl(var(--border))]">
        <span>字数: {wordCount}</span>
        <span className={isSaving ? 'text-orange-500' : 'text-green-600'}>
          {isSaving ? '保存中...' : lastSaved ? `已保存 ${new Date(lastSaved).toLocaleTimeString()}` : ''}
        </span>
        <span>{unsyncedImages > 0 ? `图片: ${unsyncedImages}张待同步` : ''}</span>
      </div>

      <DeleteConfirmModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete} title="确认删除" description="删除后将移至回收站，保留30天" confirmLabel="删除" />
      <RenameModal open={saveAsTemplateModalOpen} onClose={() => setSaveAsTemplateModalOpen(false)}
        onConfirm={handleSaveAsTemplate} title="另存为模板" currentName={title} />
    </div>
  )
}
