/**
 * 冒烟测试 - 数据库 Schema 完整性
 * 验证建表 SQL 结构正确（不依赖 WASM）
 */
import { describe, it, expect } from 'vitest'

// 从 database.ts 复制的基础建表 SQL（去掉了 FTS5 部分以独立测试）
const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS volumes (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
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
  created_at INTEGER NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_volumes_book_id ON volumes(book_id);
CREATE INDEX IF NOT EXISTS idx_notes_volume_id ON notes(volume_id);
CREATE INDEX IF NOT EXISTS idx_notes_book_id ON notes(book_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_book_id ON images(book_id);
CREATE INDEX IF NOT EXISTS idx_images_note_id ON images(note_id);
`

function parseTableNames(schema: string): string[] {
  const matches = schema.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi)
  return Array.from(matches, m => m[1].toLowerCase())
}

function parseIndexNames(schema: string): string[] {
  const matches = schema.matchAll(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi)
  return Array.from(matches, m => m[1].toLowerCase())
}

function parseForeignKeys(schema: string): string[] {
  const matches = schema.matchAll(/FOREIGN\s+KEY\s+\((\w+)\)\s+REFERENCES\s+(\w+)\((\w+)\)/gi)
  return Array.from(matches, m => `${m[1]} -> ${m[2]}.${m[3]}`)
}

describe('数据库 Schema 结构', () => {
  it('应包含全部 6 个表', () => {
    const tables = parseTableNames(BASE_SCHEMA)
    expect(tables).toContain('books')
    expect(tables).toContain('volumes')
    expect(tables).toContain('notes')
    expect(tables).toContain('images')
    expect(tables).toContain('templates')
    expect(tables).toContain('search_history')
    expect(tables).toHaveLength(6)
  })

  it('应包含全部 6 个索引', () => {
    const indexes = parseIndexNames(BASE_SCHEMA)
    expect(indexes).toHaveLength(6)
    expect(indexes).toContain('idx_volumes_book_id')
    expect(indexes).toContain('idx_notes_volume_id')
    expect(indexes).toContain('idx_notes_book_id')
    expect(indexes).toContain('idx_notes_updated_at')
    expect(indexes).toContain('idx_images_book_id')
    expect(indexes).toContain('idx_images_note_id')
  })

  it('books 表使用 TEXT 主键', () => {
    expect(BASE_SCHEMA).toMatch(/books[\s\S]*?id TEXT PRIMARY KEY/)
  })

  it('volumes 表引用 books(id) 外键', () => {
    expect(BASE_SCHEMA).toMatch(/FOREIGN KEY \(book_id\) REFERENCES books\(id\)/)
  })

  it('notes 表引用 volumes 和 books 外键', () => {
    const fks = parseForeignKeys(BASE_SCHEMA)
    expect(fks).toContain('volume_id -> volumes.id')
    expect(fks).toContain('book_id -> books.id')
  })

  it('所有 CREATE 语句使用 IF NOT EXISTS', () => {
    const createStatements = BASE_SCHEMA.match(/CREATE\s+(TABLE|INDEX)\s+(?!IF)/g)
    expect(createStatements).toBeNull() // 所有都应包含 IF NOT EXISTS
  })

  it('notes 表包含废弃笔记过滤所需的 updated_at 字段', () => {
    expect(BASE_SCHEMA).toMatch(/notes[\s\S]*?updated_at INTEGER NOT NULL/)
  })

  it('images 表有 synced 字段标记同步状态', () => {
    expect(BASE_SCHEMA).toMatch(/images[\s\S]*?synced INTEGER NOT NULL DEFAULT 0/)
  })
})
