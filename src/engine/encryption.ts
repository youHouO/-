/**
 * 加密模块
 * 基于 Web Crypto API 实现 AES-GCM 加密与 SHA-256 哈希
 */

// ============================================================
// 常量定义
// ============================================================

/** localStorage 中存储原始密钥的键名 */
const LOCAL_STORAGE_KEY = 'localnotes_aes_key'

/** 固定密码，用于 PBKDF2 派生密钥（作为 fallback） */
const FALLBACK_PASSWORD = 'LocalNotes-Secure-Key-Derivation-2024'

/** AES-GCM 算法参数 */
const AES_GCM_PARAMS: AesKeyGenParams & AesGcmParams = {
  name: 'AES-GCM',
  length: 256,
}

/** PBKDF2 算法参数 */
const PBKDF2_PARAMS: Pbkdf2Params = {
  name: 'PBKDF2',
  salt: new TextEncoder().encode('LocalNotes-Salt-v1'),
  iterations: 100000,
  hash: 'SHA-256',
}

// ============================================================
// 模块级状态
// ============================================================

/** 缓存的 CryptoKey（避免重复导入/生成） */
let cachedKey: CryptoKey | null = null

// ============================================================
// 核心函数
// ============================================================

/**
 * 获取或创建 AES-GCM 密钥
 *
 * 逻辑：
 * 1. 若内存中已缓存密钥，直接返回
 * 2. 尝试从 localStorage 读取已保存的原始密钥并导入
 * 3. 若 localStorage 中无密钥，则随机生成新密钥并保存到 localStorage
 *
 * @returns AES-GCM CryptoKey
 */
export async function getKey(): Promise<CryptoKey> {
  if (cachedKey) {
    return cachedKey
  }

  try {
    // 1. 尝试从 localStorage 恢复密钥
    const storedRaw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (storedRaw) {
      const rawKey = base64ToUint8Array(storedRaw)
      cachedKey = await crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        false, // 不可导出（已存 localStorage 中）
        ['encrypt', 'decrypt'],
      )
      return cachedKey
    }

    // 2. 无存储密钥时，使用 PBKDF2 从固定密码派生确定性密钥
    //    这样即使清空 localStorage，同一设备/浏览器仍能解密旧数据
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(FALLBACK_PASSWORD),
      { name: 'PBKDF2' },
      false,
      ['deriveBits'],
    )

    const derivedBits = await crypto.subtle.deriveBits(
      PBKDF2_PARAMS,
      passwordKey,
      256,
    )

    cachedKey = await crypto.subtle.importKey(
      'raw',
      derivedBits,
      { name: 'AES-GCM' },
      true, // 允许导出以便保存到 localStorage
      ['encrypt', 'decrypt'],
    )

    // 3. 将新密钥保存到 localStorage，供下次快速加载
    const exportableRaw = await crypto.subtle.exportKey('raw', cachedKey)
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      uint8ArrayToBase64(new Uint8Array(exportableRaw)),
    )

    return cachedKey
  } catch (err) {
    throw new Error(
      `获取加密密钥失败: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * 导出原始密钥字节
 * @param key 可选的 CryptoKey，默认使用 getKey() 获取
 * @returns 32 字节原始密钥
 */
export async function exportRawKey(key?: CryptoKey): Promise<Uint8Array> {
  try {
    const targetKey = key ?? (await getKey())
    const raw = await crypto.subtle.exportKey('raw', targetKey)
    return new Uint8Array(raw)
  } catch (err) {
    console.error('导出原始密钥失败:', err)
    // 返回空 Uint8Array 作为安全 fallback，避免调用方崩溃
    return new Uint8Array(0)
  }
}

/**
 * 加密字符串
 * @param plaintext 明文
 * @param key 可选的 CryptoKey，默认使用 getKey() 获取
 * @returns 密文字节数组（格式：16 字节 IV + ciphertext）
 */
export async function encryptString(
  plaintext: string,
  key?: CryptoKey,
): Promise<Uint8Array> {
  try {
    const targetKey = key ?? (await getKey())
    const iv = crypto.getRandomValues(new Uint8Array(16))
    const encoded = new TextEncoder().encode(plaintext)

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      targetKey,
      encoded,
    )

    // 拼接 IV + ciphertext
    const result = new Uint8Array(iv.length + ciphertext.byteLength)
    result.set(iv, 0)
    result.set(new Uint8Array(ciphertext), iv.length)
    return result
  } catch (err) {
    throw new Error(
      `加密失败: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * 解密字符串
 * @param ciphertext 密文字节数组（格式：16 字节 IV + ciphertext）
 * @param key 可选的 CryptoKey，默认使用 getKey() 获取
 * @returns 明文字符串
 */
export async function decryptToString(
  ciphertext: Uint8Array,
  key?: CryptoKey,
): Promise<string> {
  try {
    if (ciphertext.length < 17) {
      throw new Error('密文长度不足（至少需要 17 字节：16 字节 IV + 1 字节数据）')
    }

    const targetKey = key ?? (await getKey())
    const iv = ciphertext.slice(0, 16)
    const data = ciphertext.slice(16)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      targetKey,
      data,
    )

    return new TextDecoder().decode(decrypted)
  } catch (err) {
    throw new Error(
      `解密失败: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * 计算 SHA-256 哈希
 * @param data 输入数据（字符串或 Uint8Array）
 * @returns 十六进制哈希字符串（小写）
 */
export async function sha256(data: string | Uint8Array): Promise<string> {
  try {
    const encoded =
      typeof data === 'string' ? new TextEncoder().encode(data) : data

    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
    return uint8ArrayToHex(new Uint8Array(hashBuffer))
  } catch (err) {
    throw new Error(
      `哈希计算失败: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

// ============================================================
// 工具函数
// ============================================================

/**
 * Uint8Array 转十六进制字符串
 */
function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Base64 字符串转 Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const len = binary.length
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    arr[i] = binary.charCodeAt(i)
  }
  return arr
}

/**
 * Uint8Array 转 Base64 字符串
 */
function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i])
  }
  return btoa(binary)
}
