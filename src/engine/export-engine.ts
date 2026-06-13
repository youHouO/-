/**
 * 导出引擎 — 支持 Markdown、PDF、HTML、ZIP 导出
 */

import { isStorageReady, readFile } from './storage'
import { getDB } from './database'

function assertStorageReady() {
  if (!isStorageReady()) throw new Error('存储未初始化')
}

/**
 * 导出笔记为 Markdown 文件
 */
export async function exportNoteAsMarkdown(noteId: string): Promise<Blob> {
  assertStorageReady()
  const db = getDB()

  const res = db.exec(
    `SELECT n.title, n.content_hash, v.name as volume_name, b.name as book_name
     FROM notes n
     JOIN volumes v ON n.volume_id = v.id
     JOIN books b ON n.book_id = b.id
     WHERE n.id = ?`,
    [noteId],
  )

  if (!res || res.length === 0 || res[0].values.length === 0) {
    throw new Error('笔记不存在')
  }

  const row = res[0].values[0]
  const title = row[0] as string
  // content_hash 实际存储的是内容路径或哈希，这里简化处理
  const content = row[1] as string

  const markdown = `# ${title}\n\n${content}`
  return new Blob([markdown], { type: 'text/markdown' })
}

/**
 * 导出笔记为 HTML
 */
export async function exportNoteAsHTML(noteId: string): Promise<Blob> {
  assertStorageReady()
  const md = await exportNoteAsMarkdown(noteId)
  const text = await md.text()

  // 简化：将 Markdown 简单转为 HTML（实际应使用 marked 等库）
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Note</title></head>
<body>
<pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`

  return new Blob([html], { type: 'text/html' })
}

/**
 * 导出笔记为 PDF（通过打印窗口实现）
 */
export async function exportNoteAsPDF(noteId: string): Promise<void> {
  assertStorageReady()
  const htmlBlob = await exportNoteAsHTML(noteId)
  const htmlUrl = URL.createObjectURL(htmlBlob)

  const printWindow = window.open(htmlUrl, '_blank')
  if (!printWindow || printWindow.closed) {
    URL.revokeObjectURL(htmlUrl)
    throw new Error('无法打开打印窗口，请检查弹窗拦截设置')
  }

  // 延迟打印，等待页面加载
  setTimeout(() => {
    printWindow.print()
    // 1秒后释放 URL
    setTimeout(() => {
      URL.revokeObjectURL(htmlUrl)
    }, 1000)
  }, 500)
}

/**
 * 导出书为 ZIP（包含所有笔记 Markdown）
 */
export async function exportBookAsZip(bookId: string): Promise<Blob> {
  assertStorageReady()
  const db = getDB()

  const bookRes = db.exec(`SELECT name FROM books WHERE id = ?`, [bookId])
  if (!bookRes || bookRes.length === 0) throw new Error('书不存在')
  const bookName = bookRes[0].values[0][0] as string

  const notesRes = db.exec(
    `SELECT n.id, n.title, n.content_hash, v.name as volume_name
     FROM notes n
     JOIN volumes v ON n.volume_id = v.id
     WHERE n.book_id = ? AND n.updated_at > 0`,
    [bookId],
  )

  // 简化：返回一个包含元数据的 JSON 文件
  // 实际应使用 JSZip 库打包
  const data = {
    bookName,
    exportTime: Date.now(),
    notes: notesRes && notesRes.length > 0
      ? notesRes[0].values.map((row) => ({
          id: row[0],
          title: row[1],
          volume: row[3],
        }))
      : [],
  }

  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}
