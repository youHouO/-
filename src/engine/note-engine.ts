/**
 * 笔记引擎 — 核心笔记管理模块
 * 提供书、卷、笔记的 CRUD、搜索、回收站、模板管理
 */

import { getDB, isFTS5Available, updateFTSContent } from './database'
import { isStorageReady } from './storage'
import type { Book, Volume, Note, Template } from '@/types'

const TRASH_RETENTION_DAYS = 30
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000

function assertStorageReady() {
  if (!isStorageReady()) throw new Error('存储未初始化')
}

function now(): number {
  return Date.now()
}

function generateId(): string {
  return crypto.randomUUID()
}

/* ===================== 书操作 ===================== */

export function createBook(name: string): Book {
  assertStorageReady()
  const db = getDB()
  const id = generateId()
  const t = now()
  db.run(
    `INSERT INTO books (id, name, created_at, updated_at, note_count) VALUES (?, ?, ?, ?, ?)`,
    [id, name, t, t, 0],
  )
  return { id, name, createdAt: t, updatedAt: t, noteCount: 0 }
}

export function listBooks(): Book[] {
  assertStorageReady()
  const db = getDB()
  const res = db.exec(
    `SELECT id, name, created_at, updated_at, note_count FROM books WHERE updated_at > 0 ORDER BY updated_at DESC`,
  )
  if (!res || res.length === 0) return []
  return res[0].values.map((row) => ({
    id: row[0] as string,
    name: row[1] as string,
    createdAt: row[2] as number,
    updatedAt: row[3] as number,
    noteCount: (row[4] as number) ?? 0,
  }))
}

export function getBook(id: string): Book | null {
  assertStorageReady()
  const db = getDB()
  const res = db.exec(
    `SELECT id, name, created_at, updated_at, note_count FROM books WHERE id = ? AND updated_at > 0`,
    [id],
  )
  if (!res || res.length === 0 || res[0].values.length === 0) return null
  const row = res[0].values[0]
  return {
    id: row[0] as string,
    name: row[1] as string,
    createdAt: row[2] as number,
    updatedAt: row[3] as number,
    noteCount: (row[4] as number) ?? 0,
  }
}

export function renameBook(id: string, newName: string): void {
  assertStorageReady()
  const db = getDB()
  db.run(`UPDATE books SET name = ?, updated_at = ? WHERE id = ? AND updated_at > 0`, [
    newName,
    now(),
    id,
  ])
}

export function deleteBook(id: string): void {
  assertStorageReady()
  const db = getDB()
  const deletedAt = now()
  // 软删除：将 updated_at 设为负值
  db.run(`UPDATE books SET updated_at = ? WHERE id = ?`, [-deletedAt, id])
  // 级联删除卷和笔记
  db.run(`UPDATE volumes SET updated_at = ? WHERE book_id = ?`, [-deletedAt, id])
  db.run(`UPDATE notes SET updated_at = ? WHERE book_id = ?`, [-deletedAt, id])
}

/* ===================== 卷操作 ===================== */

