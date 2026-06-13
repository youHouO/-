/**
 * 笔记引擎 — 核心笔记管理模块
 * 提供书、卷、笔记的 CRUD、搜索、回收站、模板管理
 */

import { getDB, isFTS5Available, updateFTSContent } from './database'
import { isStorageReady, moveFile, deleteFile, fileExists, readFile, writeFile } from './storage'
import { sha256, encryptString, decryptToString } from './encryption'
import type { Book, Volume, Note, Template } from '@/types'

const TRASH_RETENTION_DAYS = 30
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000

/** 是否启用笔记内容加密 */
let encryptionEnabled = false

/** 设置加密开关 */
export function setEncryptionEnabled(enabled: boolean): void {
  encryptionEnabled = enabled
}

/** 获取加密状态 */
export function isEncryptionEnabled(): boolean {
  return encryptionEnabled
}

function assertStorageReady() {
  if (!isStorageReady()) throw new Error('存储未初始化')
}

function now(): number {
  return Date.now()
}

function generateId(): string {
  return crypto.randomUUID()
}

async function computeContentHash(content: string): Promise<string> {
  try {
    return await sha256(content)
  } catch {
    return ''
  }
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

export type SortBy = 'updatedAt' | 'createdAt'

export function listBooks(sortBy: SortBy = 'updatedAt'): Book[] {
  assertStorageReady()
  const db = getDB()
  const orderColumn = sortBy === 'createdAt' ? 'created_at' : 'updated_at'
  const res = db.exec(
    `SELECT id, name, created_at, updated_at, note_count FROM books WHERE updated_at > 0 ORDER BY ${orderColumn} DESC`,
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

  // 1. 记录到 trash 表
  db.run(
    `INSERT OR REPLACE INTO trash (id, type, name, parent_id, deleted_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, 'book', getBook(id)?.name ?? '', null, deletedAt, deletedAt + TRASH_RETENTION_MS],
  )

  // 2. 移动书目录到 .trash
  const srcPath = `Books/${id}`
  const destPath = `Books/.trash/${id}_${deletedAt}`
  try {
    moveFile(srcPath, destPath)
  } catch {
    // 目录移动失败不阻断，数据库记录已存在
  }

  // 3. 级联删除卷和笔记（同样记录到 trash）
  const vols = listVolumes(id)
  for (const vol of vols) {
    db.run(
      `INSERT OR REPLACE INTO trash (id, type, name, parent_id, deleted_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [vol.id, 'volume', vol.name, id, deletedAt, deletedAt + TRASH_RETENTION_MS],
    )
    const notes = listNotes(vol.id)
    for (const note of notes) {
      db.run(
        `INSERT OR REPLACE INTO trash (id, type, name, parent_id, deleted_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [note.id, 'note', note.title, vol.id, deletedAt, deletedAt + TRASH_RETENTION_MS],
      )
    }
  }

  // 4. 从数据库中物理删除（文件已在 .trash 中）
  db.run(`DELETE FROM notes WHERE book_id = ?`, [id])
  db.run(`DELETE FROM volumes WHERE book_id = ?`, [id])
  db.run(`DELETE FROM books WHERE id = ?`, [id])
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

export function listVolumes(bookId: string, sortBy: SortBy = 'updatedAt'): Volume[] {
  assertStorageReady()
  const db = getDB()
  const orderColumn = sortBy === 'createdAt' ? 'created_at' : 'updated_at'
  const res = db.exec(
    `SELECT id, book_id, name, created_at, updated_at, note_count, sort_order FROM volumes WHERE book_id = ? AND updated_at > 0 ORDER BY ${orderColumn} DESC`,
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
  const vol = getVolume(id)
  if (!vol) return
  const deletedAt = now()

  // 1. 记录到 trash 表
  db.run(
    `INSERT OR REPLACE INTO trash (id, type, name, parent_id, deleted_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, 'volume', vol.name, vol.bookId, deletedAt, deletedAt + TRASH_RETENTION_MS],
  )

  // 2. 级联删除笔记
  const notes = listNotes(id)
  for (const note of notes) {
    db.run(
      `INSERT OR REPLACE INTO trash (id, type, name, parent_id, deleted_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [note.id, 'note', note.title, id, deletedAt, deletedAt + TRASH_RETENTION_MS],
    )
  }

  // 3. 从数据库中物理删除
  db.run(`DELETE FROM notes WHERE volume_id = ?`, [id])
  db.run(`DELETE FROM volumes WHERE id = ?`, [id])
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

export async function loadNote(noteId: string): Promise<NoteWithContent> {
  assertStorageReady()
  const note = getNote(noteId)
  if (!note) throw new Error('笔记不存在')

  // 从 storage 读取笔记内容文件
  const contentPath = `Books/${note.bookId}/Notes/${noteId}.note`
  let content = ''
  try {
    const data = await readFile(contentPath)
    if (data) {
      // 检查是否为加密内容
      if (note.contentHash.startsWith('[ENC]')) {
        try {
          content = decryptToString(data)
        } catch {
          console.warn(`笔记 ${noteId} 解密失败，返回空内容`)
          content = ''
        }
      } else {
        content = new TextDecoder().decode(data)
      }
    }
  } catch {
    // 文件不存在时 content 为空字符串
  }

  return { note, content }
}

export async function saveNote(note: Note, content: string): Promise<void> {
  assertStorageReady()
  const db = getDB()
  const t = now()

  // 计算内容哈希和字数
  let contentHash = await computeContentHash(content)
  const wordCount = content.length

  // 统计图片数量（简单的 ![](...) 正则匹配）
  const imageCount = (content.match(/!\[.*?\]\(.*?\)/g) || []).length

  // 写入内容文件到 storage
  const contentPath = `Books/${note.bookId}/Notes/${note.id}.note`
  if (encryptionEnabled) {
    // 加密模式：加密内容后写入 Uint8Array，并在 content_hash 前加 [ENC] 前缀
    const encryptedData = encryptString(content)
    await writeFile(contentPath, encryptedData)
    contentHash = `[ENC]${contentHash}`
  } else {
    await writeFile(contentPath, content)
  }

  // 更新数据库元数据
  db.run(
    `UPDATE notes SET title = ?, content_hash = ?, updated_at = ?, word_count = ?, image_count = ? WHERE id = ? AND updated_at > 0`,
    [note.title, contentHash, t, wordCount, imageCount, note.id],
  )

  // 更新 FTS 索引（始终使用明文内容，加密后无法搜索）
  try {
    updateFTSContent(note.id, note.title, content)
  } catch {
    // FTS 更新失败不阻断主流程
  }
}

export function deleteNote(id: string): void {
  assertStorageReady()
  const db = getDB()
  const note = getNote(id)
  if (!note) return
  const deletedAt = now()

  // 1. 记录到 trash 表
  db.run(
    `INSERT OR REPLACE INTO trash (id, type, name, parent_id, deleted_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, 'note', note.title, note.volumeId, deletedAt, deletedAt + TRASH_RETENTION_MS],
  )

  // 2. 移动笔记文件到 .trash
  const srcPath = `Books/${note.bookId}/Notes/${id}.note`
  const destPath = `Books/.trash/${id}_${deletedAt}.note`
  try {
    moveFile(srcPath, destPath)
  } catch {
    // 文件移动失败不阻断
  }

  // 3. 更新计数并物理删除
  db.run(`UPDATE volumes SET note_count = note_count - 1, updated_at = ? WHERE id = ?`, [deletedAt, note.volumeId])
  db.run(`UPDATE books SET note_count = note_count - 1, updated_at = ? WHERE id = ?`, [deletedAt, note.bookId])
  db.run(`DELETE FROM notes WHERE id = ?`, [id])
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

export function listNotes(volumeId: string, sortBy: SortBy = 'updatedAt'): Note[] {
  assertStorageReady()
  const db = getDB()
  const orderColumn = sortBy === 'createdAt' ? 'created_at' : 'updated_at'
  const res = db.exec(
    `SELECT id, volume_id, book_id, title, content_hash, created_at, updated_at, word_count, image_count FROM notes WHERE volume_id = ? AND updated_at > 0 ORDER BY ${orderColumn} DESC`,
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

  const res = db.exec(
    `SELECT id, type, name, parent_id, deleted_at, expires_at FROM trash WHERE expires_at > ? ORDER BY deleted_at DESC`,
    [nowTime],
  )
  if (!res || res.length === 0) return []

  return res[0].values.map((row) => {
    const type = row[1] as 'book' | 'volume' | 'note'
    return {
      id: row[0] as string,
      name: row[2] as string,
      type,
      deletedAt: row[4] as number,
      expiresAt: row[5] as number,
      bookId: type === 'book' ? undefined : (row[3] as string),
      volumeId: type === 'note' ? (row[3] as string) : undefined,
    }
  })
}

export function restoreFromTrash(id: string, type: 'book' | 'volume' | 'note'): void {
  assertStorageReady()
  const db = getDB()

  // 1. 从 trash 表读取元数据
  const trashRes = db.exec(`SELECT name, parent_id, deleted_at FROM trash WHERE id = ? AND type = ?`, [id, type])
  if (!trashRes || trashRes.length === 0 || trashRes[0].values.length === 0) {
    throw new Error('回收站中不存在该项目')
  }
  const row = trashRes[0].values[0]
  const name = row[0] as string
  const parentId = row[1] as string | null
  const deletedAt = row[2] as number

  // 2. 从 .trash 移回文件
  const trashPath = type === 'book'
    ? `Books/.trash/${id}_${deletedAt}`
    : `Books/.trash/${id}_${deletedAt}.note`

  try {
    if (type === 'book') {
      const destPath = `Books/${id}`
      moveFile(trashPath, destPath)
    } else {
      // 笔记文件恢复到原卷目录
      const destPath = `Books/_restored/${id}.note`
      moveFile(trashPath, destPath)
    }
  } catch {
    // 文件移动失败不阻断恢复
  }

  // 3. 从 trash 表删除记录
  db.run(`DELETE FROM trash WHERE id = ?`, [id])

  // 4. 重新创建数据库记录
  const t = now()
  if (type === 'book') {
    db.run(
      `INSERT INTO books (id, name, created_at, updated_at, note_count) VALUES (?, ?, ?, ?, ?)`,
      [id, name, t, t, 0],
    )
  } else if (type === 'volume') {
    db.run(
      `INSERT INTO volumes (id, book_id, name, created_at, updated_at, note_count, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, parentId ?? '', name, t, t, 0, 0],
    )
  } else {
    const bookId = parentId ?? ''
    db.run(
      `INSERT INTO notes (id, volume_id, book_id, title, content_hash, created_at, updated_at, word_count, image_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, '', bookId, name, '', t, t, 0, 0],
    )
  }
}

export function permanentDelete(id: string, type: 'book' | 'volume' | 'note'): void {
  assertStorageReady()
  const db = getDB()

  // 1. 从 trash 表读取信息
  const trashRes = db.exec(`SELECT deleted_at FROM trash WHERE id = ? AND type = ?`, [id, type])
  const deletedAt = trashRes && trashRes.length > 0 ? (trashRes[0].values[0][0] as number) : now()

  // 2. 删除 .trash 中的文件
  const trashPath = `Books/.trash/${id}_${deletedAt}`
  try {
    deleteFile(`${trashPath}.note`)
  } catch {
    // 文件可能不存在
  }

  // 3. 从 trash 表删除记录
  db.run(`DELETE FROM trash WHERE id = ?`, [id])
}

export function cleanExpiredTrash(): number {
  assertStorageReady()
  const db = getDB()
  const nowTime = now()

  // 1. 查询过期项目
  const expiredRes = db.exec(
    `SELECT id, type, deleted_at FROM trash WHERE expires_at <= ?`,
    [nowTime],
  )
  if (!expiredRes || expiredRes.length === 0) return 0

  let total = 0
  for (const row of expiredRes[0].values) {
    const id = row[0] as string
    const type = row[1] as 'book' | 'volume' | 'note'
    const deletedAt = row[2] as number

    // 删除 .trash 中的文件
    const trashPath = `Books/.trash/${id}_${deletedAt}`
    try {
      deleteFile(`${trashPath}.note`)
    } catch {
      // 忽略
    }

    // 从 trash 表删除
    db.run(`DELETE FROM trash WHERE id = ?`, [id])
    total++
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
