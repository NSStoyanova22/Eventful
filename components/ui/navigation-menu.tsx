'use client'
import * as React from "react"
import { useEffect, useState } from 'react';
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu"
import { cva } from "class-variance-authority"
import { ChevronDown, Search } from "lucide-react"
import Link from "next/link"
import "@/app/script"
import { cn } from "@/app/utils"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { AvatarFallback, AvatarImage } from "@radix-ui/react-avatar"
import { Button } from "./button";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CreateButtonNav, CreateButtonSide } from "./createEvent";
import MyNotifications from "./myNotifications";
import SearchBar from "./searchBar"
import ThemeChanger from "./themeChanger";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "i18next";
import LanguageChanger from "./languageChanger";



const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Root
    ref={ref}
    className={cn(
      "relative z-10 flex max-w-full w-full items-center justify-between",
      className
    )}
    {...props}
  >
    {children}
    <NavigationMenuViewport />
  </NavigationMenuPrimitive.Root>
))
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName

const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn(
      "group flex flex-1 list-none items-center justify-between space-x-1",
      className
    )}
    {...props}
  />
))
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName

const NavigationMenuItem = NavigationMenuPrimitive.Item

const navigationMenuTriggerStyle = cva(
  "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
)

const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(navigationMenuTriggerStyle(), "group", className)}
    {...props}
  >
    {children}{" "}
    <ChevronDown
      className="relative top-[1px] ml-1 h-3 w-3 transition duration-200 group-data-[state=open]:rotate-180"
      aria-hidden="true"
    />
  </NavigationMenuPrimitive.Trigger>
))
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName

const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      "left-0 top-0 w-full data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 md:absolute md:w-auto ",
      className
    )}
    {...props}
  />
))
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName

const NavigationMenuLink = NavigationMenuPrimitive.Link

const NavigationMenuViewport = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <div className={cn("absolute left-0 top-full flex justify-center")}>
    <NavigationMenuPrimitive.Viewport
      className={cn(
        "origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]",
        className
      )}
      ref={ref}
      {...props}
    />
  </div>
))
NavigationMenuViewport.displayName =
  NavigationMenuPrimitive.Viewport.displayName

const NavigationMenuIndicator = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Indicator>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Indicator>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Indicator
    ref={ref}
    className={cn(
      "top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in",
      className
    )}
    {...props}
  >
    <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
  </NavigationMenuPrimitive.Indicator>
))
NavigationMenuIndicator.displayName =
  NavigationMenuPrimitive.Indicator.displayName

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

