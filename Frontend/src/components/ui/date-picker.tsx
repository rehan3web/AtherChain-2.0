"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export function DatePicker({
    value,
    onChange,
    placeholder = "Pick a date",
    className,
}: {
    value?: string | Date
    onChange?: (date: Date | undefined) => void
    placeholder?: string
    className?: string
}) {
    const [date, setDate] = React.useState<Date | undefined>(
        value ? new Date(value) : undefined
    )

    // Sync internal state with prop
    React.useEffect(() => {
        if (value) {
            setDate(new Date(value))
        } else {
            setDate(undefined)
        }
    }, [value])

    const handleSelect = (selectedDate: Date | undefined) => {
        setDate(selectedDate)
        if (onChange) {
            onChange(selectedDate)
        }
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal h-14 rounded-none border-b border-t-0 border-l-0 border-r-0 border-border bg-transparent px-0 hover:bg-transparent hover:border-foreground transition-colors",
                        !date && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>{placeholder}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-border bg-card shadow-2xl" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleSelect}
                    initialFocus
                    captionLayout="dropdown"
                    fromYear={1930}
                    toYear={2100}
                    className="bg-card text-foreground"
                    classNames={{
                        day_selected: "bg-foreground text-background hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background",
                        day_today: "bg-secondary text-foreground",
                    }}
                />
            </PopoverContent>
        </Popover>
    )
}
