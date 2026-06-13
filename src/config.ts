/**
 * 应用全局配置
 * 所有配置项集中管理，禁止在其他文件中硬编码
 */

/** 应用名称（占位，后续替换为正式名称） */
export const APP_NAME = 'LocalNotes'

/** 应用版本 */
export const APP_VERSION = '1.0.0'

/** 自动保存延迟（毫秒），用户停止输入后触发 */
export const AUTO_SAVE_DELAY = 500

/** 图片惰性同步延迟（毫秒） */
export const IMAGE_SYNC_DELAY = 15000

/** 图片未同步数量阈值，超过后退出时弹窗确认 */
export const IMAGE_UNSYNCED_DIALOG_THRESHOLD = 4

/** 图片未同步大小阈值（字节），超过后提前触发同步 */
export const IMAGE_UNSYNCED_SIZE_THRESHOLD = 10 * 1024 * 1024 // 10MB

/** 未同步图片数量触发提前同步的阈值 */
export const IMAGE_UNSYNCED_COUNT_EARLY_SYNC = 5

/** 用户停止输入后触发提前同步的等待时间（毫秒） */
export const IMAGE_EARLY_SYNC_IDLE_DELAY = 5 * 60 * 1000 // 5分钟

/** 回收站保留天数 */
export const TRASH_RETENTION_DAYS = 30

/** 同步日志保留天数 */
export const SYNC_LOG_RETENTION_DAYS = 30

/** 搜索历史最大条数 */
export const MAX_SEARCH_HISTORY = 10

/** 图片压缩质量 (WebP, 0-1) */
export const IMAGE_QUALITY = 0.95

/** 数据库文件路径（相对于存储根目录） */
export const DB_FILE_PATH = 'Books/.index.db'

/** 配置文件路径（相对于存储根目录） */
export const CONFIG_FILE_PATH = 'config.json'

/** 清单文件路径（每个云盘根目录下） */
export const MANIFEST_FILE_NAME = 'manifest.json'