export default function Navbar() {
 const { t } = useTranslation();
  const [theme, setTheme] = useState("light");
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Initialize theme from localStorage on client-side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme) {
        setTheme(savedTheme);
      }
    }
  }, []);
  const toggleNavbar = () => {
    setIsCollapsed(!isCollapsed);
  };
  const router = useRouter();
  const { data: session } = useSession();
  let firstName = session?.user?.name;

  const [user, setUser] = useState<any>(null);
  const profileHref =
    (session?.user as { id?: string } | undefined)?.id
      ? `/${(session?.user as { id?: string }).id}`
      : "/";
  useEffect(() => {
    const fetchUserByEmail = async () => {
      try {
        const response = await fetch("/api/currentUser", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: session?.user?.email }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch user");
        }

        const data = await response.json();
        if (data.user) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    if (session?.user?.email) {
      fetchUserByEmail();
    }

    const handleImageUpdate = (event: any) => {
      if (event.detail?.imageUrl) {
        setUser((prev: any) => ({
          ...prev,
          image: event.detail.imageUrl
        }));
      }
    };

    window.addEventListener('profileImageUpdated', handleImageUpdate);
    return () => window.removeEventListener('profileImageUpdated', handleImageUpdate);
  }, [session?.user?.email]);

return (
  <div className="w-full">
    <NavigationMenu className="px-4 w-full bg-slate-900 py-2">
      <NavigationMenuList
        className="
          grid w-full items-center gap-4 
          grid-cols-[auto_auto_1fr_auto_auto_auto]
        "
      >
        {/* 1) Hamburger + SideNav */}
        <NavigationMenuItem className="flex items-center">
          <div className="flex items-center">
            <nav
              className={cn(
                "fixed top-12 mt-4 left-0 h-[calc(100%-3rem)] bg-black/30 backdrop-blur-sm p-4 transition-transform",
                isOpen ? "translate-x-0" : "-translate-x-full"
              )}
            >
              <ul className="space-y-4 w-full text-center">
                {session ? (
                  <>
                    <li className="flex flex-col items-center space-y-2">
                      <Avatar className="h-16 w-16 rounded-full overflow-hidden">
                        <AvatarImage
                          className="h-full w-full object-cover"
                          src={
                            user?.image ??
                            "https://cdn.pfps.gg/pfps/2301-default-2.png"
                          }
                        />
                        <AvatarFallback>
                          {firstName?.[0]}
                        </AvatarFallback>
                      </Avatar>

                      <h1 className="text-xl font-semibold text-slate-300">
                        {user?.name + " " + user?.lastName}
                      </h1>
                      <h2 className="text-md text-slate-300">
                        @{user?.username}
                      </h2>

                      <Link
                        href={profileHref}
                        className="text-blue-700 hover:underline text-sm"
                      >
                        {t("viewprofile")}
                      </Link>
                    </li>

                    <li className="text-gray-300 text-sm">
                      {t("text1side")}<br />{t("text2side")}
                    </li>

                    <li><CreateButtonSide /></li>
                    
                    <li><LanguageChanger /></li>
                  </>
                ) : (
                  <>
                    <li className="font-bold text-gray-700">
                      Nothing here unless you
                    </li>
                    <li>
                      <Link href="/login">
                        <Button className="px-9 bg-blue-600">Log in</Button>
                      </Link>
                    </li>
                    <li className="font-bold text-gray-700">or</li>
                    <li>
                      <Link href="/signup">
                        <Button className="px-9 bg-blue-600">Sign up</Button>
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </nav>

            <button
  onClick={() => setIsOpen(!isOpen)}
  aria-label="Main Menu"
  aria-expanded={isOpen}
  className={cn("bg-transparent border-0 p-0 cursor-pointer flex", isOpen && "opened")}
>
  <svg width="40" height="40" viewBox="0 0 100 100">
    <path
      d="M 20,29.000046 H 80.000231 C 80.000231,29.000046 94.498839,28.817352 94.532987,66.711331 94.543142,77.980673 90.966081,81.670246 85.259173,81.668997 79.552261,81.667751 75.000211,74.999942 75.000211,74.999942 L 25.000021,25.000058"
      fill="none"
      stroke="white"
      strokeWidth="6"
      className="transition-[stroke-dasharray,stroke-dashoffset] duration-[600ms]"
      style={{
        strokeDasharray: isOpen ? "90 207" : "60 207",
        strokeDashoffset: isOpen ? -134 : 0,
      }}
    />
    <path
      d="M 20,50 H 80"
      fill="none"
      stroke="white"
      strokeWidth="6"
      className="transition-[stroke-dasharray,stroke-dashoffset] duration-[600ms]"
      style={{
        strokeDasharray: isOpen ? "1 60" : "60 60",
        strokeDashoffset: isOpen ? -30 : 0,
      }}
    />
    <path
      d="M 20,70.999954 H 80.000231 C 80.000231,70.999954 94.498839,71.182648 94.532987,33.288669 94.543142,22.019327 90.966081,18.329754 85.259173,18.331003 79.552261,18.332249 75.000211,25.000058 75.000211,25.000058 L 25.000021,74.999942"
      fill="none"
      stroke="white"
      strokeWidth="6"
      className="transition-[stroke-dasharray,stroke-dashoffset] duration-[600ms]"
      style={{
        strokeDasharray: isOpen ? "90 207" : "60 207",
        strokeDashoffset: isOpen ? -134 : 0,
      }}
    />
  </svg>
</button>
          </div>
        </NavigationMenuItem>

        {/* 2) Logo */}
        <NavigationMenuItem>
          <Link href="/" className="font-bold text-2xl  text-white cursor-pointer">
            Eventful
          </Link>
        </NavigationMenuItem>

        {/* 3) Search area (1fr wide) = SearchBar + icon side-by-side */}
        <NavigationMenuItem className="flex w-full items-center gap-2">
          <div className="flex-1 min-w-0">
            <SearchBar />
          </div>

          <button
            type="button"
            aria-label="Search"
            className="shrink-0 rounded-full p-2 hover:bg-white/10 transition"
          >
            <Search className="h-8 w-8 text-slate-300 " />
          </button>
        </NavigationMenuItem>

        {/* 4) Notifications */}
        {session && (
          <NavigationMenuItem className="flex justify-center">
            <MyNotifications />
          </NavigationMenuItem>
        )}

        {/* 5) Create button */}
        {session ? (
          <NavigationMenuItem className="flex justify-center">
            <CreateButtonNav />
          </NavigationMenuItem>
        ) : (
          <NavigationMenuItem className="flex items-center gap-2 justify-end">
            <Link href="/login">
              <Button className="px-6 bg-slate-500">Log in</Button>
            </Link>
          </NavigationMenuItem>
        )}

        {/* 6) Avatar */}
        {session && (
          <NavigationMenuItem className="flex justify-end">
            <Link href={profileHref}>
              <Avatar className="h-9 w-9 rounded-full overflow-hidden">
  <AvatarImage
    className="h-full w-full object-cover"
    src={
      user?.image ??
      "https://cdn.pfps.gg/pfps/2301-default-2.png"
    }
  />
  <AvatarFallback>
    {firstName?.charAt(0)?.toUpperCase()}
  </AvatarFallback>
</Avatar>
            </Link>
          </NavigationMenuItem>
        )}
      </NavigationMenuList>
    </NavigationMenu>
  </div>
);
}

export {
  navigationMenuTriggerStyle,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
}