/**
 * File System Access API 类型扩展
 * 补充 TypeScript 原生类型中缺失的 API 方法
 */

interface FileSystemDirectoryHandle {
  /** 异步迭代器，遍历目录内容 */
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>
}