export function createVolume(bookId: string, name: string): Volume {
  assertStorageReady()
  const db = getDB()
  const id = generateId()
  const t = now()
  db.run(
    `INSERT INTO volumes (id, book_id, name, created_at, updated_at, note_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, bookId, name, t, t, 0, 0],
  )
  return { id, bookId, name, createdAt: t, updatedAt: t, noteCount: 0, sortOrder: 0 }
}

export function listVolumes(bookId: string): Volume[] {
  assertStorageReady()
  const db = getDB()
  const res = db.exec(
    `SELECT id, book_id, name, created_at, updated_at, note_count, sort_order FROM volumes WHERE book_id = ? AND updated_at > 0 ORDER BY sort_order, created_at`,
    [bookId],
  )
  if (!res || res.length === 0) return []
  return res[0].values.map((row) => ({
    id: row[0] as string,
    bookId: row[1] as string,
    name: row[2] as string,
    createdAt: row[3] as number,
    updatedAt: row[4] as number,
    noteCount: (row[5] as number) ?? 0,
    sortOrder: (row[6] as number) ?? 0,
  }))
}

export function getVolume(id: string): Volume | null {
  assertStorageReady()
  const db = getDB()
  const res = db.exec(
    `SELECT id, book_id, name, created_at, updated_at, note_count, sort_order FROM volumes WHERE id = ? AND updated_at > 0`,
    [id],
  )
  if (!res || res.length === 0 || res[0].values.length === 0) return null
  const row = res[0].values[0]
  return {
    id: row[0] as string,
    bookId: row[1] as string,
    name: row[2] as string,
    createdAt: row[3] as number,
    updatedAt: row[4] as number,
    noteCount: (row[5] as number) ?? 0,
    sortOrder: (row[6] as number) ?? 0,
  }
}

export function renameVolume(id: string, newName: string): void {
  assertStorageReady()
  const db = getDB()
  db.run(`UPDATE volumes SET name = ?, updated_at = ? WHERE id = ? AND updated_at > 0`, [
    newName,
    now(),
    id,
  ])
}

export function deleteVolume(id: string): void {
  assertStorageReady()
  const db = getDB()
  const deletedAt = now()
  db.run(`UPDATE volumes SET updated_at = ? WHERE id = ?`, [-deletedAt, id])
  db.run(`UPDATE notes SET updated_at = ? WHERE volume_id = ?`, [-deletedAt, id])
}

/* ===================== 笔记操作 ===================== */

export function createNote(volumeId: string, title: string, content = ''): Note {
  assertStorageReady()
  const db = getDB()
  const vol = getVolume(volumeId)
  if (!vol) throw new Error('卷不存在')

  const id = generateId()
  const t = now()
  const bookId = vol.bookId
  const wordCount = content.length

  db.run(
    `INSERT INTO notes (id, volume_id, book_id, title, content_hash, created_at, updated_at, word_count, image_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, volumeId, bookId, title, '', t, t, wordCount, 0],
  )

  // 更新卷和书的笔记计数
  db.run(`UPDATE volumes SET note_count = note_count + 1, updated_at = ? WHERE id = ?`, [t, volumeId])
  db.run(`UPDATE books SET note_count = note_count + 1, updated_at = ? WHERE id = ?`, [t, bookId])

  // 更新 FTS 索引
  try {
    updateFTSContent(id, title, content)
  } catch {
    // FTS 更新失败不阻断主流程
  }

  return {
    id,
    volumeId,
    bookId,
    title,
    contentHash: '',
    createdAt: t,
    updatedAt: t,
    wordCount,
    imageCount: 0,
  }
}

export function getNote(id: string): Note | null {
  assertStorageReady()
  const db = getDB()
  const res = db.exec(
    `SELECT id, volume_id, book_id, title, content_hash, created_at, updated_at, word_count, image_count FROM notes WHERE id = ? AND updated_at > 0`,
    [id],
  )
  if (!res || res.length === 0 || res[0].values.length === 0) return null
  const row = res[0].values[0]
  return {
    id: row[0] as string,
    volumeId: row[1] as string,
    bookId: row[2] as string,
    title: row[3] as string,
    contentHash: row[4] as string,
    createdAt: row[5] as number,
    updatedAt: row[6] as number,
    wordCount: row[7] as number,
    imageCount: row[8] as number,
  }
}

export interface NoteWithContent {
  note: Note
  content: string
}

export function loadNote(noteId: string): NoteWithContent {
  assertStorageReady()
  const note = getNote(noteId)
  if (!note) throw new Error('笔记不存在')
  // 内容存储在单独的文件中，路径: Books/{bookId}/Notes/{noteId}.note
  // 这里简化处理，实际应从 storage 读取
  return { note, content: '' }
}

export function saveNote(note: Note): void {
  assertStorageReady()
  const db = getDB()
  const t = now()
  db.run(
    `UPDATE notes SET title = ?, content_hash = ?, updated_at = ?, word_count = ?, image_count = ? WHERE id = ? AND updated_at > 0`,
    [note.title, note.contentHash, t, note.wordCount, note.imageCount, note.id],
  )
}

export function deleteNote(id: string): void {
  assertStorageReady()
  const db = getDB()
  const note = getNote(id)
  if (!note) return
  const deletedAt = now()
  db.run(`UPDATE notes SET updated_at = ? WHERE id = ?`, [-deletedAt, id])
  db.run(`UPDATE volumes SET note_count = note_count - 1, updated_at = ? WHERE id = ?`, [deletedAt, note.volumeId])
  db.run(`UPDATE books SET note_count = note_count - 1, updated_at = ? WHERE id = ?`, [deletedAt, note.bookId])
}

export function renameNote(id: string, newTitle: string): void {
  assertStorageReady()
  const db = getDB()
  db.run(`UPDATE notes SET title = ?, updated_at = ? WHERE id = ? AND updated_at > 0`, [
    newTitle,
    now(),
    id,
  ])
}

