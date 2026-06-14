import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  BookOpen, RefreshCw, Settings, Plus, Trash2, FileText,
  MoreHorizontal, FolderOpen, File, ChevronRight, ChevronDown,
  Loader2, Library, Search, Pencil, Archive, Menu, X,
  Download, Shield, Database,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CreateModal } from '@/components/modals/CreateModal'
import { RenameModal } from '@/components/modals/RenameModal'
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal'
import { APP_NAME } from '@/config'
import {
  createBook, listBooks, renameBook, deleteBook,
  createVolume, listVolumes, renameVolume, deleteVolume,
  createNote, listNotes, deleteNote, renameNote,
} from '@/engine/note-engine'
import { initStorage, readFile, writeFile, getFallbackReason, initStorageWithBackend, initStorageWithHandle } from '@/engine/storage'
import { initDatabase } from '@/engine/database'
import { createBuiltinNotes } from '@/engine/builtin-notes'
import { loadHandle } from '@/engine/storage-handle'
import { NoteEditor } from '@/components/NoteEditor'
import { SettingsModal } from '@/components/modals/SettingsModal'
import { SearchModal } from '@/components/modals/SearchModal'
import { WelcomePicker } from '@/components/WelcomePicker'
import type { Book, Volume, Note } from '@/types'

type StartupPhase = 'init' | 'picking' | 'creating-builtins' | 'ready'

