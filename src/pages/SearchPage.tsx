import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { searchNotes, type SearchResult } from '@/engine/note-engine'
import type { SearchScope } from '@/types'

/** 搜索防抖延迟 */
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



const SEARCH_DEBOUNCE = 150

/**
 * 全局搜索页
 * 基于 SQLite FTS5 全文索引，实时搜索结果
 */
export function SearchPage() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [scope, setScope] = useState<SearchScope>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** 执行搜索 */
  const doSearch = useCallback((kw: string, _sc: SearchScope) => {
    if (!kw.trim()) {
      setResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    try {
      const bookId = undefined // 当前书功能后续通过 store 获取
      const searchResults = searchNotes(kw.trim(), bookId, 50)
      setResults(searchResults)
    } catch (err) {
      console.error('搜索出错:', err)
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  /** 关键词变化时防抖搜索 */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!keyword.trim()) {
      setResults([])
      setSearching(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      doSearch(keyword, scope)
    }, SEARCH_DEBOUNCE)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [keyword, scope, doSearch])

  /** 跳转到笔记 */
  const handleOpenNote = (noteId: string) => {
    navigate(`/editor/${noteId}`)
  }

  /** 跳转到书 */
  const handleOpenBook = (bookId: string) => {
    navigate(`/book/${bookId}`)
  }

  /** 跳转到卷 */
  const handleOpenVolume = (volumeId: string) => {
    navigate(`/volume/${volumeId}`)
  }

  /** 按书分组结果 */
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
    volumes: Record<string, {
      volumeName: string
      volumeId: string
      notes: SearchResult[]
    }>
  }>)

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* 顶部搜索栏 */}
      <header className="h-14 flex items-center gap-3 px-4 bg-[#FAFAFA] border-b border-[#E5E7EB] shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="h-10 pl-10 pr-10 rounded-lg bg-[#F3F4F6]"
            placeholder="搜索笔记..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            autoFocus
          />
          {keyword && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setKeyword('')}>
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs shrink-0"
          onClick={() => setScope(scope === 'all' ? 'current-book' : 'all')}
        >
          {scope === 'all' ? '全部书' : '当前书'}
        </Button>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto">
        {!keyword.trim() ? (
          <div>
            <h3 className="text-sm text-gray-400 px-4 py-4">输入关键词开始搜索</h3>
            <div className="text-sm text-gray-400 text-center mt-16">
              支持全文搜索，基于 FTS5 引擎
            </div>
          </div>
        ) : searching ? (
          <div className="flex items-center justify-center mt-16">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
            <span className="text-sm text-gray-400">搜索中...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="text-sm text-gray-400 text-center mt-16">
            <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <Search className="h-10 w-10 text-gray-300" />
            </div>
            未找到相关内容
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-4 px-4">
            <p className="text-xs text-gray-400 mb-4">
              找到 {results.length} 条结果
            </p>

            {/* 按书→卷→笔记层级展示 */}
            <div className="space-y-4">
              {Object.entries(grouped).map(([bookId, book]) => (
                <div key={bookId}>
                  {/* 书名 */}
                  <button
                    className="flex items-center gap-2 mb-2 hover:bg-[#F3F4F6] rounded px-1 py-0.5 transition-colors"
                    onClick={() => handleOpenBook(bookId)}
                  >
                    <span className="text-lg">📚</span>
                    <span className="text-base font-medium text-gray-900">
                      {book.bookName}
                    </span>
                  </button>

                  {Object.entries(book.volumes).map(([volumeId, volume]) => (
                    <div key={volumeId} className="ml-4">
                      {/* 卷名 */}
                      <button
                        className="flex items-center gap-2 mb-1 hover:bg-[#F3F4F6] rounded px-1 py-0.5 transition-colors"
                        onClick={() => handleOpenVolume(volumeId)}
                      >
                        <span className="text-base">📁</span>
                        <span className="text-sm text-gray-700">
                          {volume.volumeName}
                        </span>
                      </button>

                      {/* 笔记列表 */}
                      {volume.notes.map((note) => (
                        <button
                          key={note.noteId}
                          className="flex items-start gap-2 ml-4 mb-1 px-3 py-2 w-full text-left rounded-lg hover:bg-[#F3F4F6] transition-colors"
                          onClick={() => handleOpenNote(note.noteId)}
                        >
                          <span className="text-base shrink-0 mt-0.5">📝</span>
                          <div className="min-w-0">
                            <div className="text-sm text-gray-900 truncate">
                              {note.title || '无标题笔记'}
                            </div>
                            {note.snippet && (
                              <div
                                className="text-xs text-gray-500 mt-0.5 line-clamp-2"
                                dangerouslySetInnerHTML={{ __html: safeSnippetHtml(note.snippet) }}
                              />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
