"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import api from "@/lib/api"

export const EditUserModal = ({ user, isOpen, onClose, onSuccess }: any) => {
    const [formData, setFormData] = useState({ username: '', email: '', first_name: '', last_name: '', phone: '' })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (user) {
            setFormData({
                username: user.username || '',
                email: user.email || '',
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                phone: user.phone || ''
            })
        }
    }, [user])

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const token = localStorage.getItem('admin_token')
            await api.put(`/admin/users/${user.id}`, formData, { headers: { Authorization: `Bearer ${token}` } })
            onSuccess()
            onClose()
        } catch (error) {
            console.error(error)
            // toast error here ideally
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>
                        Make changes to the user's profile here. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Input placeholder="First Name" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Input placeholder="Last Name" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} />
                        </div>
                    </div>
                    <Input placeholder="Username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                    <Input placeholder="Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    <Input placeholder="Phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>{loading ? "Saving..." : "Save changes"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', variant = 'default' }: any) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{message}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button variant={variant} onClick={onConfirm}>{confirmText}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export const ResetPasswordModal = ({ user, isOpen, onClose, onSuccess }: any) => {
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async () => {
        if (password.length < 6) return // validation
        setLoading(true)
        try {
            const token = localStorage.getItem('admin_token')
            await api.post(`/admin/users/${user.id}/reset-password`, { password }, { headers: { Authorization: `Bearer ${token}` } })
            onSuccess()
            onClose()
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reset Password</DialogTitle>
                    <DialogDescription>
                        Enter a new password for the user.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Input type="text" placeholder="New Password" value={password} onChange={e => setPassword(e.target.value)} />
                    <p className="text-sm text-muted-foreground mt-2">This will force logout the user.</p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button variant="destructive" onClick={handleSubmit} disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
