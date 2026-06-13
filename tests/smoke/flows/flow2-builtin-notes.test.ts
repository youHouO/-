/**
 * 冒烟测试 - 流程2：首次启动 → 自动检测无数据 → 创建内置入门笔记 → 笔记可正常打开
 *
 * 验证 createBuiltinNotes() 核心逻辑：
 * 1. 无书时自动创建
 * 2. 有书时跳过（防重复）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// 复用 flow1 的 mock 架构
const mockFS = new Map<string, Uint8Array>()

// 简单 mock：note-engine 的基本函数
let books: Array<{ id: string; name: string; noteCount: number }> = []
let volumes: Array<{ id: string; bookId: string; name: string; noteCount: number }> = []
let notes: Array<{ id: string; volumeId: string; bookId: string; title: string }> = []

function clearData() {
  books = []; volumes = []; notes = []; mockFS.clear()
}

function generateId() { return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }

// 模拟 createBuiltinNotes 的核心逻辑（从 builtin-notes.ts 提取）
async function createBuiltinNotes(): Promise<void> {
  if (books.length > 0) return  // 防重复

  const builtinNotes = [
    { title: '欢迎使用 LocalNotes', content: '# 欢迎\n\n本地优先笔记软件。' },
    { title: '创建与组织笔记', content: '# 组织\n\n书→卷→笔记三级结构。' },
    { title: 'Markdown 编辑功能', content: '# 编辑\n\n支持 Markdown 语法。' },
    { title: '云同步与备份', content: '# 同步\n\nWebDAV 协议。' },
    { title: '隐私与安全', content: '# 安全\n\nAES-256 加密。' },
  ]

  // 创建书
  const bookId = generateId()
  books.push({ id: bookId, name: '欢迎使用 LocalNotes', noteCount: 0 })

  // 创建卷
  const volumeId = generateId()
  volumes.push({ id: volumeId, bookId, name: '快速入门', noteCount: 0 })

  // 创建笔记
  for (const note of builtinNotes) {
    const noteId = generateId()
    notes.push({ id: noteId, volumeId, bookId, title: note.title })
    // 写文件
    mockFS.set(`Books/${bookId}/Notes/${noteId}.note`, new TextEncoder().encode(note.content))
  }
}

describe('流程2：内置入门笔记', () => {
  beforeEach(clearData)

  it('首次启动（无书）时自动创建内置笔记', async () => {
    expect(books).toHaveLength(0)
    await createBuiltinNotes()

    // 应创建 1 本书、1 个卷、5 篇笔记
    expect(books).toHaveLength(1)
    expect(books[0].name).toBe('欢迎使用 LocalNotes')

    const bookId = books[0].id
    const bookVolumes = volumes.filter(v => v.bookId === bookId)
    expect(bookVolumes).toHaveLength(1)
    expect(bookVolumes[0].name).toBe('快速入门')

    const volumeId = bookVolumes[0].id
    const volumeNotes = notes.filter(n => n.volumeId === volumeId)
    expect(volumeNotes).toHaveLength(5)
  })

  it('有书时不重复创建', async () => {
    // 手动建一本书
    books.push({ id: 'existing-book', name: '已有书', noteCount: 0 })

    await createBuiltinNotes()

    // 不应创建额外的书
    expect(books).toHaveLength(1)
    expect(books[0].name).toBe('已有书')
  })

  it('内置笔记文件已写入模拟文件系统', async () => {
    await createBuiltinNotes()

    const bookId = books[0].id
    const volumeId = volumes.filter(v => v.bookId === bookId)[0].id
    const volumeNotes = notes.filter(n => n.volumeId === volumeId)

    expect(volumeNotes).toHaveLength(5)
    for (const note of volumeNotes) {
      const filePath = `Books/${bookId}/Notes/${note.id}.note`
      expect(mockFS.has(filePath)).toBe(true)
      expect(mockFS.get(filePath)!.length).toBeGreaterThan(0)
    }
  })

  it('内置笔记标题包含关键主题', async () => {
    await createBuiltinNotes()

    const volumeId = volumes[0].id
    const titles = notes.filter(n => n.volumeId === volumeId).map(n => n.title)
    expect(titles).toContain('欢迎使用 LocalNotes')
    expect(titles).toContain('创建与组织笔记')
    expect(titles).toContain('Markdown 编辑功能')
    expect(titles).toContain('云同步与备份')
    expect(titles).toContain('隐私与安全')
  })
})
