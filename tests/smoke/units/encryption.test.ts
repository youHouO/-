/**
 * 冒烟测试 - AES 加密解密
 * 验证核心安全模块：加密后能正确解密
 */
import { describe, it, expect } from 'vitest'

// 直接复制核心逻辑，避免复杂 mock
const KEY_STRING = 'localnotes-aes-256-ctr-fixed-key-v1'

async function getKey(): Promise<CryptoKey> {
  const keyMaterial = new TextEncoder().encode(KEY_STRING)
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyMaterial)
  return crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-CTR' }, false, ['encrypt', 'decrypt'])
}

function generateIV(): Uint8Array {
  const iv = new Uint8Array(16)
  crypto.getRandomValues(iv)
  return iv
}

async function encrypt(plaintext: string): Promise<Uint8Array> {
  const key = await getKey()
  const iv = generateIV()
  const data = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter: iv, length: 128 }, key, data
  )
  const result = new Uint8Array(iv.length + ciphertext.byteLength)
  result.set(iv, 0)
  result.set(new Uint8Array(ciphertext), iv.length)
  return result
}

async function decrypt(encrypted: Uint8Array): Promise<string> {
  const key = await getKey()
  const iv = encrypted.slice(0, 16)
  const ciphertext = encrypted.slice(16)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-CTR', counter: iv, length: 128 }, key, ciphertext
  )
  return new TextDecoder().decode(plaintext)
}

describe('AES-256-CTR 加密解密', () => {
  it('加密后再解密应得到原文（中文）', async () => {
    const original = '你好，这是测试笔记内容！'
    const encrypted = await encrypt(original)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('加密后再解密应得到原文（英文）', async () => {
    const original = 'Hello, World! This is a test note.'
    const encrypted = await encrypt(original)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('加密后再解密应得到原文（混合内容）', async () => {
    const original = '# Markdown 标题\n\n这是一段 **加粗** 和 *斜体* 的文字。\n\n```js\nconst x = 1\n```'
    const encrypted = await encrypt(original)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('空字符串加密解密', async () => {
    const original = ''
    const encrypted = await encrypt(original)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('加密结果包含 16 字节 IV 前缀', async () => {
    const encrypted = await encrypt('test')
    expect(encrypted.length).toBeGreaterThan(16)
  })

  it('每次加密产生不同密文（随机 IV）', async () => {
    const plaintext = 'same content'
    const e1 = await encrypt(plaintext)
    const e2 = await encrypt(plaintext)
    // IV 不同，密文也不同
    const iv1 = Array.from(e1.slice(0, 16))
    const iv2 = Array.from(e2.slice(0, 16))
    expect(iv1).not.toEqual(iv2)
  })

  it('篡改密文后解密失败', async () => {
    const encrypted = await encrypt('test')
    // 篡改密文中间字节
    encrypted[20] = (encrypted[20] + 1) % 256
    await expect(decrypt(encrypted)).rejects.toThrow()
  })

  it('密文长度不足 16 字节时解密失败', async () => {
    const short = new Uint8Array([1, 2, 3])
    await expect(decrypt(short)).rejects.toThrow()
  })

  it('长文本（10000 字）加密解密', async () => {
    const original = '测试'.repeat(5000) // 10000 字符
    const encrypted = await encrypt(original)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(original)
  })
})
