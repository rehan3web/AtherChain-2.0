import { Loader } from "@/components/ui/Loader"

export default function Loading() {
    return (
        <div className="h-[calc(100vh-var(--header-height))] w-full flex items-center justify-center">
            <Loader size="lg" />
        </div>
    )
}
