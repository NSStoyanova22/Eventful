"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      richColors
      closeButton
      duration={4500}
      className="toaster group"
      toastOptions={{
        className:
          "group rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/90 via-blue-900/80 to-slate-900/90 px-5 py-4 text-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.45)] backdrop-blur-xl",
        classNames: {
          toast:
            "group toast !bg-transparent !text-white",
          description: "group-[.toast]:text-slate-200/85 text-sm",
          actionButton:
            "group-[.toast]:rounded-full group-[.toast]:bg-white group-[.toast]:px-4 group-[.toast]:py-1.5 group-[.toast]:text-sm group-[.toast]:font-semibold group-[.toast]:text-slate-900",
          cancelButton:
            "group-[.toast]:rounded-full group-[.toast]:bg-slate-800/70 group-[.toast]:px-4 group-[.toast]:py-1.5 group-[.toast]:text-slate-200",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
