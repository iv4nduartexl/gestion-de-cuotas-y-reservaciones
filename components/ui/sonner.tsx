"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Light theme only for now (the app has no theme switcher).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-center"
      icons={{
        success: <CircleCheckIcon className="size-4 text-[#86efac]" />,
        info: <InfoIcon className="size-4 text-[#93c5fd]" />,
        warning: <TriangleAlertIcon className="size-4 text-[#fcd34d]" />,
        error: <OctagonXIcon className="size-4 text-[#fca5a5]" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--foreground)",
          "--normal-text": "var(--background)",
          "--normal-border": "transparent",
          "--border-radius": "calc(var(--radius) * 1.2)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast font-sans font-semibold shadow-lift",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
