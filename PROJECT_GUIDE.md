# PROJECT_GUIDE.md — 项目全景指南

> 最后更新：2026-06-13 | 本文档由代码分析自动生成，不修改任何源码

---

## 一、目录结构与模块职责

```
本地笔记本项目/
├── public/
│   ├── decrypt.html              # 独立解密工具（纯 HTML，离线可用）
│   ├── favicon.svg               # 应用图标
│   └── manifest.webmanifest      # PWA 清单
├── src/
│   ├── main.tsx                  # 应用入口（HashRouter + StrictMode）
│   ├── App.tsx                   # 路由定义（首页 + 编辑器 + 重定向）
│   ├── config.ts                 # 全局配置常量（15+ 可调参数）
│   ├── index.css                 # 全局样式（CSS 变量主题 + Markdown 预览 + 滚动条）
│   │
│   ├── types/
│   │   └── index.ts              # TypeScript 类型定义（13 个接口/类型）
│   │
│   ├── lib/
│   │   └── utils.ts              # 工具函数（cn 类名合并）
│   │
│   ├── engine/                   # 核心引擎层（无 UI 依赖）
│   │   ├── storage.ts            # 存储层：OPFS 文件读写（11 个导出函数）
│   │   ├── encryption.ts         # 加密层：AES-256-CTR + SHA-256（6 个导出函数）
│   │   ├── database.ts           # 数据库层：SQLite WASM + FTS5（7 个导出函数）
│   │   ├── note-engine.ts        # 笔记引擎：CRUD + 模板 + 回收站 + 搜索（25 个导出函数）
│   │   ├── image-engine.ts       # 图片引擎：压缩 + 加密存储 + 惰性同步队列（11 个导出函数）
│   │   ├── sync-engine.ts        # 同步引擎：WebDAV 增量同步 + 云端恢复（8 个导出函数）
│   │   ├── export-engine.ts      # 导出引擎：Markdown/PDF/ZIP（7 个导出函数）
│   │   └── builtin-notes.ts      # 内置笔记：首次启动引导内容（1 个导出函数）
│   │
│   ├── pages/                    # 页面组件
│   │   ├── HomePage.tsx          # 首页：三级目录树 + 嵌入式编辑器 + 弹窗管理
│   │   └── EditorPage.tsx        # 编辑器页：全屏编辑模式包装器
│   │
│   ├── components/               # UI 组件
│   │   ├── NoteEditor.tsx        # 笔记编辑器：CodeMirror 6 + Markdown 预览 + 自动保存
│   │   ├── ui/                   # 基础 UI 组件（shadcn/ui）
│   │   │   ├── dialog.tsx        # 弹窗（Radix UI Dialog 封装）
│   │   │   ├── button.tsx        # 按钮（cva 变体系统）
│   │   │   └── input.tsx         # 输入框
│   │   └── modals/               # 业务弹窗
│   │       ├── CreateModal.tsx       # 新建弹窗（书/卷/笔记共用）
│   │       ├── RenameModal.tsx       # 重命名弹窗
│   │       ├── DeleteConfirmModal.tsx # 删除确认弹窗
│   │       ├── SettingsModal.tsx      # 设置弹窗（8 个子页面）
│   │       └── SearchModal.tsx        # 搜索弹窗（FTS5 + LIKE 降级）
│   │
│   └── store/                    # 状态管理（Zustand，已安装但未抽取独立 store）
│
├── docs/
│   ├── REQUIREMENTS.md           # 需求文档
│   ├── TECH_DESIGN.md            # 技术设计文档
│   └── DESIGN_BLUEPRINT.md       # 设计蓝图
├── tests/
│   └── smoke/flows/              # 冒烟测试
├── .ai-rules.md                  # AI 开发规则（8 条底线原则）
├── progress.md                   # 项目进度看板
├── devlog.md                     # 开发日志
├── package.json                  # 依赖配置（pnpm）
├── vite.config.ts                # Vite 构建配置（分包 + PWA）
└── tsconfig.json                 # TypeScript 配置（Project References）
```

---

## 二、组件树与页面路由

