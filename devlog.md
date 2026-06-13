# 开发日志
规则：新记录追加在顶部 | 每月归档旧记录为devlog.YYYYMM.md | 仅保留最近2周记录 | 只记录架构级改动和重大bug，避免重复踩坑

## 2026-06-13（CodeMirror 多实例冲突修复 + 移动端适配 + 接口测试）

### 重大修复：CodeMirror 编辑器多实例冲突
- **根因**：`codemirror` 聚合包在 npm publish 时内联了 `@codemirror/state`，与 Vite 预构建的 `@codemirror/state` 产生多实例冲突，导致编辑器状态异常
- **方案**：彻底移除 `codemirror` 聚合包，改用 `@codemirror/view`、`@codemirror/state` 等独立包手动组装 basicSetup
- **影响**：编辑器核心功能，所有用户都会遇到

### 重大修复：预览模式 CodeMirror DOM 未销毁
- **根因**：条件渲染切换时编辑器 DOM 残留，覆盖 ReactMarkdown 渲染内容
- **方案**：改为 CSS `display` 控制，编辑器和预览容器始终挂载，切换时正确销毁实例
- **影响**：Markdown 预览功能完全不可用

### 移动端适配（架构级改动）
- 侧边栏改为 `fixed` 定位覆盖内容（原 flex 挤压导致内容变形）
- 遮罩层与侧边栏 z-index 层级重新设计（`z-40` vs `z-50`）
- 顶部栏移动端精简：标题隐藏、搜索图标化
- 更多菜单从 hover 改为 click toggle（移动端触摸设备无法触发 hover）

### 接口测试
- 创建 vitest 单元测试框架
- 编写 note-engine.test.ts，22 个测试用例全部通过
- Mock 策略：storage、database、encryption 模块全部 mock

### 教训
- Tailwind 任意值 `bg-[...]` 中避免空格，优先使用标准颜色类
- SPA 应用内不需要"返回首页"按钮
- 移动端顶部栏元素过多时应精简而非压缩

### Git 提交
```
fix(codemirror): 彻底修复 @codemirror/state 多实例冲突
fix(preview): 修复预览模式CodeMirror DOM未正确销毁问题
fix(search): 修复搜索回调未传递keyword/matchLine + onClick触发
feat(mobile): 侧边栏fixed定位/遮罩层/顶部栏精简/更多菜单点击
feat(mobile): 搜索框响应式/弹窗边距/导出grid/目录定位
test: 添加note-engine单元测试（22个用例）
```

---

## 2026-06-13（Bug 修复总结 - 共修复 27 个 Bug）

### 今日修复总览

| 批次 | 修复 Bug | 数量 | 优先级 |
|------|----------|------|--------|
| 初始修复 | CodeMirror 多实例冲突、#1/#3/#6/#13 | 5 | P0/P1 |
| 批次1 | #2/#3/#15/#16/#17 | 5 | P0/P1 |
| 批次2 | #7/#8/#9/#10 | 4 | P1 |
| 批次3 | #26/#28/#31/#32/#33/#34/#35/#36 | 8 | P2 |
| 批次4 | #18/#22/#24/#25 | 4 | P2 |
| 批次5 | #29/#30/#37/#38/#39/#40 | 6 | P2/P3 |
| **总计** | | **27** | |

### 关键修复

**P0 修复（4个）**
- #1: note-engine.ts `db.exec` 链式访问添加安全检查
- #2: sync-engine.ts `new Uint8Array(content as ArrayBuffer)` 改为 `instanceof` 检查
- #3: sync-engine.ts 云端恢复哈希验证改为文件大小验证
- #4: NoteEditor.tsx CodeMirror 多实例冲突（动态导入缓存统一）

**P1 修复（8个）**
- #6: image-engine.ts setTimeout 中 async 添加 `.catch()`
- #7: SettingsModal 回收站子页面对接后端 API
- #8: SettingsModal 模板管理对接后端 API
- #9: SettingsModal 云盘表单添加用户名/密码输入框
- #10: export-engine.ts ZIP 导出添加图片复制逻辑
- #13: encryption.ts `getKey()`/`sha256()` 添加 try-catch
- #15: database.ts `initSQL()` 添加 try-catch
- #16: database.ts `saveDB()` 添加 try-catch
- #17: export-engine.ts PDF 导出添加 `printWindow.closed` 检查

**P2 修复（12个）**
- #18: SearchModal 添加 localStorage 搜索历史（最近10条）
- #22: NoteEditor 删除后显示 Toast "已移至回收站" + 返回上一级
- #24: SearchModal 默认搜索范围改为 "全部书"
- #25: SettingsModal 图片设置添加警告文字
- #26: sync-engine.ts `crypto.randomUUID()` 添加 try-catch + 回退
- #28: NoteEditor.tsx `initEditor()` 添加 `.catch()`
- #29: image-engine.ts 添加 `revokeImageUrl()` 防止内存泄漏
- #30: note-engine.ts `saveNote()` 添加 `.backup` 备份机制
- #31: export-engine.ts 硬编码列索引改为按列名取值
- #32: main.tsx `getElementById('root')!` 添加 null 检查
- #33: note-engine.ts 链式访问添加可选链保护
- #34: storage.ts `moveFile` 添加 `lastSlash > 0` 检查
- #35: image-engine.ts `listBookImages()` 添加 try-catch
- #36: export-engine.ts `exportNoteAsMarkdown()` 添加 try-catch
- #37: storage.ts 原子写入通过备份机制修复

**P3 修复（3个）**
- #38: note-engine.ts SQL 表名拼接添加白名单校验
- #39: export-engine.ts 延迟 1 秒释放 URL.createObjectURL
- #40: NoteEditor.tsx `setInterval` catch 添加 `console.warn`

### 剩余问题（下次处理）

| 优先级 | Bug | 说明 |
|--------|-----|------|
| P0 | #4 | 存储位置 OPFS vs 系统公共文档目录（架构决策） |
| P1 | #5 | 软删除机制：数据库负时间戳 vs 纯文件系统 `.trash` |
| P1 | #11 | 图片提前同步逻辑未实现 |
| P1 | #12 | 退出笔记时未同步图片提示 |
| P1 | #14 | `exportRawKey()` 无 try-catch |
| P2 | #19 | 按创建时间排序 |
| P2 | #23 | 手动同步触发同步 |
| P3 | #41-#45 | 边界情况 |
| 环境 | #46/#47 | ESLint 配置损坏、无测试用例 |

### Git 提交记录
```
8464879 fix(batch5): 修复 P3 + 其他低优先级 Bug（6个）
e7b16bf fix(batch4): 修复 P2 需求不符 Bug（4个）
d1682c6 fix(batch3): 修复 P2 运行时异常（8个bug）
c38228f fix(batch2): 修复 P1 需求不符 Bug（回收站/模板/云盘表单/ZIP导出）
b8225d0 fix(batch1): 修复 P0 剩余 Bug + P1 运行时异常
```
