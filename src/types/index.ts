/**
 * 核心类型定义
 */

/** 内容类型枚举 */
export type ContentType = 'book' | 'volume' | 'note'

/** 排序方式 */
export type SortOrder = 'modified' | 'created'

/** 同步状态 */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

/** 视图模式 */
export type ViewMode = 'edit' | 'preview'

/** 搜索范围 */
export type SearchScope = 'all' | 'current-book'

/** 书 */
export interface Book {
  id: string // UUID
  name: string
  createdAt: number // timestamp
  updatedAt: number
  noteCount: number
}

/** 卷 */
export interface Volume {
  id: string // UUID
  bookId: string
  name: string
  createdAt: number
  updatedAt: number
  noteCount: number
  sortOrder: number // 手动排序索引
}

/** 笔记 */
export interface Note {
  id: string // UUID
  volumeId: string
  bookId: string
  title: string
  contentHash: string // 明文SHA-256哈希
  createdAt: number
  updatedAt: number
  wordCount: number
  imageCount: number
}

/** 图片 */
export interface ImageAsset {
  id: string // 文件名（时间戳_随机数.webp）
  bookId: string
  noteId: string | null // 可能未被引用
  localPath: string
  synced: boolean
  createdAt: number
  size: number
}

/** 云盘配置 */
export interface CloudDriveConfig {
  id: string
  name: string
  type: 'webdav' | 'aliyun' | 'onedrive'
  url: string
  username: string
  password: string // 加密存储
  enabled: boolean
  lastSyncAt: number | null
  syncStatus: SyncStatus
}

/** 同步日志条目 */
export interface SyncLogEntry {
  id: string
  timestamp: number
  driveName: string
  operation: 'upload' | 'download' | 'delete'
  fileName: string
  success: boolean
  errorMessage?: string
  isConflict: boolean
}

/** 搜索历史 */
export interface SearchHistoryItem {
  id: string
  keyword: string
  timestamp: number
}

/** 模板 */
export interface Template {
  id: string
  name: string
  content: string
  scope: 'global' | 'book' // 全局模板 / 书内模板
  bookId?: string // 仅书内模板需要
  createdAt: number
  updatedAt: number
}