### 路由表

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `HomePage` | 首页（主框架） |
| `/book/:bookId` | `HomePage` | 指定书的首页 |
| `/editor/:noteId` | `EditorPage` → `NoteEditor` | 全屏编辑模式 |
| `/search`, `/settings/*` | `Navigate → /` | 旧路由重定向兼容 |
| `*` | `Navigate → /` | 404 兜底 |

### 组件树

```
main.tsx (HashRouter)
└── App (路由)
    ├── HomePage (18 个 useState，状态中枢)
    │   ├── NoteEditor (embedded 模式)
    │   │   ├── CodeMirror 6 (动态导入)
    │   │   ├── Markdown 预览 (react-markdown + remark-gfm)
    │   │   ├── DeleteConfirmModal
    │   │   └── RenameModal (复用为"另存为模板")
    │   ├── CreateModal
    │   ├── RenameModal
    │   ├── DeleteConfirmModal
    │   ├── SettingsModal (8 个子页面)
    │   │   ├── CloudSettingsContent
    │   │   ├── TemplateSettingsContent
    │   │   ├── ImageSettingsContent
    │   │   ├── TrashSettingsContent
    │   │   ├── ExportSettingsContent
    │   │   ├── SecuritySettingsContent
    │   │   ├── DatabaseSettingsContent
    │   │   └── AboutSettingsContent
    │   └── SearchModal
    └── EditorPage (全屏包装器)
        └── NoteEditor (全屏模式)
```

### 状态管理模式

项目**未使用**独立的 Zustand store 文件。所有状态通过 React 组件级 `useState` 管理，`HomePage` 是事实上的状态中枢，管理目录数据、展开状态、弹窗状态等。

---

## 三、关键数据流

### 3.1 用户新建笔记 → 加密 → 原子写入 → 更新索引 → WebDAV 同步

```
用户操作                    引擎层                          存储层
─────────────────────────────────────────────────────────────────────

1. 用户点击"新建笔记"
   │
   ▼
2. CreateModal 输入名称
   │  onConfirm(name)
   ▼
3. HomePage.handleCreateNote(name)
   │
   ▼
4. note-engine.createNote(volumeId, bookId, title)
   │
   ├─ 生成 UUID (noteId)
   ├─ 初始内容 = templateContent || ''
   ├─ 计算 contentHash = sha256(plainContent)
   │
   ├─ [加密] encryption.encryptString(plainContent)
   │         ├─ 固定密钥字符串 → SHA-256 → CryptoKey (缓存)
   │         ├─ 生成 16 字节随机 IV
   │         └─ AES-256-CTR 加密 → [IV][密文] Uint8Array
   │
   ├─ [原子写入] storage.writeFile(`Books/${bookId}/${noteId}.note`, encryptedData)
   │         ├─ OPFS: rootHandle.getFileHandle(path)
   │         ├─ OPFS: createWritable() → write(data) → close()
   │         └─ finally 保证 writable.close() 释放锁
   │
   ├─ [更新索引] database.getDB().exec(SQL INSERT)
   │         ├─ INSERT INTO notes (id, volume_id, book_id, title, ...)
   │         ├─ UPDATE volumes SET note_count = note_count + 1
   │         ├─ UPDATE books SET note_count = note_count + 1
   │         └─ [FTS5] 触发器 notes_ai 自动插入 FTS 索引
   │
   └─ [FTS 内容] database.updateFTSContent(rowid, plainContent)
              └─ INSERT INTO notes_fts ... VALUES (rowid, title, content)
                  (覆盖触发器写入的空 content)

5. 返回 Note 对象
   │
   ▼
6. HomePage 刷新列表
   loadNotesForVolume(volumeId)
   loadVolumesForBook(bookId)
   loadBooks()
```

### 3.2 自动保存流程

```
用户编辑内容
   │
   ▼
CodeMirror updateListener 触发
   │
   ▼
NoteEditor.scheduleSave(content)
   │  清除旧定时器
   │  设置 500ms 防抖定时器
   ▼
NoteEditor.doSave(content)
   │
   ├─ 计算 contentHash，与上次比较（未变则跳过）
   │
   ├─ [加密] encryption.encryptString(content)
   │
   ├─ [原子写入] storage.writeFile(path, encryptedData)
   │
   ├─ [更新索引] database.exec(SQL UPDATE)
   │         ├─ UPDATE notes SET title, word_count, content_hash, updated_at
   │         ├─ UPDATE volumes/books note_count (如有变化)
   │         └─ [FTS5] 触发器 notes_au 自动更新 FTS 索引
   │
   └─ [FTS 内容] database.updateFTSContent(rowid, content)
```

