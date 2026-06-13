# 项目进度看板

## 代码生成完成，进入修复阶段

### 当前状态
- MVP 代码已生成，基础功能框架搭建完毕
- 正在进行功能修复和体验优化
- 已记录 7 个待修复问题（搜索功能为主）

### 阶段一：项目初始化与基础搭建 ✅
- Vite 5 + React 18 + TypeScript 5.6
- Tailwind CSS 3 + shadcn/ui
- HashRouter 路由（精简后保留核心路由）
- 全局配置 + 类型定义

### 阶段二：本地核心功能开发 ✅（框架完成，修复中）
- 加密模块（AES-256-CTR） + 存储层（OPFS）
- SQLite 数据库（7 张表 + FTS5 全文索引 + 触发器）
- 笔记引擎（书/卷/笔记 CRUD + 模板管理 + 回收站 + 全文搜索）
- 图片引擎（WebP 压缩 + 加密存储 + 惰性同步队列）
- Zustand 全局状态管理（25+ actions）
- 首页三级内容管理（空状态 → 建书 → 建卷 → 建笔记）
- CodeMirror 6 编辑器 + Markdown 实时预览
- 500ms 无感自动保存 + 图片粘贴/拖拽插入
- 全局搜索（FTS5 + 150ms 防抖 + 关键词高亮 + LIKE 降级）⚠️ 存在 bug，待修复
- 回收站 / 模板管理 / 云盘管理 / 图片设置 / 关于页
- 3 个通用弹窗组件（新建/重命名/删除确认）

### 阶段三：同步引擎开发 ✅（框架完成）
- WebDAV 客户端（webdav 5.3）
- 明文 SHA-256 增量同步（manifest.json）
- 多网盘并行同步 + 文字优先调度
- 原子同步 + 幂等性设计
- 从云端恢复数据 + 图片按需下载
- 同步状态跟踪 + 日志回调 + 连接测试

### 阶段四：导出 / 解密 / PWA / 部署 ✅（框架完成）
- 导出引擎（单笔记 Markdown/PDF + 卷/书/全量 ZIP）
- 独立解密工具（public/decrypt.html，拖入 .note 解密，完全离线）
- PWA 配置（vite-plugin-pwa + Service Worker + manifest.json）
- Cloudflare Pages 部署（GitHub Actions CI/CD）
- 手动代码分割（vendor / codemirror / sql / export-engine）

---

## 项目统计
- **源文件**：31 个（TypeScript + TSX + CSS）
- **依赖包**：753 个
- **总行数**：~6,000+
- **构建产物**：分包后 8 个 JS chunk + 1 CSS
- **最大 chunk**：CodeMirror 610KB (gzip 209KB)
- **零 TypeScript 错误** ✅
- **8 条底线原则全部遵守** ✅
