'use client';

import React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import countries from 'world-countries';

interface CountrySelectProps {
    value: string;
    onChange: (country: { name: string; code: string; flag: string }) => void;
    className?: string;
}

const options = countries.map(c => ({
    value: c.cca2,
    label: c.name.common,
    flag: c.flag,
    cca2: c.cca2
})).sort((a, b) => a.label.localeCompare(b.label));

export function CountrySelect({ value, onChange, className }: CountrySelectProps) {
    const [open, setOpen] = React.useState(false);
    const selectedCountry = options.find((framework) => framework.value === value || framework.label === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm font-normal ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        !value && "text-muted-foreground",
                        className
                    )}
                >
                    {selectedCountry ? (
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{selectedCountry.flag}</span>
                            <span className="text-foreground">{selectedCountry.label}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">Select country</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0 bg-card border-border text-foreground" align="start">
                <Command className="bg-card text-foreground">
                    <CommandInput placeholder="Search country..." className="border-none focus:ring-0 text-foreground placeholder:text-muted-foreground/60" />
                    <CommandList className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        <CommandEmpty className="py-2 text-center text-sm text-muted-foreground">No country found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((country) => (
                                <CommandItem
                                    key={country.value}
                                    value={country.label}
                                    onSelect={() => {
                                        onChange({
                                            name: country.label,
                                            code: country.cca2,
                                            flag: country.flag
                                        });
                                        setOpen(false);
                                    }}
                                    className="data-[selected=true]:bg-secondary data-[selected=true]:text-foreground cursor-pointer"
                                >
                                    <div className="flex items-center gap-2 w-full">
                                        <span className="text-lg">{country.flag}</span>
                                        <span>{country.label}</span>
                                        {value === country.value && (
                                            <Check className="ml-auto h-4 w-4 text-foreground" />
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
