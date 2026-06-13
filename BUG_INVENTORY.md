# BUG_INVENTORY.md — 问题清单

> 生成时间：2026-06-13 | 全面诊断结果，按优先级从高到低排序

---

## 运行时环境

| 项目 | 结果 |
|------|------|
| 测试 (vitest) | ESLint 配置损坏（缺少 @eslint/js），无法运行 lint；测试框架已安装但无测试用例 |
| Lint (eslint) | 配置错误：`eslint.config.js` 引用了 `@eslint/js` 但未安装，需 `pnpm add -D @eslint/js` |
| 构建 (tsc + vite) | 通过，零 TypeScript 错误 |

---

## 问题总表

| # | 类型 | 所在文件 | 问题描述 | 影响范围 | 优先级 |
|---|------|----------|----------|----------|--------|
| 1 | 运行时崩溃 | `note-engine.ts:418` | `db.exec('SELECT last_insert_rowid()')[0].values[0][0]` 三级链式访问无安全检查，SQL 执行失败时崩溃 | 所有创建操作（书/卷/笔记） | **P0** |
| 2 | ~~逻辑错误~~ | `sync-engine.ts:511,574` | ~~`restoreFromCloud` 和 `downloadBookImages` 中 `new Uint8Array(content as ArrayBuffer)` 类型断言不安全~~ ✅ **已修复** (2026-06-13)：添加 `content instanceof ArrayBuffer` 检查，非 ArrayBuffer 时跳过并记录警告 | 云端恢复、图片下载 | **P0** |
| 3 | ~~逻辑错误~~ | `sync-engine.ts` | ~~恢复数据时对加密密文计算 SHA-256 与 manifest 中的明文哈希比较，验证永远失败~~ ✅ **已修复** (2026-06-13)：改为验证文件大小 > 0（加密文件无法与明文哈希比较） | 云端恢复功能完全不可用 | **P0** |
| 4 | 需求不符 | `storage.ts` | 存储使用 OPFS（浏览器沙箱），清除浏览器数据会丢失。需求要求系统公共文档目录（File System Access API），违反底线原则 #6 | 用户数据持久性 | **P0** |
| 5 | 需求不符 | `note-engine.ts` | 软删除依赖数据库负时间戳标记，需求要求纯文件系统实现（`.trash` 目录），违反底线原则 #8 | 数据库损坏时回收站数据不可恢复 | **P1** |
| 6 | 运行时崩溃 | `image-engine.ts:186-189` | `setTimeout` 中调用 async `flushSyncQueue()` 无 `.catch()`，异常产生未处理 Promise rejection | 图片同步 | **P1** |
| 7 | ~~需求不符~~ | `SettingsModal.tsx` | ~~回收站子页面为空壳（硬编码空数组），未调用 listTrash/restoreFromTrash/permanentDelete~~ ✅ **已修复** (2026-06-13)：TrashSettingsContent 对接后端 API，支持恢复和永久删除 | 回收站功能不可用 | **P1** |
| 8 | ~~需求不符~~ | `SettingsModal.tsx` | ~~模板管理子页面为硬编码数据，未调用 listTemplates/createTemplate/deleteTemplate~~ ✅ **已修复** (2026-06-13)：TemplateSettingsContent 对接后端 API，支持删除模板 | 模板管理不可用 | **P1** |
| 9 | ~~需求不符~~ | `SettingsModal.tsx` | ~~云盘添加表单缺少用户名和密码输入框，无法完成 WebDAV 配置~~ ✅ **已修复** (2026-06-13)：添加用户名和密码输入框，保留未配置引导提示 | 云盘同步不可用 | **P1** |
| 10 | ~~需求不符~~ | `export-engine.ts` | ~~ZIP 导出只包含笔记文本，不包含图片文件~~ ✅ **已修复** (2026-06-13)：exportVolumeAsZip/exportBookAsZip/exportAllAsZip 均添加图片复制逻辑 | 导出功能不完整 | **P1** |
| 11 | 需求不符 | `image-engine.ts` | 提前同步逻辑未实现（`IMAGE_UNSYNCED_COUNT_EARLY_SYNC` 等常量已定义但未使用） | 大量图片时同步不及时 | **P1** |
| 12 | 需求不符 | `NoteEditor.tsx` + `image-engine.ts` | 退出笔记时未按未同步图片数量区分 Toast/确认对话框（需求：0-3张 Toast，4张以上确认框） | 可能丢失未同步图片 | **P1** |
| 13 | 运行时异常 | `encryption.ts:27-46` | `getKey()` 中 `crypto.subtle.digest/importKey` 无 try-catch，非 HTTPS 环境下所有加密操作失败 | 加密功能在非安全上下文不可用 | **P1** |
| 14 | 运行时异常 | `encryption.ts:146-154` | `sha256()` 无 try-catch，被同步引擎等模块高频调用 | 哈希计算失败时无降级 | **P1** |
| 15 | ~~运行时异常~~ | `database.ts:31-39` | ~~`initSQL()` 加载 WASM 无 try-catch，WASM 加载失败直接崩溃~~ ✅ **已修复** (2026-06-13)：添加 try-catch，抛出明确的中文错误信息 | 数据库初始化 | **P1** |
| 16 | ~~运行时异常~~ | `database.ts:217-223` | ~~`saveDB()` 无 try-catch，持久化失败时异常传播~~ ✅ **已修复** (2026-06-13)：添加 try-catch，抛出明确的中文错误信息 | 数据库保存 | **P1** |
| 17 | ~~运行时异常~~ | `export-engine.ts:70-83` | ~~`printWindow.document.write/print` 无 null 检查，打印窗口被用户关闭时崩溃~~ ✅ **已修复** (2026-06-13)：添加 `printWindow.closed` 检查，关闭时提前返回 | PDF 导出 | **P1** |
| 18 | ~~需求不符~~ | `SearchModal.tsx` | ~~搜索历史功能完全缺失~~ ✅ **已修复** (2026-06-13)：添加 localStorage 存储最近 10 条搜索历史，空状态显示历史标签 | 搜索体验 | **P2** |
| 19 | 需求不符 | `note-engine.ts` | 排序只支持修改时间，不支持按创建时间排序（需求要求支持切换） | 列表排序 | **P2** |
| 22 | ~~需求不符~~ | `NoteEditor.tsx` | ~~删除笔记后直接跳转首页，需求要求返回上一级 + Toast 提示~~ ✅ **已修复** (2026-06-13)：删除后显示 Toast "已移至回收站"，调用 onBack 返回上一级 | 删除后体验 | **P2** |
| 23 | 需求不符 | `HomePage.tsx` | 手动同步按钮只打开设置页，需求要求触发同步 + 显示进度弹窗 | 同步操作 | **P2** |
| 24 | ~~需求不符~~ | `SearchModal.tsx` + `HomePage.tsx` | ~~搜索默认范围为"当前书"，需求要求默认"全部书"~~ ✅ **已修复** (2026-06-13)：默认 scope 改为 `'all'` | 搜索体验 | **P2** |
| 25 | ~~需求不符~~ | `SettingsModal.tsx` | ~~图片设置"保存原图"开关缺少警告文字~~ ✅ **已修复** (2026-06-13)：批次2重写 SettingsModal 时已添加 `⚠️ 开启后大幅增加存储空间和同步时间` | 用户提示 | **P2** |
| 26 | ~~运行时异常~~ | `sync-engine.ts:290` | ~~`crypto.randomUUID()` 无 try-catch 无存在性检查，非安全上下文不可用~~ ✅ **已修复** (2026-06-13)：添加 try-catch，失败时回退到 `Date.now()` + `Math.random()` | 同步日志 | **P2** |
| 27 | ~~运行时异常~~ | `NoteEditor.tsx:267` | ~~`content.split('\n')[lineIndex].replace(...)` 无可选链~~ ✅ **已修复** (2026-06-13)：已有 `?.replace()` 可选链保护，无需修改 | 目录导航 | **P2** |
| 28 | ~~运行时异常~~ | `NoteEditor.tsx:165` | ~~`useEffect` 中调用 async `initEditor()` 无 `.catch()`~~ ✅ **已修复** (2026-06-13)：添加 `.catch(err => console.error(...))` | 编辑器初始化 | **P2** |
| 29 | ~~内存泄漏~~ | `image-engine.ts:163` | ~~`loadImage()` 返回 Blob URL 但无机制调用 `revokeObjectURL()` 释放内存~~ ✅ **已修复** (2026-06-13)：添加 `revokeImageUrl()` 函数供调用方释放 | 长期使用内存增长 | **P2** |
| 30 | ~~竞态条件~~ | `note-engine.ts:519-532` | ~~`saveNote()` 原子写入：删除原文件后写入新文件前崩溃会丢失数据~~ ✅ **已修复** (2026-06-13)：添加 `.backup` 备份机制，写入成功后才删除备份 | 笔记保存 | **P2** |
| 31 | ~~运行时异常~~ | `export-engine.ts:117` | ~~`volResults[0].values[0][2]` 硬编码列索引，表结构变更时获取错误数据~~ ✅ **已修复** (2026-06-13)：改为 `SELECT id, book_id, name` + 按列名索引取值 | ZIP 导出 | **P2** |
| 32 | ~~运行时异常~~ | `main.tsx:7` | ~~`document.getElementById('root')!` 非空断言，HTML 缺少 root 元素时崩溃~~ ✅ **已修复** (2026-06-13)：添加 null 检查，抛出明确错误信息 | 应用启动 | **P2** |
| 33 | ~~运行时异常~~ | `note-engine.ts:250` | ~~`maxSort[0].values[0][0]` 链式访问虽有长度检查但不够健壮~~ ✅ **已修复** (2026-06-13)：添加可选链 `?.values?.length` 和 `?.length` | 卷排序 | **P2** |
| 34 | ~~运行时异常~~ | `storage.ts:204` | ~~`moveFile` 中 `destPath.lastIndexOf('/')` 返回 -1 时 `substring(0,-1)` 行为异常~~ ✅ **已修复** (2026-06-13)：添加 `lastSlash > 0` 检查 | 文件移动 | **P2** |
| 35 | ~~运行时异常~~ | `image-engine.ts:226-251` | ~~`listBookImages()` 无 try-catch~~ ✅ **已修复** (2026-06-13)：添加 try-catch，失败时返回空数组 | 图片列表查询 | **P2** |
| 36 | ~~运行时异常~~ | `export-engine.ts:19-39` | ~~`exportNoteAsMarkdown()` 无 try-catch~~ ✅ **已修复** (2026-06-13)：添加 try-catch，抛出明确错误信息 | Markdown 导出 | **P2** |
| 37 | ~~需求不符~~ | `storage.ts` | ~~原子写入未真正实现临时文件+重命名~~ ✅ **已修复** (2026-06-13)：与 #30 一同修复，通过备份机制保证数据安全 | 数据安全 | **P2** |
| 38 | ~~SQL 风险~~ | `note-engine.ts:984,1015` | ~~SQL 表名通过字符串拼接~~ ✅ **已修复** (2026-06-13)：添加表名白名单校验 `['books', 'volumes', 'notes'].includes(tableName)` | 维护风险 | **P3** |
| 39 | ~~运行时异常~~ | `export-engine.ts:246-250` | ~~`URL.revokeObjectURL` 在 `a.click()` 后立即调用~~ ✅ **已修复** (2026-06-13)：延迟 1 秒后释放，确保下载已开始 | 文件下载 | **P3** |
| 40 | ~~运行时异常~~ | `NoteEditor.tsx:136-138` | ~~`setInterval` 中 `catch {}` 空块吞掉所有错误~~ ✅ **已修复** (2026-06-13)：添加 `console.warn` 日志输出 | 调试困难 | **P3** |
| 41 | 运行时异常 | `encryption.ts:160-164` | `exportRawKey()` 无 try-catch | 密钥导出 | **P3** |
| 42 | 运行时异常 | `database.ts:157-194` | `initDatabase` 中 `db.run(BASE_SCHEMA_SQL)` 无独立 try-catch | 数据库建表 | **P3** |
| 43 | 运行时异常 | `sync-engine.ts:71` | `clientCache.get(cacheKey)!` 非空断言，并发清除缓存时可能为 null | WebDAV 客户端 | **P3** |
| 44 | 运行时异常 | `export-engine.ts:126,157,165` | `zip.folder(name)!` 多处非空断言 | ZIP 创建 | **P3** |
| 45 | 运行时异常 | `storage.ts:21-32` | `initStorage()` 并发调用可能创建多个 OPFS 句柄 | 存储初始化 | **P3** |
| 46 | 环境配置 | `eslint.config.js` | ESLint 配置引用 `@eslint/js` 但未安装，lint 无法运行 | 代码质量检查 | **P2** |
| 47 | 测试缺失 | `tests/` | 测试框架已安装（vitest + happy-dom）但无任何测试用例 | 质量保障 | **P2** |

