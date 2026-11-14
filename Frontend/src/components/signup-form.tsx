"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import api from "@/lib/api"
import { useAlert } from "@/providers/AlertProvider"
import { CountrySelect } from "@/components/ui/CountrySelect"
import FingerprintJS from '@fingerprintjs/fingerprintjs'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const signupSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  country: z.string().min(1, "Country is required"),
  referralCode: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  visitorId: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

import { useSearchParams } from "next/navigation"

export function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const { showAlert } = useAlert()
  const [visitorId, setVisitorId] = useState<string>('')
  const [step, setStep] = useState(1)

  useEffect(() => {
    const setFp = async () => {
      try {
        const fp = await FingerprintJS.load()
        const result = await fp.get()
        setVisitorId(result.visitorId)
        localStorage.setItem('device_id', result.visitorId)
      } catch (error) {
        console.error('Fingerprint generation failed', error)
      }
    }

    const storedDeviceId = localStorage.getItem('device_id')
    if (storedDeviceId) {
      setVisitorId(storedDeviceId)
    } else {
      setFp()
    }
  }, [])

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      phone: "",
      country: "",
      referralCode: "",
      password: "",
      confirmPassword: "",
    },
  })

  useEffect(() => {
    const refCode = searchParams.get('ref')
    if (refCode) {
      form.setValue('referralCode', refCode)
    }
  }, [searchParams, form])

  const handleNext = async () => {
    const isValid = await form.trigger(['firstName', 'lastName', 'username', 'email'])
    if (isValid) {
      setStep(2)
    }
  }

  async function onSubmit(values: z.infer<typeof signupSchema>) {
    setLoading(true)
    try {
      let currentVisitorId = visitorId
      if (!currentVisitorId) {
        const fp = await FingerprintJS.load()
        const result = await fp.get()
        currentVisitorId = result.visitorId
        setVisitorId(currentVisitorId)
        localStorage.setItem('device_id', currentVisitorId)
      }

      if (!currentVisitorId) {
        throw new Error("Device verification failed. Ad-blocker might be interfering.")
      }

      const payload = { ...values, deviceId: currentVisitorId }
      await api.post('/auth/register', payload)

      localStorage.setItem('unverified_email', values.email)
      showAlert('success', 'Registration Successful!')
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`)
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Registration failed';
      if (!(err.response?.status === 500) && !errorMessage.includes("Network")) {
        showAlert('error', errorMessage);
      } else {
        showAlert('danger', 'Server error, try again later');
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mx-auto max-w-sm w-full">
      <CardHeader>
        <CardTitle className="text-xl">Sign Up</CardTitle>
        <CardDescription>
          Enter your information to create an account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="johndoe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="m@example.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="button" className="w-full" onClick={handleNext}>
                  Next Step
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <CountrySelect
                          value={field.value}
                          onChange={(c) => field.onChange(c.name)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+1234567890" type="tel" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="referralCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referral Code (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="REF123"
                            {...field}
                            disabled={!!searchParams.get('ref')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex w-full gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(1)}
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Creating..." : "Sign Up"}
                  </Button>
                </div>
              </>
            )}
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <a href="/login" className="underline">
                Sign in
              </a>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
