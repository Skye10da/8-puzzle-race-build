'use client'

import { useEffect, useRef } from 'react'

type Props = { open: boolean; onCancel: () => void; onConfirm: () => void }

export function RestartDialog({ open, onCancel, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return <dialog ref={dialogRef} className="help-card restart-dialog" aria-labelledby="restart-dialog-title" onCancel={event => { event.preventDefault(); onCancel() }}><span className="kicker">RACE CONTROL</span><h2 id="restart-dialog-title">Restart this race?</h2><p>Others are still racing. Restart for everyone?</p><div className="restart-dialog-actions"><button ref={cancelRef} className="secondary" onClick={onCancel}>Cancel</button><button className="primary" onClick={onConfirm}>Restart</button></div></dialog>
}