### 3.3 WebDAV 同步流程

```
用户触发同步 / 自动同步
   │
   ▼
sync-engine.syncDrive(config, onProgress, onLog)
   │
   ├─ [1. 生成本地清单]
   │   generateLocalManifest()
   │   ├─ 遍历 Books/ 目录下所有 .note 和 .image 文件
   │   ├─ 计算每个文件的 SHA-256 哈希
   │   └─ 输出 Manifest { files: { path: { hash, size, modified } } }
   │
   ├─ [2. 获取远程清单]
   │   fetchRemoteManifest(client)
   │   └─ GET /localnotes-data/manifest.json → 解析
   │
   ├─ [3. 计算差异]
   │   compareManifests(local, remote)
   │   ├─ toUpload: 本地有且哈希不同的文件
   │   ├─ toDownload: 远程有且哈希不同的文件
   │   └─ toDelete: 远程有但本地无的文件
   │
   ├─ [4. 上传] (文字优先调度)
   │   ├─ 先上传 .note 文件（文字优先）
   │   ├─ 再上传 .image 文件
   │   └─ 单文件失败不中断，记录到 state.errors
   │
   ├─ [5. 下载]
   │   ├─ 下载 toDownload 列表中的文件
   │   └─ 写入本地 OPFS
   │
   ├─ [6. 删除远程多余文件]
   │   └─ DELETE 远程文件
   │
   └─ [7. 上传新清单]
       └─ PUT /localnotes-data/manifest.json
```

### 3.4 图片处理链

```
用户粘贴/拖拽图片
   │
   ▼
CodeMirror paste/drop 事件
   │
   ▼
NoteEditor.handleImageFile(blob)
   │
   ├─ [压缩] image-engine.compressImage(blob)
   │          └─ browser-image-compression → WebP, quality=0.95
   │
   ├─ [加密+存储] image-engine.saveImage(bookId, compressedBlob)
   │          ├─ encryption.encrypt(blob) → [IV][密文]
   │          ├─ storage.writeFile(`Books/${bookId}/images/${imageId}.image`, encrypted)
   │          ├─ database.exec(INSERT INTO images)
   │          └─ 返回 { id, localPath, size }
   │
   ├─ [插入 Markdown] editor.dispatch({
   │          changes: { insert: `![](/images/${imageId}.image)` }
   │          })
   │
   └─ [入队同步] image-engine.enqueueImageSync(image)
              └─ 15 秒延迟后批量同步到 WebDAV
```

---

## 四、模块依赖关系图

```
                    ┌──────────────┐
                    │  main.tsx    │
                    │  App.tsx     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        HomePage.tsx  EditorPage.tsx  (旧页面重定向)
              │            │
              ▼            ▼
        NoteEditor.tsx ◄────┘
              │
    ┌─────────┼──────────┬──────────┐
    ▼         ▼          ▼          ▼
 modals/   note-engine  image-engine  export-engine
 (弹窗)       │            │              │
    │    ┌────┼────┐      │              │
    │    ▼    ▼    ▼      ▼              ▼
    │  storage database encryption  storage  encryption  database
    │    │      │        │
    │    ▼      ▼        ▼
    │  (OPFS) (sql.js) (Web Crypto)
    │
    ▼
 sync-engine ──► storage, database, encryption, webdav
```

**底层模块（无内部依赖）：**
- `storage.ts` — 纯浏览器 OPFS API
- `encryption.ts` — 纯 Web Crypto API

**核心枢纽：**
- `note-engine.ts` — 连接 storage + database + encryption，被所有页面/组件依赖

---

## 五、高风险区域（Top 5）

### 1. `note-engine.ts` — 复杂度 ★★★★★

