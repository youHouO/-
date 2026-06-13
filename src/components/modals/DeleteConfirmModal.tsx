import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DeleteConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  description?: string
  confirmLabel?: string
  /** 是否为永久删除（红色按钮 + 更严厉的警告） */
  permanent?: boolean
}

/**
 * 删除确认弹窗（通用）
 * - 普通删除：移至回收站，保留30天
 * - 永久删除：红色按钮，二次确认警告
 */
export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  title = '确认删除',
  description = '删除后将移至回收站，保留30天',
  confirmLabel = '删除',
  permanent: _permanent = false,
}: DeleteConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="pt-2">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            variant='destructive'
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