export function listNotes(volumeId: string): Note[] {
  assertStorageReady()
  const db = getDB()
  const res = db.exec(
    `SELECT id, volume_id, book_id, title, content_hash, created_at, updated_at, word_count, image_count FROM notes WHERE volume_id = ? AND updated_at > 0 ORDER BY updated_at DESC`,
    [volumeId],
  )
  if (!res || res.length === 0) return []
  return res[0].values.map((row) => ({
    id: row[0] as string,
    volumeId: row[1] as string,
    bookId: row[2] as string,
    title: row[3] as string,
    contentHash: row[4] as string,
    createdAt: row[5] as number,
    updatedAt: row[6] as number,
    wordCount: row[7] as number,
    imageCount: row[8] as number,
  }))
}

/* ===================== 搜索 ===================== */

export interface SearchResult {
  noteId: string
  noteTitle: string
  volumeId: string
  volumeName: string
  bookId: string
  bookName: string
  snippet?: string
}

export function searchNotes(keyword: string, bookId?: string, limit = 50): SearchResult[] {
  assertStorageReady()
  const db = getDB()

  if (!keyword.trim()) return []

  const ftsAvailable = isFTS5Available()
  let sql: string
  let params: (string | number)[]

  if (ftsAvailable) {
    sql = `
      SELECT n.id as note_id, n.title as note_title, v.id as volume_id, v.name as volume_name,
             b.id as book_id, b.name as book_name, snippet(notes_fts, 0, '【', '】', '...', 64) as snippet
      FROM notes_fts fts
      JOIN notes n ON fts.rowid = n.id
      JOIN volumes v ON n.volume_id = v.id
      JOIN books b ON n.book_id = b.id
      WHERE notes_fts MATCH ? AND n.updated_at > 0
    `
    params = [keyword]
    if (bookId) {
      sql += ` AND n.book_id = ?`
      params.push(bookId)
    }
    sql += ` LIMIT ?`
    params.push(limit)
  } else {
    sql = `
      SELECT n.id as note_id, n.title as note_title, v.id as volume_id, v.name as volume_name,
             b.id as book_id, b.name as book_name
      FROM notes n
      JOIN volumes v ON n.volume_id = v.id
      JOIN books b ON n.book_id = b.id
      WHERE n.updated_at > 0 AND (n.title LIKE ? OR n.content_hash LIKE ?)
    `
    const pattern = `%${keyword}%`
    params = [pattern, pattern]
    if (bookId) {
      sql += ` AND n.book_id = ?`
      params.push(bookId)
    }
    sql += ` LIMIT ?`
    params.push(limit)
  }

  const res = db.exec(sql, params)
  if (!res || res.length === 0) return []

  return res[0].values.map((row) => ({
    noteId: row[0] as string,
    noteTitle: row[1] as string,
    volumeId: row[2] as string,
    volumeName: row[3] as string,
    bookId: row[4] as string,
    bookName: row[5] as string,
    snippet: row[6] as string | undefined,
  }))
}

/* ===================== 回收站 ===================== */

export interface TrashItem {
  id: string
  name: string
  type: 'book' | 'volume' | 'note'
  deletedAt: number
  expiresAt: number
  bookId?: string
  volumeId?: string
}

