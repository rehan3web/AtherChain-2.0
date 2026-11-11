"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Send, BellRing, Zap, PickaxeIcon } from "lucide-react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAlert } from "@/providers/AlertProvider"

const formSchema = z.object({
    title: z.string().min(2, {
        message: "Title must be at least 2 characters.",
    }),
    message: z.string().min(10, {
        message: "Message must be at least 10 characters.",
    }),
})

const testPushSchema = z.object({
    userId: z.string().optional(),
    title: z.string().optional(),
    message: z.string().optional(),
})

export default function AdminNotificationsPage() {
    const [loading, setLoading] = useState(false)
    const [testLoading, setTestLoading] = useState(false)
    const [miningLoading, setMiningLoading] = useState(false)
    const [miningResult, setMiningResult] = useState<any>(null)
    const { showAlert } = useAlert()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            message: "",
        },
    })

    const testForm = useForm<z.infer<typeof testPushSchema>>({
        resolver: zodResolver(testPushSchema),
        defaultValues: {
            userId: "",
            title: "",
            message: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setLoading(true)
        try {
            await api.post('/admin/notifications/broadcast', values)
            showAlert('success', 'Broadcast sent successfully')
            form.reset()
        } catch (error) {
            console.error(error)
            showAlert('danger', 'Failed to send broadcast')
        } finally {
            setLoading(false)
        }
    }

    async function onTestPush(values: z.infer<typeof testPushSchema>) {
        setTestLoading(true)
        try {
            const payload: any = {}
            if (values.userId?.trim()) payload.userId = values.userId.trim()
            if (values.title?.trim()) payload.title = values.title.trim()
            if (values.message?.trim()) payload.message = values.message.trim()

            const res = await api.post('/admin/notifications/test-push', payload)
            showAlert('success', `Test push sent to ${res.data.devicesTargeted} device(s)`)
            testForm.reset()
        } catch (error: any) {
            console.error(error)
            showAlert('danger', error?.response?.data?.message || 'Failed to send test push')
        } finally {
            setTestLoading(false)
        }
    }

    async function triggerMiningReminders() {
        setMiningLoading(true)
        setMiningResult(null)
        try {
            const res = await api.post('/admin/notifications/trigger-mining-reminders')
            setMiningResult(res.data)
            showAlert('success', `Mining reminders: ${res.data.sent} sent, ${res.data.failed} failed`)
        } catch (error) {
            console.error(error)
            showAlert('danger', 'Failed to trigger mining reminders')
        } finally {
            setMiningLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
                    <p className="text-muted-foreground">Broadcast messages, test push, and mining reminders.</p>
                </div>
            </div>

            {/* Broadcast Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BellRing className="h-5 w-5" />
                        Send Broadcast
                    </CardTitle>
                    <CardDescription>
                        This will send a notification to ALL registered users immediately.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Title</FormLabel>
                                        <FormControl>
                                            <Input placeholder="System Update" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            The headline of the notification.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="message"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Message</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="We have updated the mining protocol..."
                                                className="min-h-[100px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            The detailed body text.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={loading}>
                                {loading ? "Sending..." : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" /> Send Broadcast
                                    </>
                                )}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {/* Test Push Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Test Push Notification
                    </CardTitle>
                    <CardDescription>
                        Send a test push to a specific user (by User ID) or to all devices if left blank.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...testForm}>
                        <form onSubmit={testForm.handleSubmit(onTestPush)} className="space-y-6">
                            <FormField
                                control={testForm.control}
                                name="userId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>User ID (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Leave blank to send to all devices" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            Target a specific user by their UUID, or leave blank for all.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={testForm.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Title (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="🔔 Test Notification" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={testForm.control}
                                name="message"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Message (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="This is a test push notification..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={testLoading} variant="secondary">
                                {testLoading ? "Sending..." : (
                                    <>
                                        <Zap className="mr-2 h-4 w-4" /> Send Test Push
                                    </>
                                )}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {/* Mining Reminder Trigger Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PickaxeIcon className="h-5 w-5" />
                        Mining Completion Reminders
                    </CardTitle>
                    <CardDescription>
                        Manually trigger the mining completion check. This runs automatically every 1 hour via cron,
                        but you can trigger it now to test.
                        It sends push notifications to users whose mining timer has expired.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button
                        onClick={triggerMiningReminders}
                        disabled={miningLoading}
                        variant="outline"
                    >
                        {miningLoading ? "Running..." : (
                            <>
                                <PickaxeIcon className="mr-2 h-4 w-4" /> Trigger Mining Reminders Now
                            </>
                        )}
                    </Button>

                    {miningResult && (
                        <div className="rounded-lg border p-4 space-y-2 text-sm">
                            <p><strong>Eligible Users:</strong> {miningResult.eligibleUsers}</p>
                            <p><strong>Sent:</strong> {miningResult.sent}</p>
                            <p><strong>Failed:</strong> {miningResult.failed}</p>
                            {miningResult.details?.length > 0 && (
                                <div className="mt-2">
                                    <p className="font-medium mb-1">Details:</p>
                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                        {miningResult.details.map((d: any, i: number) => (
                                            <p key={i} className={d.success ? "text-green-600" : "text-red-500"}>
                                                {d.success ? "✅" : "❌"} {d.username} ({d.userId.slice(0, 8)}...)
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
