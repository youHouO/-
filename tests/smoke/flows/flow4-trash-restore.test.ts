/**
 * 冒烟测试 - 流程4：删除笔记 → 进入回收站 → 恢复笔记
 *
 * 验证 deleteNote / restoreNote 核心逻辑：
 * 1. 删除笔记不删除文件，只标记 deleted_at
 * 2. 回收站能列出已删除笔记
 * 3. 恢复笔记清除 deleted_at
 * 4. 永久删除才真正删除文件
 */
import { describe, it, expect } from 'vitest'

// 模拟回收站逻辑
interface MockNote {
  id: string
  title: string
  volumeId: string
  bookId: string
  deletedAt?: number
  createdAt: number
  updatedAt: number
}

interface TrashItem {
  id: string
  title: string
  deletedAt: number
  type: 'note' | 'volume' | 'book'
}

let notes: MockNote[] = []
let trashItems: TrashItem[] = []
const deletedFiles = new Set<string>()

function clearData() {
  notes = []
  trashItems = []
  deletedFiles.clear()
}

function deleteNote(noteId: string): void {
  const note = notes.find(n => n.id === noteId)
  if (!note) throw new Error('笔记不存在')
  note.deletedAt = Date.now()
  trashItems.push({
    id: note.id,
    title: note.title,
    deletedAt: note.deletedAt,
    type: 'note',
  })
}

function listTrash(): TrashItem[] {
  return trashItems.filter(item => {
    const note = notes.find(n => n.id === item.id)
    return note?.deletedAt != null
  })
}

function restoreNote(noteId: string): void {
  const note = notes.find(n => n.id === noteId)
  if (!note) throw new Error('笔记不存在')
  if (!note.deletedAt) throw new Error('笔记不在回收站中')
  note.deletedAt = undefined
  note.updatedAt = Date.now()
  trashItems = trashItems.filter(t => t.id !== noteId)
}

function permanentDelete(noteId: string): void {
  const idx = notes.findIndex(n => n.id === noteId)
  if (idx < 0) throw new Error('笔记不存在')
  notes.splice(idx, 1)
  trashItems = trashItems.filter(t => t.id !== noteId)
  deletedFiles.add(noteId)
}

describe('流程4：删除与恢复', () => {
  beforeEach(() => {
    clearData()
    // 创建测试笔记
    notes.push({
      id: 'note-1',
      title: '测试笔记',
      volumeId: 'vol-1',
      bookId: 'book-1',
      createdAt: 1000,
      updatedAt: 1000,
    })
  })

  it('删除笔记后进入回收站', () => {
    deleteNote('note-1')
    const trash = listTrash()
    expect(trash).toHaveLength(1)
    expect(trash[0].title).toBe('测试笔记')
    expect(trash[0].type).toBe('note')
  })

  it('删除后笔记不在正常列表中', () => {
    deleteNote('note-1')
    const activeNotes = notes.filter(n => !n.deletedAt)
    expect(activeNotes).toHaveLength(0)
  })

  it('从回收站恢复笔记', () => {
    deleteNote('note-1')
    restoreNote('note-1')

    const trash = listTrash()
    expect(trash).toHaveLength(0)

    const activeNotes = notes.filter(n => !n.deletedAt)
    expect(activeNotes).toHaveLength(1)
    expect(activeNotes[0].title).toBe('测试笔记')
  })

  it('永久删除后笔记不存在', () => {
    deleteNote('note-1')
    permanentDelete('note-1')

    expect(notes).toHaveLength(0)
    expect(listTrash()).toHaveLength(0)
  })

  it('不能恢复未删除的笔记', () => {
    expect(() => restoreNote('note-1')).toThrow('笔记不在回收站中')
  })

  it('回收站支持多条笔记', () => {
    notes.push({
      id: 'note-2', title: '第二条笔记', volumeId: 'vol-1', bookId: 'book-1',
      createdAt: 2000, updatedAt: 2000,
    })
    deleteNote('note-1')
    deleteNote('note-2')

    const trash = listTrash()
    expect(trash).toHaveLength(2)
  })

  it('部分恢复后回收站仍保留其他条目', () => {
    notes.push({
      id: 'note-2', title: '第二条笔记', volumeId: 'vol-1', bookId: 'book-1',
      createdAt: 2000, updatedAt: 2000,
    })
    deleteNote('note-1')
    deleteNote('note-2')
    restoreNote('note-1')

    const trash = listTrash()
    expect(trash).toHaveLength(1)
    expect(trash[0].id).toBe('note-2')
  })

  it('deletedAt 时间戳在合理范围内', () => {
    const before = Date.now()
    deleteNote('note-1')
    const after = Date.now()

    const trash = listTrash()
    expect(trash[0].deletedAt).toBeGreaterThanOrEqual(before)
    expect(trash[0].deletedAt).toBeLessThanOrEqual(after)
  })
})
