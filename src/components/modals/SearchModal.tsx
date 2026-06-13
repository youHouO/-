import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Search, X, FileText, FolderOpen, BookOpen } from 'lucide-react'
import { searchNotes, type SearchResult } from '@/engine/note-engine'

interface SearchModalProps {
  open: boolean
  onClose: () => void
  onOpenNote?: (noteId: string, searchKeyword?: string, matchLine?: number) => void
  /** 当前展开的书 ID，用于"当前书"搜索范围 */
  currentBookId?: string | null
}

const SEARCH_DEBOUNCE = 150

/** 安全渲染 snippet 中的 <mark> 高亮标签 */
function safeSnippetHtml(snippet: string): string {
  const endMark = '<' + '/mark>'
  const startMark = '<mark class="bg-yellow-200 rounded px-0.5">'
  const escaped = snippet
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .replace(/&lt;mark&gt;/g, startMark)
    .replace(/&lt;\/mark&gt;/g, endMark)
}

const HISTORY_KEY = 'localnotes_search_history'
const MAX_HISTORY = 10

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory(history: string[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY))) } catch { /* ignore */ }
}

export function SearchModal({ open, onClose, onOpenNote, currentBookId }: SearchModalProps) {
  const [keyword, setKeyword] = useState('')
  // scope: 'current' = 当前书, 'all' = 全部书
  const [scope, setScope] = useState<'current' | 'all'>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [history, setHistory] = useState<string[]>(loadHistory)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 打开时聚焦输入框，关闭时重置
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setKeyword('')
      setResults([])
    }
  }, [open])

  // 执行搜索，根据 scope 传递 bookId
  const doSearch = useCallback((kw: string, sc: 'current' | 'all') => {
    const trimmed = kw.trim()
    if (!trimmed) {
      setResults([])
      setSearching(false)
      return
    }
    // 保存搜索历史
    setHistory(prev => {
      const next = [trimmed, ...prev.filter(h => h !== trimmed)]
      saveHistory(next)
      return next
    })
    setSearching(true)
    try {
      const bookId = sc === 'current' ? currentBookId : undefined
      const searchResults = searchNotes(trimmed, bookId, 50)
      setResults(searchResults)
    } catch (err) {
      console.error('搜索出错:', err)
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [currentBookId])

  // 关键词变化时防抖搜索
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!keyword.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    debounceRef.current = setTimeout(() => doSearch(keyword, scope), SEARCH_DEBOUNCE)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [keyword, scope, doSearch])

  // scope 变化时，如果有关键词则立即重新搜索
  useEffect(() => {
    if (keyword.trim()) {
      doSearch(keyword, scope)
    }
  }, [scope]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenNote = (noteId: string, matchLine?: number) => {
    const kw = keyword.trim()
    onClose()
    onOpenNote?.(noteId, kw || undefined, matchLine)
  }

  // 按书→卷→笔记分组
  const grouped = results.reduce((acc, r) => {
    if (!acc[r.bookId]) {
      acc[r.bookId] = { bookName: r.bookName, bookId: r.bookId, volumes: {} }
    }
    if (!acc[r.bookId].volumes[r.volumeId]) {
      acc[r.bookId].volumes[r.volumeId] = { volumeName: r.volumeName, volumeId: r.volumeId, notes: [] }
    }
    acc[r.bookId].volumes[r.volumeId].notes.push(r)
    return acc
  }, {} as Record<string, {
    bookName: string
    bookId: string
    volumes: Record<string, { volumeName: string; volumeId: string; notes: SearchResult[] }>
  }>)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[600px] max-h-[70vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle>搜索笔记</DialogTitle>
          <DialogDescription>搜索标题和内容，点击结果跳转</DialogDescription>
        </DialogHeader>
        {/* 搜索输入区 */}
        <div className="px-5 pt-5 pb-3 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                className="w-full h-10 pl-10 pr-10 rounded-lg bg-[hsl(220 14% 97%)] border border-transparent text-sm focus:outline-none focus:border-[hsl(var(--primary))]/30 focus:bg-white transition-colors"
                placeholder="搜索笔记..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              {keyword && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setKeyword('')}>
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {/* 两个独立按钮：当前书 + 全部书 */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                className={`h-7 px-2 sm:h-9 sm:px-3 rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${
                  scope === 'current'
                    ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                    : 'bg-[hsl(var(--muted))] text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setScope('current')}
              >
                当前书
              </button>
              <button
                className={`h-7 px-2 sm:h-9 sm:px-3 rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${
                  scope === 'all'
                    ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                    : 'bg-[hsl(var(--muted))] text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setScope('all')}
              >
                全部书
              </button>
            </div>
          </div>
        </div>

        {/* 搜索结果区 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!keyword.trim() ? (
            history.length > 0 ? (
              <div className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400">最近搜索</p>
                  <button className="text-xs text-gray-400 hover:text-red-400" onClick={() => { setHistory([]); saveHistory([]) }}>清除</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {history.map((h, i) => (
                    <button
                      key={i}
                      className="px-3 py-1.5 rounded-lg bg-[hsl(var(--muted))] text-sm text-gray-600 hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))] transition-colors"
                      onClick={() => { setKeyword(h); doSearch(h, scope) }}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="h-8 w-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">输入关键词开始搜索</p>
                <p className="text-xs text-gray-300 mt-1">支持标题和内容搜索</p>
              </div>
            )
          ) : searching ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-4 h-4 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin mr-2" />
              <span className="text-sm text-gray-400">搜索中...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-8 w-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">未找到相关内容</p>
              <p className="text-xs text-gray-300 mt-1">尝试更换关键词或切换搜索范围</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-400 mb-3">找到 {results.length} 条结果</p>
              <div className="space-y-1">
                {Object.entries(grouped).map(([bookId, book]) => (
                  <div key={bookId} className="mb-2">
                    {/* 书名 */}
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0" />
                      <span className="text-xs font-semibold text-gray-700 truncate">{book.bookName}</span>
                    </div>
                    {Object.entries(book.volumes).map(([volumeId, volume]) => (
                      <div key={volumeId}>
                        {/* 卷名 */}
                        <div className="flex items-center gap-2 pl-5 pr-2 py-1">
                          <FolderOpen className="h-3 w-3 text-amber-500 shrink-0" />
                          <span className="text-xs text-gray-500 truncate">{volume.volumeName}</span>
                        </div>
                        {/* 笔记列表 */}
                        <div className="pl-5">
                          {volume.notes.map((note) => (
                            <button
                              key={note.noteId}
                              className="flex items-start gap-2.5 pl-3 sm:pl-5 pr-3 py-2.5 w-full text-left rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
                              onClick={() => handleOpenNote(note.noteId, note.matchLine)}
                            >
                              <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-gray-800 truncate">{note.title || '无标题笔记'}</div>
                                {note.snippet && (
                                  <div
                                    className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: safeSnippetHtml(note.snippet) }}
                                  />
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
