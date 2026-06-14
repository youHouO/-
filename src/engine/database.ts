/**
 * SQLite 数据库封装模块
 * 基于 sql.js (SQLite WASM) 实现，支持持久化到文件系统存储
 */

import initSqlJs from 'sql.js'
import { DB_FILE_PATH } from '@/config'

// ============================================================
// 类型声明（sql.js 未自带 TypeScript 类型）
// ============================================================

/** sql.js 查询结果条目 */
interface QueryResult {
  columns: string[]
  values: unknown[][]
}

/** sql.js Database 实例接口 */
export interface Database {
  run(sql: string, params?: unknown[]): Database
  exec(sql: string, params?: unknown[]): QueryResult[]
  getRowsModified(): number
  export(): Uint8Array
  close(): void
}

/** sql.js 初始化后的模块对象 */
interface SqlJsModule {
  Database: new (data?: Uint8Array) => Database
}

// ============================================================
// 建表 SQL
// ============================================================

/** 基础建表 SQL（不含 FTS5） */
const BASE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  note_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS volumes (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  volume_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_hash TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  image_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  note_id TEXT,
  local_path TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0,
  synced_at INTEGER,
  created_at INTEGER NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT 'global',
  book_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS search_history (
  id TEXT PRIMARY KEY,
  keyword TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trash (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('book', 'volume', 'note')),
  name TEXT NOT NULL,
  parent_id TEXT,
  deleted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_volumes_book_id ON volumes(book_id);
CREATE INDEX IF NOT EXISTS idx_notes_volume_id ON notes(volume_id);
CREATE INDEX IF NOT EXISTS idx_notes_book_id ON notes(book_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_book_id ON images(book_id);
CREATE INDEX IF NOT EXISTS idx_images_note_id ON images(note_id);
CREATE INDEX IF NOT EXISTS idx_trash_expires_at ON trash(expires_at);
`

/** FTS5 虚拟表建表 SQL */
const FTS5_SCHEMA_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  note_id UNINDEXED,
  title,
  content,
  tokenize = 'porter unicode61'
);
`

// ============================================================
// 模块级状态
// ============================================================

/** sql.js 模块实例（缓存） */
let SQL: SqlJsModule | null = null

/** 数据库实例（缓存） */
let db: Database | null = null

/** 保存数据库的回调函数（由 initDatabase 注入） */
let writeFileFn: ((path: string, data: Uint8Array) => Promise<void>) | null = null

/** FTS5 是否可用（缓存检测结果） */
let fts5Available: boolean | null = null

// ============================================================
// 核心函数
// ============================================================

/**
 * 初始化数据库
 * @param readFile 从 storage 读取文件的函数
 * @param writeFile 向 storage 写入文件的函数
 */
/**
 * Schema 迁移：为旧数据库添加缺失的列
 * 使用 ALTER TABLE ADD COLUMN IF NOT EXISTS（SQLite 3.35+ 支持）
 * 降级方案：先检查列是否存在，不存在再添加
 */
function runMigrations(): void {
  if (!db) return

  const migrations: { table: string; column: string; type: string; default: string }[] = [
    { table: 'books', column: 'note_count', type: 'INTEGER NOT NULL DEFAULT 0', default: '0' },
    { table: 'notes', column: 'word_count', type: 'INTEGER NOT NULL DEFAULT 0', default: '0' },
    { table: 'notes', column: 'image_count', type: 'INTEGER NOT NULL DEFAULT 0', default: '0' },
    { table: 'images', column: 'synced', type: 'INTEGER NOT NULL DEFAULT 0', default: '0' },
    { table: 'images', column: 'synced_at', type: 'INTEGER', default: 'NULL' },
    { table: 'volumes', column: 'note_count', type: 'INTEGER NOT NULL DEFAULT 0', default: '0' },
    { table: 'templates', column: 'content', type: 'TEXT NOT NULL DEFAULT \'\'', default: '\'\'' },
  ]

  for (const m of migrations) {
    try {
      // 检查列是否已存在
      const cols = db.exec(`PRAGMA table_info(${m.table})`)
      if (cols && cols[0] && cols[0].values) {
        const exists = cols[0].values.some((row: unknown[]) => row[1] === m.column)
        if (exists) continue
      }
      // 列不存在，添加
      db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type}`)
    } catch (err) {
      console.warn(`Schema 迁移失败 (${m.table}.${m.column}):`, err)
    }
  }
}

export async function initDatabase(
  readFile: (path: string) => Promise<Uint8Array | null>,
  writeFile: (path: string, data: Uint8Array) => Promise<void>,
): Promise<void> {
  if (db) {
    // 已初始化则跳过
    return
  }

  try {
    // 1. 加载 sql.js WASM 模块
    SQL = await initSqlJs({
      // 让 sql.js 自动定位同目录下的 .wasm 文件
      locateFile: (file: string) => {
        if (file.endsWith('.wasm')) {
          // Vite 构建后 wasm 文件位于 /assets/ 或根目录
          // 开发环境下 node_modules/sql.js/dist/ 中的文件由 vite 处理
          return new URL(`../../node_modules/sql.js/dist/${file}`, import.meta.url).href
        }
        return file
      },
    })

    // 2. 尝试读取已有数据库文件
    const existingData = await readFile(DB_FILE_PATH)

    if (existingData && existingData.length > 0) {
      db = new SQL.Database(existingData)
    } else {
      // 3. 创建新数据库并执行建表 SQL
      db = new SQL.Database()
      db.exec(BASE_SCHEMA_SQL)

      // 尝试创建 FTS5 表（部分 sql.js 编译版本可能不支持）
      try {
        db.exec(FTS5_SCHEMA_SQL)
        fts5Available = true
      } catch {
        fts5Available = false
      }

      // 新数据库立即保存
      const exported = db.export()
      await writeFile(DB_FILE_PATH, exported)
    }

    // 4. 缓存 writeFile 以便后续 saveDB 使用
    writeFileFn = writeFile

    // 5. 执行 schema 迁移（无论新/旧数据库，确保所有列都存在）
    runMigrations()

    // 6. 若从已有数据加载，检测 FTS5 支持情况
    if (existingData) {
      fts5Available = isFTS5Available()

      // 如果 FTS5 支持但表不存在，自动创建
      if (!fts5Available) {
        try {
          db.exec(FTS5_SCHEMA_SQL)
          fts5Available = true
        } catch {
          fts5Available = false
        }
      }
    }
  } catch (err) {
    db = null
    SQL = null
    throw new Error(
      `数据库初始化失败: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * 获取数据库实例
 * @throws 若数据库未初始化则抛出错误
 */
export function getDB(): Database {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDatabase()')
  }
  return db
}

/**
 * 将当前数据库导出并保存到 storage
 */
export async function saveDB(): Promise<void> {
  if (!db) {
    throw new Error('数据库未初始化，无法保存')
  }
  if (!writeFileFn) {
    throw new Error('writeFile 回调未设置，请先调用 initDatabase()')
  }

  try {
    const data = db.export()
    await writeFileFn(DB_FILE_PATH, data)
  } catch (err) {
    throw new Error(
      `保存数据库失败: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * 关闭数据库并释放资源
 */
export function closeDB(): void {
  if (db) {
    try {
      db.close()
    } catch {
      // 忽略关闭时的错误
    }
    db = null
  }
  SQL = null
  writeFileFn = null
  fts5Available = null
}

/**
 * 检查当前 sql.js 是否支持 FTS5
 * 通过查询 sqlite_master 表中是否存在 notes_fts 条目来判断
 */
export function isFTS5Available(): boolean {
  if (fts5Available !== null) {
    return fts5Available
  }

  if (!db) {
    return false
  }

  try {
    const results = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='notes_fts'",
    )
    fts5Available = results.length > 0 && results[0].values.length > 0
    return fts5Available
  } catch {
    fts5Available = false
    return false
  }
}

/**
 * 更新 FTS 索引内容
 * @param noteId 笔记 ID
 * @param title 笔记标题
 * @param content 笔记正文（纯文本）
 */
export function updateFTSContent(
  noteId: string,
  title: string,
  content: string,
): void {
  if (!db) {
    throw new Error('数据库未初始化')
  }

  if (!isFTS5Available()) {
    // FTS5 不可用时静默跳过
    return
  }

  try {
    // 先删除旧索引
    db.run('DELETE FROM notes_fts WHERE note_id = ?', [noteId])
    // 插入新索引
    db.run('INSERT INTO notes_fts (note_id, title, content) VALUES (?, ?, ?)', [
      noteId,
      title,
      content,
    ])
  } catch (err) {
    // FTS 更新失败不应阻断主流程，记录错误即可
    console.warn('FTS 索引更新失败:', err)
  }
}
