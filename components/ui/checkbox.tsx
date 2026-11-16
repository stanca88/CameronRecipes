"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function CheckboxIndicator({
  checked,
  className,
  backgroundColor,
  checkedBackgroundColor,
  borderColor,
  borderless = false,
}: {
  checked: boolean
  className?: string
  backgroundColor?: string
  checkedBackgroundColor?: string
  borderColor?: string
  borderless?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      data-checked={checked}
      style={{
        backgroundColor: checked ? checkedBackgroundColor : backgroundColor,
        borderColor,
        ...(borderless ? { border: "none" } : {}),
      }}
      className={cn(
        "checkbox-indicator grid size-6 shrink-0 place-items-center",
        className
      )}
    >
      {checked && <CheckIcon className="size-4" />}
    </span>
  )
}

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-6 shrink-0 rounded-full border border-[#aebdc2] bg-white text-transparent transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-[#d5e0e3] data-[state=checked]:bg-[#d5e0e3] data-[state=checked]:text-[#111613]",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox, CheckboxIndicator }
