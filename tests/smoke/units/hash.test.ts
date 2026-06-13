/**
 * 冒烟测试 - SHA-256 明文哈希
 * 验证增量同步依赖的内容哈希函数
 */
import { describe, it, expect } from 'vitest'

async function sha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

describe('SHA-256 明文哈希', () => {
  it('相同内容产生相同哈希', async () => {
    const h1 = await sha256('Hello World')
    const h2 = await sha256('Hello World')
    expect(h1).toBe(h2)
  })

  it('不同内容产生不同哈希', async () => {
    const h1 = await sha256('Hello World')
    const h2 = await sha256('Hello World!')
    expect(h1).not.toBe(h2)
  })

  it('哈希字符串是 64 字符十六进制', async () => {
    const hash = await sha256('test')
    expect(hash).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true)
  })

  it('空内容也能产生有效哈希', async () => {
    const hash = await sha256('')
    expect(hash).toHaveLength(64)
  })

  it('中文字符哈希一致性', async () => {
    const h1 = await sha256('你好世界')
    const h2 = await sha256('你好世界')
    expect(h1).toBe(h2)
  })

  it('Markdown 内容哈希一致性', async () => {
    const md = '# 标题\n\n这是**加粗**文字\n\n- 列表项 1\n- 列表项 2'
    const h1 = await sha256(md)
    const h2 = await sha256(md)
    expect(h1).toBe(h2)
  })

  it('Uint8Array 和字符串产生相同哈希（同内容）', async () => {
    const text = 'test content'
    const h1 = await sha256(text)
    const h2 = await sha256(new TextEncoder().encode(text))
    expect(h1).toBe(h2)
  })

  it('已知哈希值验证（SHA-256 标准）', async () => {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const hash = await sha256('')
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})
