"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Post from "./post";
import Footer from "@/components/ui/footer";
import { DateTime } from "luxon";
import ThemeChanger from "./themeChanger";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "./button";

export default function LanguageChanger() {

    const { t, i18n } = useTranslation();
    return(
        <>
        
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">{t("change_language")}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem
                        onSelect={() => i18n.changeLanguage("en")}
                    >
                        English
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onSelect={() => i18n.changeLanguage("bg")}
                    >
                        Български
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
                          {/* <button onClick={() => i18n.changeLanguage("en")}>🇬🇧 English</button>
                          <button onClick={() => i18n.changeLanguage("bg")}>🇧🇬 Български</button> */}

        </>
    )
}
