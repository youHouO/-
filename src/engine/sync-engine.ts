/**
 * 同步引擎 — 云盘同步
 * 支持 WebDAV、FTP、SFTP、S3 等协议
 */

import { createClient, WebDAVClient } from 'webdav'
import { isStorageReady, readFile, writeFile } from './storage'
import { getDB } from './database'

export interface SyncConfig {
  type: 'webdav' | 'ftp' | 'sftp' | 's3'
  host: string
  port?: number
  username: string
  password: string
  path?: string
}

export interface SyncStatus {
  connected: boolean
  lastSync?: number
  error?: string
}

/** 同步进度回调类型 */
export type SyncProgressCallback = (phase: string, current: number, total: number) => void

function assertStorageReady() {
  if (!isStorageReady()) throw new Error('存储未初始化')
}

/**
 * 创建 WebDAV 客户端实例
 */
function createWebDAVClient(config: SyncConfig): WebDAVClient {
  const url = config.host.replace(/\/+$/, '')
  return createClient(url, {
    username: config.username,
    password: config.password,
  })
}

/**
 * 获取远程同步根目录路径
 */
function getRemoteBasePath(config: SyncConfig): string {
  return (config.path || '/notebook-sync').replace(/\/+$/, '')
}

/**
 * 上传单个文件到云盘（供 image-engine 调用）
 * @param config 同步配置
 * @param localPath 本地文件路径（如 Books/{bookId}/Assets/Images/{imageId}.webp）
 * @param remoteSubPath 远程子路径（如 images/{imageId}.webp）
 * @returns 是否上传成功
 */
export async function uploadFile(
  config: SyncConfig,
  localPath: string,
  remoteSubPath: string,
): Promise<boolean> {
  assertStorageReady()

  try {
    const client = createWebDAVClient(config)
    const basePath = getRemoteBasePath(config)
    const remotePath = `${basePath}/${remoteSubPath}`

    // 读取本地文件
    const content = await readFile(localPath)
    if (content === null) {
      console.warn(`上传跳过：本地文件不存在 ${localPath}`)
      return false
    }

    // 确保远程目录存在
    const dirParts = remotePath.split('/').slice(0, -1)
    for (let d = 2; d <= dirParts.length; d++) {
      const dirPath = dirParts.slice(0, d).join('/')
      try {
        await client.createDirectory(dirPath)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        if (!message.includes('409')) {
          throw new Error(`创建远程目录失败: ${message}`)
        }
      }
    }

    // 上传文件
    await client.putFileContents(remotePath, content)
    return true
  } catch (err) {
    console.warn(`上传文件失败: ${localPath}`, err)
    return false
  }
}

/**
 * 测试云盘连接
 */
export async function testConnection(config: SyncConfig): Promise<SyncStatus> {
  assertStorageReady()

  try {
    if (!config.host || !config.username || !config.password) {
      return { connected: false, error: '配置不完整' }
    }

    const client = createWebDAVClient(config)
    await client.getDirectoryContents('/')

    return { connected: true, lastSync: Date.now() }
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : '连接失败',
    }
  }
}

/**
 * 执行同步（上传本地变更到云盘）
 */
export async function syncToCloud(
  config: SyncConfig,
  onProgress?: SyncProgressCallback,
): Promise<SyncStatus> {
  assertStorageReady()

  try {
    const status = await testConnection(config)
    if (!status.connected) return status

    const client = createWebDAVClient(config)
    const basePath = getRemoteBasePath(config)

    // 生成本地文件清单
    const manifest = await generateManifest()
    const filePaths = Object.keys(manifest)
    const total = filePaths.length

    // 确保远程根目录存在（忽略 409 已存在错误）
    try {
      await client.createDirectory(basePath)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes('409')) {
        throw new Error(`创建远程目录失败: ${message}`)
      }
    }

    // 遍历本地文件并上传
    for (let i = 0; i < total; i++) {
      const filePath = filePaths[i]
      const remotePath = `${basePath}/${filePath}`

      onProgress?.('uploading', i + 1, total)

      // 读取本地文件内容
      const content = await readFile(filePath)
      if (content === null) {
        console.warn(`同步跳过：本地文件不存在 ${filePath}`)
        continue
      }

      // 确保远程子目录存在
      const dirParts = remotePath.split('/').slice(0, -1)
      for (let d = 2; d <= dirParts.length; d++) {
        const dirPath = dirParts.slice(0, d).join('/')
        try {
          await client.createDirectory(dirPath)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          if (!message.includes('409')) {
            throw new Error(`创建远程子目录失败: ${message}`)
          }
        }
      }

      // 上传文件到远程
      await client.putFileContents(remotePath, content)
    }

    onProgress?.('done', total, total)

    return { connected: true, lastSync: Date.now() }
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : '同步失败',
    }
  }
}

