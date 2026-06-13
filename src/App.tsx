import { Routes, Route, Navigate } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { EditorPage } from '@/pages/EditorPage'

/**
 * 应用根组件
 * HashRouter 在 main.tsx 中配置
 *
 * 所有操作都在首页内通过弹窗完成，不再跳转子页面。
 * 旧的路由保留重定向兼容。
 */
function App() {
  return (
    <Routes>
      {/* 首页及三级内容浏览 */}
      <Route path="/" element={<HomePage />} />
      <Route path="/book/:bookId" element={<HomePage />} />
      <Route path="/volume/:volumeId" element={<HomePage />} />

      {/* 笔记编辑（全屏模式） */}
      <Route path="/editor/:noteId" element={<EditorPage />} />

      {/* 旧路由重定向到首页 */}
      <Route path="/search" element={<Navigate to="/" replace />} />
      <Route path="/settings" element={<Navigate to="/" replace />} />
      <Route path="/settings/trash" element={<Navigate to="/" replace />} />
      <Route path="/settings/templates" element={<Navigate to="/" replace />} />
      <Route path="/settings/cloud" element={<Navigate to="/" replace />} />
      <Route path="/settings/images" element={<Navigate to="/" replace />} />
      <Route path="/settings/about" element={<Navigate to="/" replace />} />

      {/* 404 兜底 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
