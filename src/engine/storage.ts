/**
 * 存储层统一入口
 * 统一先尝试 File System Access API，失败后再降级到 OPFS 并有明确提示
 */

export type StorageBackend = 'fsaa' | 'opfs'

/** 当前实际使用的后端 */
let backend: StorageBackend | null = null

/** 缓存已加载的后端模块 */
let cachedModule: typeof import('./storage-fsaa') | typeof import('./storage-opfs') | null = null

/** 降级原因，用于提示用户 */
let fallbackReason: string | null = null

/**
 * 获取当前使用的后端名称
 */
export function getStorageBackend(): StorageBackend | null {
  return backend
}

/**
 * 获取降级原因
 */
export function getFallbackReason(): string | null {
  return fallbackReason
}

/**
 * 初始化存储层
 * 优先尝试 FSA API，失败时降级到 OPFS 并记录原因
 */
export async function initStorage(): Promise<void> {
  // 1. 统一先尝试 FSA API
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    try {
      const mod = await import('./storage-fsaa')
      await mod.initStorage()
      cachedModule = mod
      backend = 'fsaa'
      fallbackReason = null
      return
    } catch (err) {
      // 用户取消不算错误，向上抛出让 UI 处理
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err
      }
      // FSA API 失败，记录原因准备降级
      fallbackReason = err instanceof Error ? err.message : '文件系统访问失败'
    }
  } else {
    fallbackReason = '当前浏览器不支持文件系统访问 API'
  }

  // 2. 降级到 OPFS
  if (typeof navigator !== 'undefined' && navigator.storage?.getDirectory) {
    const mod = await import('./storage-opfs')
    await mod.initStorage()
    cachedModule = mod
    backend = 'opfs'
    return
  }

  // 3. 完全不支持
  throw new Error('当前浏览器不支持任何文件系统存储，请使用 Chrome、Edge 或 Firefox')
}

/**
 * 强制使用指定后端（用于用户手动选择降级）
 */
export async function initStorageWithBackend(
  forcedBackend: StorageBackend,
): Promise<void> {
  if (forcedBackend === 'fsaa') {
    const mod = await import('./storage-fsaa')
    await mod.initStorage()
    cachedModule = mod
    backend = 'fsaa'
    fallbackReason = null
  } else {
    const mod = await import('./storage-opfs')
    await mod.initStorage()
    cachedModule = mod
    backend = 'opfs'
    fallbackReason = null
  }
}

function getModule() {
  if (!cachedModule) {
    throw new Error('存储未初始化，请先调用 initStorage()')
  }
  return cachedModule
}

/**
 * 读取文件内容，文件不存在时返回 null
 */
export async function readFile(path: string): Promise<Uint8Array | null> {
  return getModule().readFile(path)
}

/**
 * 写入文件，自动创建父目录
 */
export async function writeFile(path: string, data: Uint8Array | string): Promise<void> {
  return getModule().writeFile(path, data)
}

/**
 * 检查文件是否存在
 */
export async function fileExists(path: string): Promise<boolean> {
  return getModule().fileExists(path)
}

/**
 * 删除文件
 */
export async function deleteFile(path: string): Promise<void> {
  return getModule().deleteFile(path)
}

/**
 * 递归删除目录
 */
export async function deleteDirectory(path: string): Promise<void> {
  return getModule().deleteDirectory(path)
}

/**
 * 列出目录内容
 */
export async function listDirectory(path: string): Promise<string[]> {
  return getModule().listDirectory(path)
}

/**
 * 创建目录（逐级）
 */
export async function createDirectory(path: string): Promise<void> {
  return getModule().createDirectory(path)
}

/**
 * 移动文件：读源 → 写目标 → 删源
 */
export async function moveFile(sourcePath: string, destPath: string): Promise<void> {
  return getModule().moveFile(sourcePath, destPath)
}

/**
 * 同步检查存储是否已就绪
 */
export function isStorageReady(): boolean {
  return cachedModule?.isStorageReady() ?? false
}