/**
 * 从云盘恢复（下载云端数据覆盖本地）
 */
export async function restoreFromCloud(
  config: SyncConfig,
  onProgress?: SyncProgressCallback,
): Promise<SyncStatus> {
  assertStorageReady()

  try {
    const status = await testConnection(config)
    if (!status.connected) return status

    const client = createWebDAVClient(config)
    const basePath = getRemoteBasePath(config)

    // 获取远程目录内容列表
    let remoteItems: WebDAVClient[] | any[]
    try {
      remoteItems = await client.getDirectoryContents(basePath) as any[]
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('404')) {
        return { connected: true, lastSync: Date.now(), error: '远程同步目录不存在，无需恢复' }
      }
      throw err
    }

    // 递归收集所有远程文件
    const remoteFiles: { filename: string; path: string }[] = []
    async function collectFiles(items: any[], currentDir: string) {
      for (const item of items) {
        const itemPath = `${currentDir}/${item.basename}`
        if (item.type === 'directory') {
          const subItems = await client.getDirectoryContents(itemPath) as any[]
          await collectFiles(subItems, itemPath)
        } else {
          remoteFiles.push({ filename: item.basename, path: itemPath })
        }
      }
    }
    await collectFiles(remoteItems, basePath)

    const total = remoteFiles.length

    // 遍历远程文件并下载到本地
    for (let i = 0; i < total; i++) {
      const file = remoteFiles[i]
      // 去掉远程根路径前缀，得到相对路径
      const relativePath = file.path.substring(basePath.length + 1)

      onProgress?.('downloading', i + 1, total)

      // 下载文件内容
      const content = await client.getFileContents(file.path) as ArrayBuffer | string
      const data = typeof content === 'string'
        ? new TextEncoder().encode(content)
        : new Uint8Array(content)

      // 写入本地存储
      await writeFile(relativePath, data)
    }

    onProgress?.('done', total, total)

    return { connected: true, lastSync: Date.now() }
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : '恢复失败',
    }
  }
}

/**
 * 生成同步清单（本地文件哈希列表）
 */
export async function generateManifest(): Promise<Record<string, string>> {
  assertStorageReady()

  const db = getDB()
  const manifest: Record<string, string> = {}

  // 查询所有笔记的元数据
  const noteResults = db.exec(
    'SELECT id, book_id, volume_id, content_hash FROM notes',
  )
  if (noteResults.length > 0) {
    for (const row of noteResults[0].values) {
      const noteId = row[0] as string
      const bookId = row[1] as string
      const contentHash = row[3] as string
      // 笔记文件路径约定: Books/{bookId}/Notes/{noteId}.note
      const filePath = `Books/${bookId}/Notes/${noteId}.note`
      manifest[filePath] = contentHash
    }
  }

  // 查询所有图片的元数据
  const imageResults = db.exec(
    'SELECT id, book_id, local_path FROM images',
  )
  if (imageResults.length > 0) {
    for (const row of imageResults[0].values) {
      const imageId = row[0] as string
      const bookId = row[1] as string
      const localPath = row[2] as string
      // 图片文件路径: 使用数据库中记录的 local_path，或按约定生成
      const filePath = localPath || `books/${bookId}/images/${imageId}`
      // 图片的 content_hash 使用 id 作为标识（图片内容不变时 id 不变）
      manifest[filePath] = imageId
    }
  }

  return manifest
}