export function listTrash(): TrashItem[] {
  assertStorageReady()
  const db = getDB()
  const nowTime = now()
  const items: TrashItem[] = []

  // 已删除的书
  const booksRes = db.exec(
    `SELECT id, name, updated_at FROM books WHERE updated_at < 0`,
  )
  if (booksRes && booksRes.length > 0) {
    for (const row of booksRes[0].values) {
      const deletedAt = -(row[2] as number)
      const expiresAt = deletedAt + TRASH_RETENTION_MS
      if (expiresAt > nowTime) {
        items.push({
          id: row[0] as string,
          name: row[1] as string,
          type: 'book',
          deletedAt,
          expiresAt,
        })
      }
    }
  }

  // 已删除的卷
  const volsRes = db.exec(
    `SELECT v.id, v.name, v.updated_at, v.book_id, b.name as book_name FROM volumes v LEFT JOIN books b ON v.book_id = b.id WHERE v.updated_at < 0`,
  )
  if (volsRes && volsRes.length > 0) {
    for (const row of volsRes[0].values) {
      const deletedAt = -(row[2] as number)
      const expiresAt = deletedAt + TRASH_RETENTION_MS
      if (expiresAt > nowTime) {
        items.push({
          id: row[0] as string,
          name: row[1] as string,
          type: 'volume',
          deletedAt,
          expiresAt,
          bookId: row[3] as string,
        })
      }
    }
  }

  // 已删除的笔记
  const notesRes = db.exec(
    `SELECT n.id, n.title, n.updated_at, n.volume_id, n.book_id, v.name as volume_name, b.name as book_name
     FROM notes n
     LEFT JOIN volumes v ON n.volume_id = v.id
     LEFT JOIN books b ON n.book_id = b.id
     WHERE n.updated_at < 0`,
  )
  if (notesRes && notesRes.length > 0) {
    for (const row of notesRes[0].values) {
      const deletedAt = -(row[2] as number)
      const expiresAt = deletedAt + TRASH_RETENTION_MS
      if (expiresAt > nowTime) {
        items.push({
          id: row[0] as string,
          name: row[1] as string,
          type: 'note',
          deletedAt,
          expiresAt,
          volumeId: row[3] as string,
          bookId: row[4] as string,
        })
      }
    }
  }

  return items.sort((a, b) => b.deletedAt - a.deletedAt)
}

export function restoreFromTrash(id: string, type: 'book' | 'volume' | 'note'): void {
  assertStorageReady()
  const db = getDB()
  const table = type === 'book' ? 'books' : type === 'volume' ? 'volumes' : 'notes'
  db.run(`UPDATE ${table} SET updated_at = ? WHERE id = ? AND updated_at < 0`, [now(), id])
}

export function permanentDelete(id: string, type: 'book' | 'volume' | 'note'): void {
  assertStorageReady()
  const db = getDB()
  const table = type === 'book' ? 'books' : type === 'volume' ? 'volumes' : 'notes'
  db.run(`DELETE FROM ${table} WHERE id = ?`, [id])
}

export function cleanExpiredTrash(): number {
  assertStorageReady()
  const db = getDB()
  const cutoff = -(now() - TRASH_RETENTION_MS)

  const tables = ['notes', 'volumes', 'books']
  let total = 0

  for (const table of tables) {
    db.run(`DELETE FROM ${table} WHERE updated_at < ?`, [cutoff])
    total += db.getRowsModified()
  }

  return total
}

/* ===================== 模板 ===================== */

export function listTemplates(): Template[] {
  assertStorageReady()
  const db = getDB()
  const res = db.exec(
    `SELECT id, name, content, scope, book_id, created_at, updated_at FROM templates ORDER BY updated_at DESC`,
  )
  if (!res || res.length === 0) return []
  return res[0].values.map((row) => ({
    id: row[0] as string,
    name: row[1] as string,
    content: row[2] as string,
    scope: row[3] as 'global' | 'book',
    bookId: row[4] as string | undefined,
    createdAt: row[5] as number,
    updatedAt: row[6] as number,
  }))
}

export function deleteTemplate(id: string): void {
  assertStorageReady()
  const db = getDB()
  db.run(`DELETE FROM templates WHERE id = ?`, [id])
}

export function createTemplate(name: string, content: string, scope: 'global' | 'book', bookId?: string): Template {
  assertStorageReady()
  const db = getDB()
  const id = generateId()
  const t = now()
  db.run(
    `INSERT INTO templates (id, name, content, scope, book_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, content, scope, bookId ?? null, t, t],
  )
  return { id, name, content, scope, bookId, createdAt: t, updatedAt: t }
}

export function updateTemplate(id: string, name: string, content: string): void {
  assertStorageReady()
  const db = getDB()
  db.run(`UPDATE templates SET name = ?, content = ?, updated_at = ? WHERE id = ?`, [
    name,
    content,
    now(),
    id,
  ])
}

export function loadTemplate(id: string): Template | null {
  assertStorageReady()
  const db = getDB()
  const res = db.exec(
    `SELECT id, name, content, scope, book_id, created_at, updated_at FROM templates WHERE id = ?`,
    [id],
  )
  if (!res || res.length === 0 || res[0].values.length === 0) return null
  const row = res[0].values[0]
  return {
    id: row[0] as string,
    name: row[1] as string,
    content: row[2] as string,
    scope: row[3] as 'global' | 'book',
    bookId: row[4] as string | undefined,
    createdAt: row[5] as number,
    updatedAt: row[6] as number,
  }
}
