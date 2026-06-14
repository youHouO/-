/**
 * 导出引擎 — 支持 Markdown、PDF、HTML、ZIP 导出
 */

import { isStorageReady, readFile } from './storage'
import { getDB } from './database'
import { getNote } from './note-engine'
import { decryptToString } from './encryption'
import JSZip from 'jszip'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { renderToString } from 'react-dom/server'

function assertStorageReady() {
  if (!isStorageReady()) throw new Error('存储未初始化')
}

/**
 * 从 storage 读取笔记的实际内容（自动解密加密笔记）
 */
async function readNoteContent(noteId: string, bookId: string): Promise<string> {
  const contentPath = `Books/${bookId}/Notes/${noteId}.note`
  const data = await readFile(contentPath)
  if (!data) return ''

  // 检查是否加密
  const note = getNote(noteId)
  if (note && note.contentHash.startsWith('[ENC]')) {
    return await decryptToString(data)
  }

  return new TextDecoder().decode(data)
}

/**
 * 导出笔记为 Markdown 文件
 */
export async function exportNoteAsMarkdown(noteId: string): Promise<Blob> {
  assertStorageReady()
  const db = getDB()

  const res = db.exec(
    `SELECT n.title, n.book_id, v.name as volume_name, b.name as book_name
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
  const bookId = row[1] as string

  // 从 storage 读取笔记的实际内容
  const content = await readNoteContent(noteId, bookId)

  const markdown = `# ${title}\n\n${content}`
  return new Blob([markdown], { type: 'text/markdown' })
}

/**
 * GitHub Markdown 风格的内联 CSS
 */
const GITHUB_MARKDOWN_CSS = `
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    color: #24292f;
    background-color: #ffffff;
    max-width: 980px;
    margin: 0 auto;
    padding: 32px;
  }
  h1, h2, h3, h4, h5, h6 {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    line-height: 1.25;
  }
  h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid #d0d7de; }
  h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid #d0d7de; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1em; }
  h5 { font-size: 0.875em; }
  h6 { font-size: 0.85em; color: #57606a; }
  p { margin-top: 0; margin-bottom: 16px; }
  a { color: #0969da; text-decoration: none; }
  a:hover { text-decoration: underline; }
  blockquote {
    margin: 0 0 16px;
    padding: 0 1em;
    color: #57606a;
    border-left: 0.25em solid #d0d7de;
  }
  code {
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 85%;
    background-color: rgba(175,184,193,0.2);
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace;
  }
  pre {
    margin-top: 0;
    margin-bottom: 16px;
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #f6f8fa;
    border-radius: 6px;
  }
  pre code {
    padding: 0;
    margin: 0;
    font-size: 100%;
    background-color: transparent;
    border-radius: 0;
  }
  ul, ol {
    margin-top: 0;
    margin-bottom: 16px;
    padding-left: 2em;
  }
  li + li { margin-top: 0.25em; }
  table {
    border-collapse: collapse;
    margin-bottom: 16px;
    width: 100%;
  }
  th, td {
    padding: 6px 13px;
    border: 1px solid #d0d7de;
  }
  th {
    font-weight: 600;
    background-color: #f6f8fa;
  }
  tr:nth-child(2n) { background-color: #f6f8fa; }
  img {
    max-width: 100%;
    box-sizing: content-box;
    background-color: #fff;
  }
  hr {
    height: 0.25em;
    margin: 24px 0;
    padding: 0;
    background-color: #d0d7de;
    border: 0;
  }
  input[type="checkbox"] {
    margin-right: 0.5em;
  }
</style>
`

/**
 * 导出笔记为 HTML
 */
export async function exportNoteAsHTML(noteId: string): Promise<Blob> {
  assertStorageReady()
  const db = getDB()

  const res = db.exec(
    `SELECT n.title, n.book_id, v.name as volume_name, b.name as book_name
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
  const bookId = row[1] as string

  // 从 storage 读取笔记的实际内容
  const content = await readNoteContent(noteId, bookId)

  // 使用 react-markdown 渲染 Markdown 为 HTML
  const markdownHtml = renderToString(
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
      {content}
    </ReactMarkdown>,
  )

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  ${GITHUB_MARKDOWN_CSS}
</head>
<body>
  <article class="markdown-body">
    ${markdownHtml}
  </article>
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
 * 导出书为 ZIP（包含所有笔记 Markdown 和图片）
 */
export async function exportBookAsZip(bookId: string): Promise<Blob> {
  assertStorageReady()
  const db = getDB()

  const bookRes = db.exec(`SELECT name FROM books WHERE id = ?`, [bookId])
  if (!bookRes || bookRes.length === 0) throw new Error('书不存在')
  const bookName = bookRes[0].values[0][0] as string

  const zip = new JSZip()

  // 创建书目录
  const bookFolder = zip.folder(bookName)!

  // 查询所有笔记
  const notesRes = db.exec(
    `SELECT n.id, n.title, n.book_id, v.name as volume_name
     FROM notes n
     JOIN volumes v ON n.volume_id = v.id
     WHERE n.book_id = ? AND n.updated_at > 0`,
    [bookId],
  )

  if (notesRes && notesRes.length > 0) {
    for (const row of notesRes[0].values) {
      const noteId = row[0] as string
      const noteTitle = row[1] as string
      const noteBookId = row[2] as string
      const volumeName = row[3] as string

      // 从 storage 读取笔记实际内容
      const content = await readNoteContent(noteId, noteBookId)

      // 安全文件名：替换路径分隔符等特殊字符
      const safeVolumeName = volumeName.replace(/[\/\\:*?"<>|]/g, '_')
      const safeNoteTitle = noteTitle.replace(/[\/\\:*?"<>|]/g, '_')

      // 文件结构: {bookName}/{volumeName}/{noteTitle}.md
      const filePath = `${safeVolumeName}/${safeNoteTitle}.md`
      const markdown = `# ${noteTitle}\n\n${content}`
      bookFolder.file(filePath, markdown)
    }
  }

  // 查询并打包图片
  const imagesRes = db.exec(
    `SELECT id, book_id, local_path FROM images WHERE book_id = ?`,
    [bookId],
  )

  if (imagesRes && imagesRes.length > 0) {
    // 创建 images 子目录
    const imagesFolder = bookFolder.folder('images')!

    for (const row of imagesRes[0].values) {
      const imageId = row[0] as string
      const imageBookId = row[1] as string
      const localPath = row[2] as string

      // 读取图片文件
      const imageData = await readFile(localPath)

      if (imageData) {
        imagesFolder.file(`${imageId}.webp`, imageData)
      }
    }
  }

  return zip.generateAsync({ type: 'blob' })
}
