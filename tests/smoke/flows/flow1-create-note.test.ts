/**
 * 冒烟测试 - 流程1：首次启动 → 新建书 → 新建卷 → 新建笔记 → 编辑内容 → 自动保存
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock sql.js 模块
vi.mock('sql.js', () => {
  const tables = new Map<string, Array<Record<string, any>>>()
  let dbInstance: any = null

  const createDB = () => ({
    run: (sql: string, params?: any[]) => {
      if (/create\s+table\s+if\s+not\s+exists/i.test(sql)) {
        const match = sql.match(/create\s+table\s+if\s+not\s+exists\s+(\w+)/i)
        if (match && !tables.has(match[1])) tables.set(match[1], [])
      }
      if (/insert\s+into/i.test(sql)) {
        const match = sql.match(/insert\s+into\s+(\w+)/i)
        if (match && tables.has(match[1]) && params) {
          const row: Record<string, any> = {}
          const colsMatch = sql.match(/\(([^)]+)\)\s*values/i)
          if (colsMatch) {
            const cols = colsMatch[1].split(',').map(c => c.trim())
            cols.forEach((c, i) => { row[c] = params[i] ?? null })
          }
          tables.get(match[1])!.push(row)
        }
        return { lastInsertRowid: BigInt(tables.get(match[1])?.length ?? 1) }
      }
      if (/update/i.test(sql)) {
        const match = sql.match(/update\s+(\w+)/i)
        if (match && tables.has(match[1]) && params) {
          const data = tables.get(match[1])!
          const setMatch = sql.match(/set\s+(.+?)\s+where/i)
          const whereMatch = sql.match(/where\s+(.+)/i)
          if (setMatch && whereMatch) {
            const setPairs = setMatch[1].split(',').map(s => s.trim().split(/\s*=\s*\?/))
            const whereCol = whereMatch[1].split(/\s*=\s*\?/)[0].trim()
            for (const row of data) {
              if (row[whereCol] === params[setPairs.length]) {
                setPairs.forEach(([col], i) => { row[col] = params[i] })
              }
            }
          }
        }
      }
      return {}
    },
    exec: (sql: string, params?: any[]) => {
      if (/select/i.test(sql)) {
        if (/last_insert_rowid/i.test(sql)) {
          return [{ columns: ['last_insert_rowid()'], values: [[tables.get('notes')?.length ?? 1]] }]
        }
        const fromMatch = sql.match(/from\s+(\w+)/i)
        if (fromMatch && tables.has(fromMatch[1])) {
          let data = [...tables.get(fromMatch[1])!]
          // 简单 WHERE 过滤
          const whereMatch = sql.match(/where\s+(\w+)\s*=\s*\?/i)
          if (whereMatch && params) {
            const col = whereMatch[1]
            const val = params[0]
            data = data.filter(row => row[col] === val)
          }
          // 过滤 deleted
          const deletedMatch = sql.match(/where\s+(\w+)\s*>\s*0/i)
          if (deletedMatch) {
            data = data.filter(row => (row[deletedMatch[1]] ?? 0) > 0)
          }
          const cols = data.length > 0 ? Object.keys(data[0]) : []
          const values = data.map(row => cols.map(c => row[c]))
          return [{ columns: cols, values }]
        }
        return []
      }
      if (/delete/i.test(sql)) {
        const match = sql.match(/delete\s+from\s+(\w+)\s+where\s+(\w+)\s*=\s*\?/i)
        if (match && tables.has(match[1]) && params) {
          const col = match[2]
          const val = params[0]
          const data = tables.get(match[1])!
          const idx = data.findIndex(row => row[col] === val)
          if (idx >= 0) data.splice(idx, 1)
        }
      }
      return []
    },
    close: () => { dbInstance = null },
    export: () => new Uint8Array(),
  })

  return {
    default: vi.fn(() => ({
      Database: class {
        constructor(_data?: Uint8Array) {
          tables.clear()
          dbInstance = createDB()
        }
        run(sql: string, params?: any[]) { return dbInstance!.run(sql, params) }
        exec(sql: string, params?: any[]) { return dbInstance!.exec(sql, params) }
        close() { dbInstance = null; tables.clear() }
        export() { return new Uint8Array() }
      },
    })),
  }
})

// Mock OPFS 存储
const mockFS = new Map<string, Uint8Array>()
vi.mock('@/engine/storage', () => ({
  initStorage: vi.fn(async () => {}),
  isStorageReady: vi.fn(() => true),
  readFile: vi.fn(async (path: string) => mockFS.get(path) ?? null),
  writeFile: vi.fn(async (path: string, data: Uint8Array) => { mockFS.set(path, data) }),
  deleteFile: vi.fn(async (path: string) => { mockFS.delete(path) }),
  listFiles: vi.fn(async (_dir: string) => []),
  createDirectory: vi.fn(async (_dir: string) => {}),
  requestStorageDirectory: vi.fn(),
}))

import { createBook, listBooks, createVolume, listVolumes, createNote, listNotes } from '@/engine/note-engine'
import { initStorage } from '@/engine/storage'
import { initDatabase } from '@/engine/database'

describe('流程1：创建笔记全链路', () => {
  beforeEach(async () => {
    mockFS.clear()
    // 初始化存储和数据库
    await initStorage()
    await initDatabase(
      async (path) => { try { return mockFS.get(path) ?? null } catch { return null } },
      async (path, data) => { mockFS.set(path, data) }
    )
  })

  it('应能创建书', async () => {
    await createBook('测试书')
    const books = listBooks()
    expect(books).toHaveLength(1)
    expect(books[0].name).toBe('测试书')
    expect(books[0].id).toBeTruthy()
  })

  it('应能创建卷', async () => {
    const book = await createBook('测试书')
    await createVolume(book.id, '测试卷')
    const volumes = listVolumes(book.id)
    expect(volumes).toHaveLength(1)
    expect(volumes[0].name).toBe('测试卷')
  })

  it('应能创建笔记', async () => {
    const book = await createBook('测试书')
    const volume = await createVolume(book.id, '测试卷')
    const note = await createNote(volume.id, book.id, '测试笔记', '# Hello World')

    const notes = listNotes(volume.id)
    expect(notes).toHaveLength(1)
    expect(notes[0].title).toBe('测试笔记')
    expect(note.wordCount).toBeGreaterThan(0)
  })

  it('完整流程：书 → 卷 → 笔记', async () => {
    // Step 1: 创建书
    const book = await createBook('工作笔记')
    expect(book.name).toBe('工作笔记')

    // Step 2: 创建卷
    const volume = await createVolume(book.id, '项目文档')
    expect(volume.name).toBe('项目文档')

    // Step 3: 创建笔记
    const note = await createNote(volume.id, book.id, '会议纪要', '# 会议纪要\n\n- 时间：2024-01-01\n- 议题：项目进度')
    expect(note.title).toBe('会议纪要')

    // Step 4: 验证数据层级
    const books = listBooks()
    expect(books).toHaveLength(1)

    const volumes = listVolumes(book.id)
    expect(volumes).toHaveLength(1)

    const notes = listNotes(volume.id)
    expect(notes).toHaveLength(1)
    expect(notes[0].title).toBe('会议纪要')

    // Step 5: 验证笔记文件已写入
    const notePath = `Books/${book.id}/Notes/${note.id}.note`
    const fileData = mockFS.get(notePath)
    expect(fileData).toBeDefined()
    expect(fileData!.length).toBeGreaterThan(0)
  })

  it('笔记默认标题为"无标题笔记"', async () => {
    const book = await createBook('测试书')
    const volume = await createVolume(book.id, '测试卷')
    const note = await createNote(volume.id, book.id)
    expect(note.title).toBe('无标题笔记')
  })

  it('笔记字数统计正确', async () => {
    const book = await createBook('测试书')
    const volume = await createVolume(book.id, '测试卷')
    const content = '这是一段测试文字，包含标点符号。'
    // wordCount = content.replace(/\s/g, '').length
    const note = await createNote(volume.id, book.id, '字数测试', content)
    const expectedCount = content.replace(/\s/g, '').length
    expect(note.wordCount).toBe(expectedCount)
  })
})