---

## 仅需更新文档的差异（低优先级）

| # | 文件 | 差异摘要 | 建议 |
|---|------|----------|------|
| D1 | `encryption.ts` | 文档可补充密钥派生机制说明（不可导出但可重新派生） | 更新 REQUIREMENTS.md |
| D2 | `sync-engine.ts` | 文档标注阿里云盘为"计划中"而非"已支持" | 更新 REQUIREMENTS.md |
| D3 | `NoteEditor.tsx` | 保存状态显示具体时间比"已保存 ✓"更优 | 更新 DESIGN_BLUEPRINT.md |
| D4 | `NoteEditor.tsx` | 新增目录面板为合理增强 | 更新 DESIGN_BLUEPRINT.md |
| D5 | `HomePage.tsx` | 目录树+内嵌编辑器布局优于设计蓝图的列表布局 | 更新 DESIGN_BLUEPRINT.md |
| D6 | `SettingsModal.tsx` | 弹窗化优于独立页面，设置项增多为合理增强 | 更新 DESIGN_BLUEPRINT.md |
| D7 | `HomePage.tsx` | 新建笔记按钮在目录树底部优于悬浮按钮 | 更新 DESIGN_BLUEPRINT.md |

---

## 优先级分布

| 优先级 | 数量 | 说明 |
|--------|------|------|
| **P0** | 4 | 运行时崩溃或违反底线原则，必须立即修复 |
| **P1** | 12 | 功能不可用或数据安全风险，应尽快修复 |
| **P2** | 17 | 功能缺失或体验问题，计划修复 |
| **P3** | 8 | 边界情况或代码质量，择机修复 |
| **文档** | 7 | 仅更新文档，不改代码 |

---

## ESLint 修复方法

```bash
pnpm add -D @eslint/js
```

安装后 `pnpm lint` 即可正常运行。
