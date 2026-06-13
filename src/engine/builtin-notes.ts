/**
 * 内置笔记 — 首次使用时自动创建的示例数据
 */

import { createBook, createVolume, createNote } from './note-engine'

/**
 * 创建内置示例笔记
 */
export async function createBuiltinNotes(): Promise<void> {
  // 创建示例书
  const book = createBook('欢迎使用 LocalNotes')

  // 创建卷
  const vol1 = createVolume(book.id, '快速入门')
  const vol2 = createVolume(book.id, '进阶功能')

  // 创建笔记
  createNote(vol1.id, 'Markdown 编辑功能', `# Markdown 编辑功能

LocalNotes 内置了专业的 Markdown 编辑器，让你专注于写作。

## 编辑体验

- **语法高亮**：标题、列表、代码块等自动着色
- **实时预览**：右侧面板即时渲染 Markdown 效果
- **三种视图**：纯编辑 / 分屏 / 纯预览，按需切换
- **自动保存**：停止输入 500ms 后自动保存，不怕丢失

## 快捷键

| 功能 | 快捷键 |
|------|--------|
| 撤销 | Ctrl+Z |
| 重做 | Ctrl+Shift+Z |
| 插入日期 | Ctrl+Shift+D |

开始你的创作吧！`)

  createNote(vol1.id, '本地存储与隐私', `# 本地存储与隐私

LocalNotes 采用**本地优先**设计理念：

- 所有数据存储在你的电脑上
- 无需注册账号
- 无需联网即可使用
- 应用卸载后数据不丢失（使用文件系统访问 API）

## 数据位置

你的笔记以文件形式存储在选择的文件夹中：

\`\`\`
Documents/LocalNotes/
  Books/
    {书UUID}/
      Notes/
        {笔记UUID}.note
      Assets/
        Images/
\`\`\`

## 加密支持

可选启用 AES-256-GCM 加密，保护敏感笔记。`)

  createNote(vol2.id, '云同步设置', `# 云同步设置

LocalNotes 支持多种云盘同步：

## 支持的协议

- WebDAV
- FTP / SFTP
- Amazon S3

## 配置步骤

1. 打开设置 → 云同步
2. 选择同步协议
3. 填写服务器地址、用户名、密码
4. 点击"测试连接"
5. 连接成功后启用自动同步

## 同步策略

- 自动同步：编辑后 30 秒自动上传
- 手动同步：点击工具栏同步按钮
- 冲突处理：保留较新版本，旧版本存入冲突目录`)
}