**风险点：**
- 文件最大（1275 行），25 个导出函数，三级实体 CRUD + 模板 + 回收站 + 搜索
- `permanentDelete` 递归删除书→卷→笔记，任何一步失败可能导致数据不一致
- `saveNote` 原子写入流程（临时文件→重命名）中，`moveFile` 失败时静默忽略
- `deleteNote` 中文件移动失败仍更新数据库，可能导致索引与文件不同步
- `restoreFromTrash` 中文件恢复失败不影响数据库恢复，可能导致"幽灵笔记"（数据库有记录但文件不存在）
- `searchNotes` 的 FTS5→LIKE 降级路径中，两个路径的返回格式需严格一致

**建议：** 拆分为 `book-engine.ts`、`volume-engine.ts`、`note-crud.ts`、`trash-engine.ts`、`search-engine.ts` 等子模块。

### 2. `NoteEditor.tsx` — 复杂度 ★★★★★

**风险点：**
- 12 个 useState + 5 个 useRef + 1 个 useMemo，状态管理复杂
- CodeMirror 6 动态导入（5 个子模块并行加载），导入失败无 fallback
- 自动保存防抖逻辑中，`isExternalUpdate` ref 用于区分用户输入和程序更新，时序敏感
- 图片粘贴/拖拽事件处理中，`handleImageFile` 失败时仅 console.error，用户无感知
- `scheduleSave` 和 `doSave` 的调用链中，竞态条件可能导致旧内容覆盖新内容

**建议：** 将 CodeMirror 逻辑抽取为 `useCodeMirror` 自定义 Hook，将自动保存抽取为 `useAutoSave` Hook。

### 3. `sync-engine.ts` — 复杂度 ★★★★☆

**风险点：**
- manifest 生成/对比/差异计算逻辑复杂，边界条件多
- `restoreFromCloud` 中 `rebuildDatabase` 是空实现（直接抛异常），云端恢复功能不可用
- `generateLocalManifest` 中图片哈希为空字符串（需按需计算），导致图片同步可能不准确
- WebDAV 目录递归创建中，并发创建同一目录时依赖静默忽略错误
- 多网盘并行同步使用 `Promise.allSettled`，但单个网盘内部的文件上传是串行的

**建议：** 优先实现 `rebuildDatabase`，修复图片哈希计算。

### 4. `database.ts` — 复杂度 ★★★☆☆

**风险点：**
- FTS5 触发器写入空 content，依赖 `updateFTSContent` 手动更新，两者存在竞态窗口
- `updateFTSContent` 失败时静默设置 `fts5Available = false`，后续所有 FTS 操作跳过，用户无感知
- `rebuildDatabase` 是空实现，数据库损坏时无法从文件重建（违反底线原则 #8）
- 数据库持久化 `saveDB` 仅在特定时机调用，崩溃可能丢失最近的索引更新

**建议：** 实现 `rebuildDatabase`（遍历 .note 文件→解密→重建索引），增加 FTS5 降级时的用户提示。

### 5. `HomePage.tsx` — 复杂度 ★★★★☆

**风险点：**
- 18 个 useState，组件过于庞大，状态间存在隐式依赖
- `doInit` 初始化流程中，`createBuiltinNotes` 失败被 catch 但不通知用户
- CRUD 操作后需手动调用 2-3 个 load 函数刷新数据，容易遗漏
- `contextMenuTarget` 的右键菜单使用 fixed 定位居中显示（非鼠标位置），体验不佳
- `expandedBookId` 和 `routeBookId` 两个来源可能冲突

**建议：** 使用 `useReducer` 替代多个 `useState`，或将目录树状态抽取为自定义 Hook。

---

## 六、技术栈速查

| 分类 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 18 |
| 语言 | TypeScript | 5.6 |
| 构建 | Vite | 5.4 |
| 样式 | Tailwind CSS | 3 |
| UI 组件 | Radix UI + shadcn/ui | - |
| 编辑器 | CodeMirror 6 | - |
| 数据库 | sql.js (SQLite WASM) | 1.10 |
| 加密 | Web Crypto API (AES-256-CTR) | - |
| 同步 | WebDAV | 5.3 |
| 图片压缩 | browser-image-compression | - |
| 导出 | jszip + 浏览器打印 | - |
| PWA | vite-plugin-pwa | 1.3 |
| 测试 | Vitest + happy-dom | - |
| 包管理 | pnpm | 11.6 |
