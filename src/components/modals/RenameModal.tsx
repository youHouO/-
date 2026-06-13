import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface RenameModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (newName: string) => void
  title: string
  currentName: string
}

/**
 * 重命名弹窗（书/卷/笔记通用）
 * 预填当前名称，文字自动全选
 */
export function RenameModal({ open, onClose, onConfirm, title, currentName }: RenameModalProps) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(currentName)
      // 弹窗打开后自动聚焦并全选文字
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 100)
    }
  }, [open, currentName])

  const handleConfirm = () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === currentName) {
      onClose()
      return
    }
    onConfirm(trimmed)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>输入新名称后按 Enter 确认</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-10"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleConfirm} disabled={!name.trim()}>确认</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