export function HomePage() {
  const { bookId: routeBookId } = useParams<{ bookId?: string }>()

  // 启动阶段
  const [startupPhase, setStartupPhase] = useState<StartupPhase>('init')
  const [storageReady, setStorageReady] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fallbackReason, setFallbackReason] = useState<string | null>(null)

  // 数据
  const [books, setBooks] = useState<Book[]>([])
  // 每个展开的书 → 卷列表；每个展开的卷 → 笔记列表
  const [volumesMap, setVolumesMap] = useState<Record<string, Volume[]>>({})
  const [notesMap, setNotesMap] = useState<Record<string, Note[]>>({})

  // 展开状态
  const [expandedBookId, setExpandedBookId] = useState<string | null>(routeBookId || null)
  const [expandedVolumeId, setExpandedVolumeId] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [searchKeyword, setSearchKeyword] = useState<string | undefined>(undefined)
  const [searchMatchLine, setSearchMatchLine] = useState<number | undefined>(undefined)

  // 移动端侧边栏状态（默认关闭）
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 弹窗状态
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createModalType, setCreateModalType] = useState<'book' | 'volume' | 'note'>('book')
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; type: 'book' | 'volume' | 'note' } | null>(null)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [settingsInitialPage, setSettingsInitialPage] = useState<'trash' | 'templates' | 'cloud' | 'export' | 'security' | 'database' | undefined>(undefined)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'book' | 'volume' | 'note'; name: string } | null>(null)
  const [contextMenuTarget, setContextMenuTarget] = useState<{ id: string; name: string; type: 'book' | 'volume' | 'note' } | null>(null)

  // 防止 StrictMode 双重初始化
  const initStartedRef = useRef(false)

  // ==================== 初始化 ====================
  useEffect(() => {
    if (!initStartedRef.current) {
      initStartedRef.current = true
      doInit()
    }
  }, [])

  useEffect(() => {
    if (routeBookId && storageReady) {
      setExpandedBookId(routeBookId)
      loadVolumesForBook(routeBookId)
    }
  }, [routeBookId, storageReady])

  const doInit = async () => {
    try {
      // 先检查是否有已保存的 handle（不弹系统对话框）
      const savedHandle = await loadHandle()
      if (savedHandle) {
        // 有已保存的 handle，直接用 initStorage 恢复（内部会验证权限）
        await initStorage()
      } else {
        // 没有已保存的 handle，直接显示欢迎页让用户选择
        setStartupPhase('picking')
        return
      }

      await initDatabase(
        async (path) => {
          try { return await readFile(path) } catch { return null }
        },
        async (path, data) => { await writeFile(path, data) }
      )
      setStorageReady(true)
      setFallbackReason(null)

      try {
        const existingBooks = listBooks()
        if (existingBooks.length === 0) {
          setStartupPhase('creating-builtins')
          await createBuiltinNotes()
        }
      } catch (err) {
        console.error('创建内置笔记失败:', err)
      }

      loadBooks()
      setStartupPhase('ready')
    } catch (err) {
      console.error('初始化失败:', err)
      // handle 权限不足或其他错误，显示欢迎页让用户重新选择
      setStartupPhase('picking')
    }
  }

  const handlePickerReady = async () => {
    setStartupPhase('init')
    setErrorMsg(null)
    try {
      // WelcomePicker 已经调用了 initStorageWithHandle，存储已就绪
      await initDatabase(
        async (path) => {
          try { return await readFile(path) } catch { return null }
        },
        async (path, data) => { await writeFile(path, data) }
      )
      setStorageReady(true)
      setFallbackReason(null)

      try {
        const existingBooks = listBooks()
        if (existingBooks.length === 0) {
          setStartupPhase('creating-builtins')
          await createBuiltinNotes()
        }
      } catch (err) {
        console.error('创建内置笔记失败:', err)
      }

      loadBooks()
      setStartupPhase('ready')
    } catch (err) {
      console.error('初始化数据库失败:', err)
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStartupPhase('picking')
    }
  }

  const handlePickerFallback = async () => {
    setStartupPhase('init')
    setErrorMsg(null)
    // 强制使用 OPFS 后端
    try {
      await initStorageWithBackend('opfs')
      await initDatabase(
        async (path) => {
          try { return await readFile(path) } catch { return null }
        },
        async (path, data) => { await writeFile(path, data) }
      )
      setStorageReady(true)
      setFallbackReason(null)

      try {
        const existingBooks = listBooks()
        if (existingBooks.length === 0) {
          setStartupPhase('creating-builtins')
          await createBuiltinNotes()
        }
      } catch (err) {
        console.error('创建内置笔记失败:', err)
      }

      loadBooks()
    } catch (err) {
      console.error('降级初始化失败:', err)
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setStartupPhase('ready')
    }
  }

  const loadBooks = useCallback(() => {
    try {
      setBooks(listBooks())
    } catch (err) {
      console.error('加载书列表失败:', err)
    }
  }, [])

  const loadVolumesForBook = useCallback((bookId: string) => {
    try {
      setVolumesMap(prev => ({ ...prev, [bookId]: listVolumes(bookId) }))
    } catch (err) {
      console.error('加载卷列表失败:', err)
    }
  }, [])

  const loadNotesForVolume = useCallback((volumeId: string) => {
    try {
      setNotesMap(prev => ({ ...prev, [volumeId]: listNotes(volumeId) }))
    } catch (err) {
      console.error('加载笔记列表失败:', err)
    }
  }, [])

  // ==================== 操作处理 ====================

  const handleCreateBook = async (name: string) => {
    if (!storageReady) {
      alert('请先设置数据存储位置')
      setStartupPhase('picking')
      return
    }
    try {
      await createBook(name)
      loadBooks()
    } catch (err) {
      alert(`创建书失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleCreateVolume = async (name: string) => {
    if (!storageReady) {
      alert('请先设置数据存储位置')
      setStartupPhase('picking')
      return
    }
    if (!expandedBookId) return
    try {
      await createVolume(expandedBookId, name)
      loadVolumesForBook(expandedBookId)
      loadBooks()
    } catch (err) {
      alert(`创建卷失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleCreateNote = async (name: string) => {
    if (!storageReady) {
      alert('请先设置数据存储位置')
      setStartupPhase('picking')
      return
    }
    if (!expandedVolumeId || !expandedBookId) return
    try {
      await createNote(expandedVolumeId, name)
      loadNotesForVolume(expandedVolumeId)
      loadVolumesForBook(expandedBookId)
      loadBooks()
    } catch (err) {
      alert(`创建笔记失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleRename = async (newName: string) => {
    if (!renameTarget) return
    try {
      if (renameTarget.type === 'book') {
        await renameBook(renameTarget.id, newName)
        loadBooks()
      } else if (renameTarget.type === 'volume') {
        await renameVolume(renameTarget.id, newName)
        if (expandedBookId) loadVolumesForBook(expandedBookId)
      } else if (renameTarget.type === 'note') {
        await renameNote(renameTarget.id, newName)
        if (expandedVolumeId) loadNotesForVolume(expandedVolumeId)
        if (expandedBookId) loadVolumesForBook(expandedBookId)
        loadBooks()
      }
    } catch (err) {
      alert(`重命名失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      if (deleteTarget.type === 'book') {
        await deleteBook(deleteTarget.id)
        if (expandedBookId === deleteTarget.id) {
          setExpandedBookId(null)
          setExpandedVolumeId(null)
        }
        loadBooks()
      } else if (deleteTarget.type === 'volume') {
        await deleteVolume(deleteTarget.id)
        if (expandedBookId) loadVolumesForBook(expandedBookId)
        if (expandedVolumeId === deleteTarget.id) {
          setExpandedVolumeId(null)
        }
        loadBooks()
      } else if (deleteTarget.type === 'note') {
        await deleteNote(deleteTarget.id)
        if (selectedNoteId === deleteTarget.id) setSelectedNoteId(null)
        if (expandedVolumeId) loadNotesForVolume(expandedVolumeId)
        if (expandedBookId) loadVolumesForBook(expandedBookId)
        loadBooks()
      }
    } catch (err) {
      alert(`删除失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const openNote = (noteId: string, keyword?: string, matchLine?: number) => {
    setSelectedNoteId(noteId)
    setSearchKeyword(keyword)
    setSearchMatchLine(matchLine)
    // 移动端打开笔记后自动关闭侧边栏
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  const toggleBook = (bookId: string) => {
    if (expandedBookId === bookId) {
      setExpandedBookId(null)
      setExpandedVolumeId(null)
    } else {
      setExpandedBookId(bookId)
      setExpandedVolumeId(null)
      loadVolumesForBook(bookId)
    }
  }

  const toggleVolume = (volumeId: string) => {
    if (expandedVolumeId === volumeId) {
      setExpandedVolumeId(null)
    } else {
      setExpandedVolumeId(volumeId)
      loadNotesForVolume(volumeId)
    }
  }

  // ==================== 格式化 ====================

  const formatTime = (ts: number) => {
    const d = new Date(Math.abs(ts))
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  // ==================== 辅助 ====================

  const volumesForCurrentBook = expandedBookId ? (volumesMap[expandedBookId] || []) : []
  const notesForCurrentVolume = expandedVolumeId ? (notesMap[expandedVolumeId] || []) : []

  // ==================== 渲染内容区 ====================

  const renderContent = () => {
    // 初始化出错
    if (!storageReady && errorMsg) {
      return (
        <main className="flex-1 flex items-center justify-center">
          <div className="max-w-[400px] text-center px-6">
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-5">
              <span className="text-2xl">!</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">初始化失败</h2>
            <p className="mt-3 text-sm text-red-500 text-center leading-relaxed">{errorMsg}</p>
            <p className="mt-2 text-xs text-gray-400">请确保使用最新版 Chrome、Firefox 或 Safari 浏览器</p>
            <Button className="w-full h-10 mt-6" size="lg" onClick={doInit}>
              重试
            </Button>
          </div>
        </main>
      )
    }

    // 需要选择存储文件夹
    if (startupPhase === 'picking') {
      return (
        <WelcomePicker
          onReady={handlePickerReady}
          onFallback={handlePickerFallback}
          fallbackReason={fallbackReason}
        />
      )
    }

    // 正在初始化
    if (startupPhase === 'init') {
      return (
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-5 w-5 text-[hsl(var(--primary))] animate-spin" />
            <p className="text-gray-400 text-sm">正在加载...</p>
          </div>
        </main>
      )
    }

    // 正在创建入门笔记
    if (startupPhase === 'creating-builtins') {
      return (
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-5 w-5 text-[hsl(var(--primary))] animate-spin" />
            <p className="text-gray-400 text-sm">正在准备入门指南...</p>
          </div>
        </main>
      )
    }

    // 没有任何书
    if (books.length === 0) {
      return (
        <main className="flex-1 flex items-center justify-center">
          <div className="max-w-[380px] text-center px-6">
            <div className="mx-auto w-16 h-16 bg-[hsl(var(--accent))] rounded-2xl flex items-center justify-center mb-5">
              <BookOpen className="h-8 w-8 text-[hsl(var(--primary))]" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">开始你的第一本书</h2>
            <p className="mt-2 text-sm text-gray-500 text-center leading-relaxed">
              创建一本书来组织你的笔记，所有数据都保存在你的设备上
            </p>
            <Button className="w-full h-10 mt-6" size="lg" onClick={() => {
              setCreateModalType('book')
              setCreateModalOpen(true)
            }}>
              新建书
            </Button>
            <p className="mt-4 text-sm text-gray-400 cursor-pointer hover:text-[hsl(var(--primary))] transition-colors" onClick={() => { setSettingsInitialPage('cloud'); setSettingsModalOpen(true) }}>
              从云盘恢复已有数据
            </p>
          </div>
        </main>
      )
    }

    // 正常：单列目录树布局
    return (
      <div className="flex flex-1 overflow-hidden relative">
        {/* 移动端侧边栏遮罩 */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* 左侧目录树 — 桌面端flex布局，移动端fixed覆盖 */}
        <aside
          className={`bg-gray-50 border-r border-[hsl(var(--border))] flex flex-col transition-all duration-300 md:relative md:z-auto md:shrink-0 ${
            sidebarOpen
              ? 'fixed inset-y-0 left-0 w-[260px] z-50 md:static md:w-[260px]'
              : 'hidden md:flex md:w-[260px]'
          }`}
        >
          {/* 新建书按钮 */}
          <button
            className="flex items-center gap-2 h-10 px-4 text-sm text-[hsl(var(--primary))] font-medium hover:bg-[hsl(var(--accent))] transition-colors shrink-0"
            onClick={() => {
              setCreateModalType('book')
              setCreateModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            <span>新建书</span>
          </button>

          {/* 目录树 */}
          <div className="flex-1 overflow-y-auto py-1">
            {books.map((book) => {
              const bookExpanded = expandedBookId === book.id
              return (
                <div key={book.id}>
                  {/* 书 */}
                  <div
                    className={`flex items-center justify-between h-10 px-3 mx-1 rounded-lg cursor-pointer transition-colors group ${
                      bookExpanded ? 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))]' : 'hover:bg-[hsl(var(--muted))]'
                    }`}
                    onClick={() => toggleBook(book.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-400 shrink-0 transition-transform duration-150">
                        {bookExpanded
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />
                        }
                      </span>
                      <BookOpen className="h-4 w-4 text-[hsl(var(--primary))] shrink-0 opacity-70" />
                      <span className="text-sm truncate font-medium">{book.name}</span>
                      <span className="text-[11px] text-gray-400 shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">{book.noteCount}</span>
                    </div>
                    <button
                      className="p-1 rounded-md hover:bg-[hsl(var(--muted))] md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setContextMenuTarget({ id: book.id, name: book.name, type: 'book' })
                      }}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                  </div>

                  {/* 卷 */}
                  {bookExpanded && (
                    <div className="ml-2 mt-0.5 mb-1">
                      {volumesForCurrentBook.map((vol) => {
                        const volExpanded = expandedVolumeId === vol.id
                        return (
                          <div key={vol.id}>
                            <div
                              className={`flex items-center justify-between h-9 pl-7 pr-2 mx-1 rounded-lg cursor-pointer transition-colors group ${
                                volExpanded ? 'bg-[hsl(var(--accent))]' : 'hover:bg-[hsl(var(--muted))]'
                              }`}
                              onClick={() => toggleVolume(vol.id)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-gray-400 shrink-0 transition-transform duration-150">
                                  {volExpanded
                                    ? <ChevronDown className="h-3 w-3" />
                                    : <ChevronRight className="h-3 w-3" />
                                  }
                                </span>
                                <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <span className="text-[13px] truncate">{vol.name}</span>
                                <span className="text-[11px] text-gray-400 shrink-0">{vol.noteCount}</span>
                              </div>
                              <button
                                className="p-1 rounded-md hover:bg-gray-200 md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setContextMenuTarget({ id: vol.id, name: vol.name, type: 'volume' })
                                }}
                              >
                                <MoreHorizontal className="h-3 w-3 text-gray-400" />
                              </button>
                            </div>

                            {/* 笔记 */}
                            {volExpanded && (
                              <div className="ml-3 mb-0.5">
                                {notesForCurrentVolume.map((note) => (
                                  <div
                                    key={note.id}
                                    className={`flex items-center justify-between h-9 pl-6 pr-2 mx-1 rounded-lg cursor-pointer transition-colors group ${
                                      selectedNoteId === note.id ? 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))]' : 'hover:bg-[hsl(var(--muted))]'
                                    }`}
                                    onClick={() => openNote(note.id)}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <File className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                      <span className="text-[13px] truncate">{note.title}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="text-[11px] text-gray-400 md:hidden md:group-hover:inline">
                                        {formatTime(note.updatedAt)}
                                      </span>
                                      <button
                                        className="p-0.5 rounded hover:bg-gray-200 md:opacity-0 md:group-hover:opacity-100 transition-all"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setContextMenuTarget({ id: note.id, name: note.title, type: 'note' })
                                        }}
                                      >
                                        <MoreHorizontal className="h-3 w-3 text-gray-400" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                {/* 新建笔记入口 */}
                                <button
                                  className="flex items-center gap-2 h-8 pl-6 pr-2 mx-1 w-full text-[13px] text-gray-400 hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] transition-colors rounded-lg"
                                  onClick={() => {
                                    setCreateModalType('note')
                                    setCreateModalOpen(true)
                                  }}
                                >
                                  <Plus className="h-3 w-3" />
                                  <span>新建笔记</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {/* 新建卷入口 */}
                      <button
                        className="flex items-center gap-2 h-8 pl-5 pr-2 mx-1 w-full text-[13px] text-gray-400 hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] transition-colors rounded-lg"
                        onClick={() => {
                          setCreateModalType('volume')
                          setCreateModalOpen(true)
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        <span>新建卷</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 底部入口 */}
          <div className="border-t border-[hsl(var(--border))] shrink-0">
            <button
              className="flex items-center gap-2.5 h-10 px-4 w-full text-sm text-gray-500 hover:bg-[hsl(var(--muted))] transition-colors"
              onClick={() => { setSettingsInitialPage('trash'); setSettingsModalOpen(true) }}
            >
              <Archive className="h-4 w-4" />
              <span>回收站</span>
            </button>
            <button
              className="flex items-center gap-2.5 h-10 px-4 w-full text-sm text-gray-500 hover:bg-[hsl(var(--muted))] transition-colors"
              onClick={() => { setSettingsInitialPage('templates'); setSettingsModalOpen(true) }}
            >
              <FileText className="h-4 w-4" />
              <span>模板管理</span>
            </button>
            <button
              className="flex items-center gap-2.5 h-10 px-4 w-full text-sm text-gray-500 hover:bg-[hsl(var(--muted))] transition-colors"
              onClick={() => { setSettingsInitialPage('export'); setSettingsModalOpen(true) }}
            >
              <Download className="h-4 w-4" />
              <span>数据导出</span>
            </button>
            <button
              className="flex items-center gap-2.5 h-10 px-4 w-full text-sm text-gray-500 hover:bg-[hsl(var(--muted))] transition-colors"
              onClick={() => { setSettingsInitialPage('security'); setSettingsModalOpen(true) }}
            >
              <Shield className="h-4 w-4" />
              <span>安全与加密</span>
            </button>
            <button
              className="flex items-center gap-2.5 h-10 px-4 w-full text-sm text-gray-500 hover:bg-[hsl(var(--muted))] transition-colors"
              onClick={() => { setSettingsInitialPage('database'); setSettingsModalOpen(true) }}
            >
              <Database className="h-4 w-4" />
              <span>数据库管理</span>
            </button>
          </div>
        </aside>

        {/* 右侧主区域 */}
        <main className="flex-1 bg-white overflow-hidden">
          {selectedNoteId ? (
            <NoteEditor noteId={selectedNoteId} embedded searchKeyword={searchKeyword} searchMatchLine={searchMatchLine} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="max-w-[300px] text-center">
                <div className="mx-auto w-14 h-14 bg-[hsl(var(--accent))] rounded-2xl flex items-center justify-center mb-4">
                  <Library className="h-7 w-7 text-[hsl(var(--primary))]" />
                </div>
                <h3 className="text-base font-medium text-gray-600 mb-1.5">
                  {expandedVolumeId
                    ? '点击笔记开始编辑'
                    : expandedBookId
                      ? '展开一个卷'
                      : '展开一本书'}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {expandedVolumeId
                    ? '点击左侧目录树中的笔记即可开始编辑'
                    : expandedBookId
                      ? '点击卷旁的箭头展开笔记列表'
                      : '点击书旁的箭头展开卷列表'}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }

  // ==================== 主渲染 ====================

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* 顶部栏 */}
      <header className="h-12 flex items-center justify-between px-3 sm:px-4 bg-white border-b border-[hsl(var(--border))] shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* 移动端菜单按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8 shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <div className="w-7 h-7 bg-[hsl(var(--primary))] rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">N</span>
          </div>
          {/* 标题在移动端隐藏，sm以上显示 */}
          <h1 className="hidden sm:block text-sm font-semibold text-gray-800 truncate">{APP_NAME}</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 搜索框：移动端只显示图标按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden h-8 w-8 text-gray-400 hover:text-[hsl(var(--primary))]"
            onClick={() => setSearchModalOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              className="w-[180px] md:w-[220px] lg:w-[260px] h-8 pl-8 pr-3 rounded-lg bg-[hsl(220 14% 97%)] border-transparent text-sm focus:border-[hsl(var(--primary))]/30 focus:bg-white transition-colors"
              placeholder="搜索笔记..."
              onFocus={() => setSearchModalOpen(true)}
              onClick={() => setSearchModalOpen(true)}
              readOnly
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-[hsl(var(--primary))]"
            title="云同步"
            onClick={() => { setSettingsInitialPage('cloud'); setSettingsModalOpen(true) }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600" onClick={() => setSettingsModalOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* 内容区 */}
      {renderContent()}

      {/* 底部状态栏 */}
      <footer className="h-7 flex items-center justify-between px-4 bg-white text-[11px] text-gray-400 shrink-0 border-t border-[hsl(var(--border))]">
        <span>未配置云盘</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          离线
        </span>
      </footer>

      {/* 弹窗 */}
      <CreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onConfirm={(name) => {
          if (createModalType === 'book') handleCreateBook(name)
          else if (createModalType === 'volume') handleCreateVolume(name)
          else if (createModalType === 'note') handleCreateNote(name)
        }}
        title={createModalType === 'book' ? '新建书' : createModalType === 'volume' ? '新建卷' : '新建笔记'}
      />

      {renameTarget && (
        <RenameModal
          open={renameModalOpen}
          onClose={() => setRenameModalOpen(false)}
          onConfirm={handleRename}
          title={`重命名${renameTarget.type === 'book' ? '书' : renameTarget.type === 'volume' ? '卷' : '笔记'}`}
          currentName={renameTarget.name}
        />
      )}

      <SettingsModal open={settingsModalOpen} onClose={() => { setSettingsModalOpen(false); setSettingsInitialPage(undefined) }} initialPage={settingsInitialPage} />

      <SearchModal open={searchModalOpen} onClose={() => setSearchModalOpen(false)} onOpenNote={(noteId, keyword, matchLine) => openNote(noteId, keyword, matchLine)} currentBookId={expandedBookId} />

      {deleteTarget && (
        <DeleteConfirmModal
          open={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDelete}
          title="确认删除"
          description={`删除「${deleteTarget.name}」后将移至回收站，保留30天`}
          confirmLabel="删除"
        />
      )}

      {/* 右键/更多操作菜单 */}
      {contextMenuTarget && (
        <div className="fixed inset-0 z-50" onClick={() => setContextMenuTarget(null)}>
          <div
            className="absolute bg-white border border-[hsl(var(--border))] rounded-xl shadow-lg shadow-black/10 py-1 min-w-[140px] z-50"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
              onClick={() => {
                setRenameTarget(contextMenuTarget)
                setRenameModalOpen(true)
                setContextMenuTarget(null)
              }}
            >
              <Pencil className="h-3.5 w-3.5 text-gray-400" />
              重命名
            </button>
            <button
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
              onClick={() => {
                setDeleteTarget(contextMenuTarget)
                setDeleteModalOpen(true)
                setContextMenuTarget(null)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
