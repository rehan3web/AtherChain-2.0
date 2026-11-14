import { Loader2 } from "lucide-react"
import { SignupForm } from "@/components/signup-form"
import React from "react"
import logo from '@/assets/blackmode.png';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10 w-full">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <img src={logo.src} alt="AtherChain" className="size-4" />
          </div>
          AtherChain
        </a>
        <React.Suspense fallback={
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        }>
          <SignupForm />
        </React.Suspense>
      </div>
    </div>
  )
}
