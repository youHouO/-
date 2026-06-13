import { describe, it, expect, vi, beforeEach } from 'vitest'

// ==================== Mock storage module ====================
vi.mock('@/engine/storage', () => ({
  initStorage: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  fileExists: vi.fn(),
  deleteFile: vi.fn(),
  listDirectory: vi.fn(),
  createDirectory: vi.fn(),
  moveFile: vi.fn(),
  deleteDirectory: vi.fn(),
  isStorageReady: vi.fn(() => true),
}))

// ==================== Mock database module ====================
vi.mock('@/engine/database', () => ({
  initDatabase: vi.fn(),
  getDB: vi.fn(),
  isFTS5Available: vi.fn(() => false),
  saveDB: vi.fn(),
  closeDB: vi.fn(),
  updateFTSContent: vi.fn(),
}))

// ==================== Mock encryption module ====================
vi.mock('@/engine/encryption', () => ({
  encryptString: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  decryptToString: vi.fn().mockResolvedValue('decrypted-content'),
  sha256: vi.fn().mockResolvedValue('abc123hash'),
}))

// ==================== Imports (after mocks) ====================
import { listBooks, getBook, searchNotes, listTrash, cleanExpiredTrash } from '@/engine/note-engine'
import type { TrashItem } from '@/engine/note-engine'
import * as storage from '@/engine/storage'
import * as database from '@/engine/database'

// ==================== Helper: 创建 mock Database 对象 ====================
function createMockDB(execResults: unknown[][] = []) {
  return {
    run: vi.fn(),
    exec: vi.fn().mockImplementation((..._args: unknown[]) => {
      // 如果有预设结果，按顺序返回
      if (execResults.length > 0) {
        return execResults.shift() as unknown[]
      }
      return [] // 默认空结果
    }),
    getRowsModified: vi.fn().mockReturnValue(1),
    export: vi.fn().mockReturnValue(new Uint8Array([0])),
    close: vi.fn(),
  }
}

