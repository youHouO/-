/**
 * 基于 File System Access API 的存储层实现
 * 数据存储在用户选择的系统目录中，应用卸载不删除
 */

import { saveHandle, loadHandle, requestHandlePermission } from './storage-handle'

let rootDirHandle: FileSystemDirectoryHandle | null = null

/**
 * 初始化存储：尝试恢复已保存的 handle，失败则请求用户选择目录
 * @param options - defaultPath 为 true 时，在用户选中的目录下自动创建 LocalNotes 子目录
 */
export async function initStorage(options?: { defaultPath?: boolean }): Promise<void> {
  // 1. 尝试从 IndexedDB 恢复已保存的 handle
  const savedHandle = await loadHandle()
  if (savedHandle) {
    const hasPermission = await requestHandlePermission(savedHandle)
    if (hasPermission) {
      // 如果启用 defaultPath 且恢复的 handle 不是 LocalNotes，创建子目录
      if (options?.defaultPath && savedHandle.name !== 'LocalNotes') {
        const localNotesHandle = await savedHandle.getDirectoryHandle('LocalNotes', { create: true })
        await saveHandle(localNotesHandle)
        rootDirHandle = localNotesHandle
        console.log('[storage-fsaa] 已创建 LocalNotes 子目录:', savedHandle.name + '/LocalNotes')
      } else {
        rootDirHandle = savedHandle
      }
      return
    }
  }

  // 2. 恢复失败或权限不足，请求用户选择目录
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    throw new Error('当前浏览器不支持文件系统访问，请使用 Chrome 或 Edge')
  }

  const handle = await window.showDirectoryPicker({
    id: 'localnotes-data',
    mode: 'readwrite',
    startIn: 'documents',
  })

  let targetHandle = handle

  // 3. 如果启用默认路径，在选中的目录下创建/获取 LocalNotes 子目录
  if (options?.defaultPath) {
    targetHandle = await handle.getDirectoryHandle('LocalNotes', { create: true })
  }

  // 4. 保存 handle 到 IndexedDB
  await saveHandle(targetHandle)
  rootDirHandle = targetHandle
}

/**
 * 使用默认路径初始化存储
 * 先尝试恢复 handle，否则引导用户选择 Documents 并在其下创建 LocalNotes
 */
export async function initStorageWithDefaultPath(): Promise<void> {
  // 1. 尝试从 IndexedDB 恢复已保存的 handle
  const savedHandle = await loadHandle()
  if (savedHandle) {
    const hasPermission = await requestHandlePermission(savedHandle)
    if (hasPermission) {
      rootDirHandle = savedHandle
      return
    }
  }

  // 2. 恢复失败或权限不足，请求用户选择目录
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    throw new Error('当前浏览器不支持文件系统访问，请使用 Chrome 或 Edge')
  }

  const handle = await window.showDirectoryPicker({
    id: 'localnotes-data',
    mode: 'readwrite',
    startIn: 'documents',
  })

  // 3. 在选中的目录下创建/获取 LocalNotes 子目录
  const localNotesHandle = await handle.getDirectoryHandle('LocalNotes', { create: true })

  // 4. 保存子目录 handle 到 IndexedDB
  await saveHandle(localNotesHandle)
  rootDirHandle = localNotesHandle
}

/**
 * 使用指定的目录 handle 初始化存储
 * 用于 WelcomePicker 中用户手动选择目录后
 */
export async function initStorageWithHandle(
  handle: FileSystemDirectoryHandle,
  options?: { defaultPath?: boolean },
): Promise<void> {
  let targetHandle = handle

  // 如果启用默认路径，在选中的目录下创建/获取 LocalNotes 子目录
  if (options?.defaultPath) {
    targetHandle = await handle.getDirectoryHandle('LocalNotes', { create: true })
  }

  // 保存 handle 到 IndexedDB
  await saveHandle(targetHandle)
  rootDirHandle = targetHandle
}

/**
 * 获取当前根目录名称
 */
export function getRootPath(): string | null {
  return rootDirHandle?.name ?? null
}

/**
 * 逐级获取目录 handle
 */
async function getDirectoryHandle(
  path: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  if (!rootDirHandle) throw new Error('存储未初始化')

  const parts = path.split('/').filter(Boolean)
  let current = rootDirHandle

  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create })
  }

  return current
}

/**
 * 逐级获取文件 handle
 */
async function getFileHandle(
  path: string,
  create = false,
): Promise<FileSystemFileHandle> {
  if (!rootDirHandle) throw new Error('存储未初始化')

  const parts = path.split('/').filter(Boolean)
  const fileName = parts.pop()!
  const dirHandle = parts.length > 0
    ? await getDirectoryHandle(parts.join('/'), create)
    : rootDirHandle

  return dirHandle.getFileHandle(fileName, { create })
}

/**
 * 读取文件内容，文件不存在时返回 null
 */
export async function readFile(path: string): Promise<Uint8Array | null> {
  try {
    const fileHandle = await getFileHandle(path)
    const file = await fileHandle.getFile()
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFoundError') return null
    throw err
  }
}

/**
 * 写入文件，自动创建父目录
 */
export async function writeFile(path: string, data: Uint8Array | string): Promise<void> {
  const encoder = new TextEncoder()
  const bytes = typeof data === 'string' ? encoder.encode(data) : data

  const fileHandle = await getFileHandle(path, true)
  const writable = await fileHandle.createWritable()
  await writable.write({ type: 'write', data: bytes })
  await writable.close()
}

/**
 * 检查文件是否存在
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await getFileHandle(path)
    return true
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFoundError') return false
    throw err
  }
}

/**
 * 删除文件
 */
export async function deleteFile(path: string): Promise<void> {
  const parts = path.split('/').filter(Boolean)
  const fileName = parts.pop()!
  const dirHandle = parts.length > 0
    ? await getDirectoryHandle(parts.join('/'))
    : rootDirHandle!

  await dirHandle.removeEntry(fileName)
}

/**
 * 递归删除目录
 */
export async function deleteDirectory(path: string): Promise<void> {
  const parts = path.split('/').filter(Boolean)
  const dirName = parts.pop()!
  const parentHandle = parts.length > 0
    ? await getDirectoryHandle(parts.join('/'))
    : rootDirHandle!

  await parentHandle.removeEntry(dirName, { recursive: true })
}

/**
 * 列出目录内容
 */
export async function listDirectory(path: string): Promise<string[]> {
  const dirHandle = path ? await getDirectoryHandle(path) : rootDirHandle!
  const names: string[] = []

  // @ts-expect-error values() 在标准类型中未定义，但浏览器已支持
  for await (const entry of dirHandle.values()) {
    names.push(entry.name)
  }

  return names
}

/**
 * 创建目录（逐级）
 */
export async function createDirectory(path: string): Promise<void> {
  await getDirectoryHandle(path, true)
}

/**
 * 移动文件：读源 → 写目标 → 删源
 */
export async function moveFile(sourcePath: string, destPath: string): Promise<void> {
  const data = await readFile(sourcePath)
  if (data === null) throw new Error(`源文件不存在: ${sourcePath}`)
  await writeFile(destPath, data)
  await deleteFile(sourcePath)
}

/**
 * 同步检查存储是否已就绪
 */
export function isStorageReady(): boolean {
  return rootDirHandle !== null
}
