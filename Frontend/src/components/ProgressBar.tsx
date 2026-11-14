"use client"

import { motion, useScroll, useSpring } from "framer-motion"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export function ProgressBar() {
    const pathname = usePathname()
    const [isAnimating, setIsAnimating] = useState(false)

    // Purely visual effect on route change
    useEffect(() => {
        setIsAnimating(true)
        const timer = setTimeout(() => setIsAnimating(false), 800)
        return () => clearTimeout(timer)
    }, [pathname])

    return (
        <motion.div
            className="fixed top-0 left-0 right-0 h-0.5 bg-primary z-[100] origin-left"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{
                scaleX: isAnimating ? [0, 0.7, 1] : 0,
                opacity: isAnimating ? 1 : 0
            }}
            transition={{
                duration: isAnimating ? 0.8 : 0.2,
                ease: "easeInOut"
            }}
        />
    )
}