// ==================== Tests ====================
describe('note-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认：存储就绪
    vi.mocked(storage.isStorageReady).mockReturnValue(true)
    // 默认：FTS5 不可用
    vi.mocked(database.isFTS5Available).mockReturnValue(false)
  })

  // ==================== listBooks ====================
  describe('listBooks', () => {
    it('存储未就绪时应抛出错误', () => {
      vi.mocked(storage.isStorageReady).mockReturnValue(false)
      expect(() => listBooks()).toThrow('存储目录未初始化')
    })

    it('数据库无结果时应返回空数组', () => {
      const mockDb = createMockDB([[]]) // exec 返回空数组
      vi.mocked(database.getDB).mockReturnValue(mockDb as never)

      const result = listBooks()
      expect(result).toEqual([])
    })

    it('应正确解析数据库结果并返回 Book 数组', () => {
      const mockDb = createMockDB([
        // exec 返回的结果
        [
          {
            columns: ['id', 'name', 'created_at', 'updated_at', 'note_count'],
            values: [
              ['book-1', '我的第一本书', 1000, 2000, 5],
              ['book-2', '学习笔记', 3000, 4000, 10],
            ],
          },
        ],
      ])
      vi.mocked(database.getDB).mockReturnValue(mockDb as never)

      const result = listBooks()

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'book-1',
        name: '我的第一本书',
        createdAt: 1000,
        updatedAt: 2000,
        noteCount: 5,
      })
      expect(result[1]).toEqual({
        id: 'book-2',
        name: '学习笔记',
        createdAt: 3000,
        updatedAt: 4000,
        noteCount: 10,
      })
    })

    it('数据库异常时应抛出错误', () => {
      vi.mocked(database.getDB).mockImplementation(() => {
        throw new Error('DB error')
      })

      expect(() => listBooks()).toThrow('获取书列表失败')
    })
  })

  // ==================== getBook ====================
  describe('getBook', () => {
    it('书不存在时应返回 null', () => {
      const mockDb = createMockDB([[]])
      vi.mocked(database.getDB).mockReturnValue(mockDb as never)

      const result = getBook('non-existent-id')
      expect(result).toBeNull()
    })

    it('书存在时应返回正确的 Book 对象', () => {
      const mockDb = createMockDB([
        [
          {
            columns: ['id', 'name', 'created_at', 'updated_at'],
            values: [['book-abc', '测试书籍', 1000, 2000]],
          },
        ],
      ])
      vi.mocked(database.getDB).mockReturnValue(mockDb as never)

      const result = getBook('book-abc')

      expect(result).not.toBeNull()
      expect(result).toEqual({
        id: 'book-abc',
        name: '测试书籍',
        createdAt: 1000,
        updatedAt: 2000,
        noteCount: 0, // getBook 默认 noteCount 为 0
      })
    })

    it('数据库异常时应返回 null（不抛错）', () => {
      vi.mocked(database.getDB).mockImplementation(() => {
        throw new Error('DB error')
      })

      const result = getBook('any-id')
      expect(result).toBeNull()
    })
  })

  // ==================== searchNotes ====================
  describe('searchNotes', () => {
    it('空关键词应返回空数组', () => {
      const result = searchNotes('   ')
      expect(result).toEqual([])
    })

    it('空字符串关键词应返回空数组', () => {
      const result = searchNotes('')
      expect(result).toEqual([])
    })

    it('FTS5 不可用时应降级为 LIKE 搜索', () => {
      vi.mocked(database.isFTS5Available).mockReturnValue(false)

      const mockDb = createMockDB([
        // 第一次 exec: 标题搜索
        [
          {
            columns: ['note_id', 'note_title', 'volume_id', 'volume_name', 'book_id', 'book_name'],
            values: [['note-1', '测试笔记标题', 'vol-1', '默认卷', 'book-1', '我的书']],
          },
        ],
        // 第二次 exec: 内容搜索（获取所有笔记）
        [
          {
            columns: ['note_id', 'note_title', 'volume_id', 'volume_name', 'book_id', 'book_name'],
            values: [['note-2', '另一篇笔记', 'vol-1', '默认卷', 'book-1', '我的书']],
          },
        ],
        // 第三次 exec: FTS snippet（会失败因为 FTS 不可用）
        [],
      ])
      vi.mocked(database.getDB).mockReturnValue(mockDb as never)

      const result = searchNotes('测试')

      // 应该包含标题匹配和内容匹配的结果
      expect(result.length).toBeGreaterThanOrEqual(1)
      // 标题匹配的结果应包含高亮标记
      const titleMatch = result.find(r => r.noteId === 'note-1')
      expect(titleMatch).toBeDefined()
      expect(titleMatch!.snippet).toContain('<mark>')
      expect(titleMatch!.snippet).toContain('</mark>')
    })

    it('应正确应用 bookId 过滤', () => {
      vi.mocked(database.isFTS5Available).mockReturnValue(false)

      const mockDb = createMockDB([
        // 标题搜索结果
        [
          {
            columns: ['note_id', 'note_title', 'volume_id', 'volume_name', 'book_id', 'book_name'],
            values: [['note-1', '过滤测试', 'vol-1', '卷A', 'book-target', '目标书']],
          },
        ],
        // 内容搜索结果
        [
          {
            columns: ['note_id', 'note_title', 'volume_id', 'volume_name', 'book_id', 'book_name'],
            values: [],
          },
        ],
      ])
      vi.mocked(database.getDB).mockReturnValue(mockDb as never)

      const result = searchNotes('过滤', 'book-target')

      // 验证 exec 被调用时传入了 bookId 参数
      expect(mockDb.exec).toHaveBeenCalled()
      // 检查最后一次调用（内容搜索）是否包含 bookId 过滤
      const lastCall = mockDb.exec.mock.calls[mockDb.exec.mock.calls.length - 1]
      const lastSql = lastCall[0] as string
      const lastParams = lastCall[1] as string[]
      expect(lastSql).toContain('n.book_id = ?')
      expect(lastParams).toContain('book-target')
    })

    it('应正确应用 limit 限制', () => {
      vi.mocked(database.isFTS5Available).mockReturnValue(false)

      const mockDb = createMockDB([
        // 标题搜索
        [
          {
            columns: ['note_id', 'note_title', 'volume_id', 'volume_name', 'book_id', 'book_name'],
            values: Array.from({ length: 100 }, (_, i) => [
              `note-${i}`,
              `标题 ${i}`,
              'vol-1',
              '卷A',
              'book-1',
              '我的书',
            ]),
          },
        ],
        // 内容搜索
        [
          {
            columns: ['note_id', 'note_title', 'volume_id', 'volume_name', 'book_id', 'book_name'],
            values: [],
          },
        ],
      ])
      vi.mocked(database.getDB).mockReturnValue(mockDb as never)

      const result = searchNotes('标题', undefined, 10)

      // 结果不应超过 limit
      expect(result.length).toBeLessThanOrEqual(10)
    })

    it('FTS5 可用时应使用 FTS 查询', () => {
      vi.mocked(database.isFTS5Available).mockReturnValue(true)

      const mockDb = createMockDB([
        [
          {
            columns: ['note_id', 'note_title', 'volume_id', 'volume_name', 'book_id', 'book_name', 'snippet'],
            values: [
              ['note-1', 'FTS测试', 'vol-1', '卷A', 'book-1', '我的书', '<mark>FTS</mark>测试内容...'],
            ],
          },
        ],
      ])
      vi.mocked(database.getDB).mockReturnValue(mockDb as never)

      const result = searchNotes('FTS')

      expect(result).toHaveLength(1)
      expect(result[0].noteId).toBe('note-1')
      expect(result[0].snippet).toBe('<mark>FTS</mark>测试内容...')
      // 验证使用了 FTS 查询语法
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('notes_fts MATCH ?'),
        expect.anything()
      )
    })

    it('FTS5 查询失败时应降级为 LIKE 搜索', () => {
      vi.mocked(database.isFTS5Available).mockReturnValue(true)

      let callCount = 0
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockImplementation(() => {
          callCount++
          // 第一次调用（FTS查询）抛错，触发降级
          if (callCount === 1) {
            throw new Error('FTS syntax error')
          }
          // 降级后的 LIKE 搜索
          return [
            {
              columns: ['note_id', 'note_title', 'volume_id', 'volume_name', 'book_id', 'book_name'],
              values: [['note-fallback', '降级结果', 'vol-1', '卷A', 'book-1', '我的书']],
            },
          ]
        }),
        getRowsModified: vi.fn().mockReturnValue(1),
        export: vi.fn(),
        close: vi.fn(),
      }
      vi.mocked(database.getDB).mockReturnValue(mockDb as unknown as ReturnType<typeof database.getDB>)

      const result = searchNotes('特殊字符')

      // 应降级返回 LIKE 搜索结果
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].noteId).toBe('note-fallback')
    })

    it('降级搜索中数据库异常时应返回空数组', () => {
      vi.mocked(database.isFTS5Available).mockReturnValue(false)

      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockImplementation(() => {
          throw new Error('DB crash')
        }),
        getRowsModified: vi.fn().mockReturnValue(1),
        export: vi.fn(),
        close: vi.fn(),
      }
      vi.mocked(database.getDB).mockReturnValue(mockDb as unknown as ReturnType<typeof database.getDB>)

      const result = searchNotes('test')
      expect(result).toEqual([])
    })
  })

  // ==================== listTrash ====================
  describe('listTrash', () => {
    it('回收站为空时应返回空数组', () => {
      const mockDb = createMockDB([[], [], []]) // notes, volumes, books 都为空
      vi.mocked(database.getDB).mockReturnValue(mockDb as never)

      const result = listTrash()
      expect(result).toEqual([])
    })

    it('应正确列出已删除的笔记、卷和书', () => {
      const nowMs = Date.now()
      const retentionMs = 30 * 24 * 60 * 60 * 1000

      // 模拟一个已删除的笔记（updated_at 为负数）
      const deletedNoteTimestamp = nowMs - 1000 * 60 // 1分钟前删除
      // 模拟一个已删除的卷
      const deletedVolTimestamp = nowMs - 1000 * 60 * 10 // 10分钟前删除
      // 模拟一个已删除的书
      const deletedBookTimestamp = nowMs - 1000 * 60 * 60 // 1小时前删除

      const mockDb = createMockDB([
        // 已删除的笔记
        [
          {
            columns: ['id', 'title', 'volume_id', 'book_id', 'updated_at', 'book_name', 'volume_name'],
            values: [
              ['note-del-1', '已删除笔记', 'vol-1', 'book-1', -deletedNoteTimestamp, '我的书', '默认卷'],
            ],
          },
        ],
        // 已删除的卷
        [
          {
            columns: ['id', 'name', 'book_id', 'updated_at', 'book_name'],
            values: [
              ['vol-del-1', '已删除卷', 'book-1', -deletedVolTimestamp, '我的书'],
            ],
          },
        ],
        // 已删除的书
        [
          {
            columns: ['id', 'name', 'created_at', 'updated_at'],
            values: [
              ['book-del-1', '已删除书', 1000, -deletedBookTimestamp],
            ],
          },
        ],
      ])
      vi.mocked(database.getDB).mockReturnValue(mockDb as never)

      const result = listTrash()

      expect(result).toHaveLength(3)

      // 验证笔记条目
      const noteItem = result.find((i: TrashItem) => i.type === 'note')
      expect(noteItem).toBeDefined()
      expect(noteItem!.id).toBe('note-del-1')
      expect(noteItem!.name).toBe('已删除笔记')
      expect(noteItem!.deletedAt).toBe(deletedNoteTimestamp)
      expect(noteItem!.expiresAt).toBe(deletedNoteTimestamp + retentionMs)
      expect(noteItem!.bookId).toBe('book-1')
      expect(noteItem!.volumeId).toBe('vol-1')

      // 验证卷条目
      const volItem = result.find((i: TrashItem) => i.type === 'volume')
      expect(volItem).toBeDefined()
      expect(volItem!.id).toBe('vol-del-1')
      expect(volItem!.name).toBe('已删除卷')

      // 验证书条目
      const bookItem = result.find((i: TrashItem) => i.type === 'book')
      expect(bookItem).toBeDefined()
      expect(bookItem!.id).toBe('book-del-1')
      expect(bookItem!.name).toBe('已删除书')
    })

    it('应过滤掉已过期的回收站条目', () => {
      const nowMs = Date.now()
      // 创建一个 31 天前删除的条目（已过期）
      const expiredTimestamp = nowMs - 31 * 24 * 60 * 60 * 1000

      const mockDb = createMockDB([
        // 已删除的笔记（已过期）
        [
          {
            columns: ['id', 'title', 'volume_id', 'book_id', 'updated_at', 'book_name', 'volume_name'],
            values: [
              ['note-expired', '过期笔记', 'vol-1', 'book-1', -expiredTimestamp, '我的书', '默认卷'],
            ],
          },
        ],
        // 已删除的卷（无）
        [],
        // 已删除的书（无）
        [],
      ])
      vi.mocked(database.getDB).mockReturnValue(mockDb as never)

      const result = listTrash()
      // 过期条目应被过滤
      expect(result).toHaveLength(0)
    })

    it('数据库异常时应抛出错误', () => {
      vi.mocked(database.getDB).mockImplementation(() => {
        throw new Error('DB error')
      })

      expect(() => listTrash()).toThrow('获取回收站列表失败')
    })
  })

  // ==================== cleanExpiredTrash ====================
  describe('cleanExpiredTrash', () => {
    it('没有过期项目时应返回 0', async () => {
      // listTrash 返回空数组（已过滤掉过期项）
      const mockDb = createMockDB([[], [], []])
      vi.mocked(database.getDB).mockReturnValue(mockDb as never)

      // 需要动态 mock listTrash 的行为
      // cleanExpiredTrash 内部调用 listTrash().filter(item => item.expiresAt <= now_)
      // 由于 listTrash 已经过滤了过期项，所以 filter 后也为空
      const result = await cleanExpiredTrash()
      expect(result).toBe(0)
    })

    it('存储未就绪时应抛出错误', async () => {
      vi.mocked(storage.isStorageReady).mockReturnValue(false)

      await expect(cleanExpiredTrash()).rejects.toThrow('存储目录未初始化')
    })

    it('有过期项目时应调用 permanentDelete 并返回清理数量', async () => {
      // cleanExpiredTrash 调用顺序：
      //   1. cleanExpiredTrash 内: const now_ = now()          → 第1次
      //   2. listTrash 内: const now_ = now()                   → 第2次
      // 要让条目通过 listTrash 过滤 (expiresAt > listTrash.now)，
      // 但在 cleanExpiredTrash filter 中被判定过期 (expiresAt <= cleanTrash.now)
      // 所以第1次(now)要返回较晚时间，第2次(now)要返回较早时间

      const baseTime = 1000000000000
      const deletedAt = baseTime - 1000
      const retentionMs = 30 * 24 * 60 * 60 * 1000
      const expiresAt = deletedAt + retentionMs

      let nowCallCount = 0
      vi.spyOn(Date, 'now').mockImplementation(() => {
        nowCallCount++
        if (nowCallCount === 1) {
          // cleanExpiredTrash 内部: 需要 expiresAt <= now_，返回较晚时间
          return expiresAt + 1
        }
        // listTrash 内部: 需要 expiresAt > now_，返回较早时间
        return expiresAt - 1
      })

      const mockDb = createMockDB([
        // listTrash: 已删除的笔记
        [
          {
            columns: ['id', 'title', 'volume_id', 'book_id', 'updated_at', 'book_name', 'volume_name'],
            values: [
              ['note-exp', '过期笔记', 'vol-1', 'book-1', -deletedAt, '我的书', '默认卷'],
            ],
          },
        ],
        // listTrash: 已删除的卷（无）
        [],
        // listTrash: 已删除的书（无）
        [],
        // permanentDelete 内部: 查询笔记
        [
          {
            columns: ['id', 'volume_id', 'book_id'],
            values: [['note-exp', 'vol-1', 'book-1']],
          },
        ],
        // permanentDelete 内部: 查询卷下的笔记（不会执行到这里，因为 type=note）
        [],
      ])
      vi.mocked(database.getDB).mockReturnValue(mockDb as never)

      // mock storage functions for permanentDelete
      vi.mocked(storage.listDirectory).mockResolvedValue([])
      vi.mocked(storage.deleteFile).mockResolvedValue(undefined)

      const result = await cleanExpiredTrash()
      expect(result).toBe(1)

      vi.spyOn(Date, 'now').mockRestore()
    })
  })
})
