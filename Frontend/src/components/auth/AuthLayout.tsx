import { ReactNode } from 'react';
import { Zap } from "lucide-react"
import logo from '@/assets/blackmode.png';
interface AuthLayoutProps {
    children: ReactNode;
    title: string;
    description: string;
}

export default function AuthLayout({ children, title, description }: AuthLayoutProps) {

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10 w-full">
            <div className="flex w-full max-w-sm flex-col gap-6">
                <a href="#" className="flex items-center gap-2 self-center font-medium">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <img src={logo.src} alt="AtherChain" className="size-4" />
                    </div>
                    AtherChain
                </a>
                <div className="flex flex-col gap-6">
                    {children}
                </div>
            </div>
        </div>
    );
}
