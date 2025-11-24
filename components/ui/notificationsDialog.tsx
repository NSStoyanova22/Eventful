"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { Trash, CalendarDays, CalendarHeart, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StoredNotification } from "./notification-utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  CalendarDays,
  CalendarHeart,
  ShieldAlert,
};

interface NotificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: StoredNotification[];
  onDelete: (index: number) => void;
}

export default function NotificationDialog({
  isOpen,
  onClose,
  notifications,
  onDelete,
}: NotificationDialogProps) {
  const { t  } = useTranslation();
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogOverlay className="bg-black/30 flex items-center justify-center" />
        <DialogContent className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-800">
            {t("notif")}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {notifications.length === 0 ? (
              <p className="text-gray-500">{t("nonotif")}</p>
            ) : (
              notifications.map((notification, i) => (
                <div key={i} className="mb-3 border-b pb-2 flex items-center justify-between text-gray-700">
                  <div className="flex items-center">
                    {(() => {
                      const Icon =
                        ICON_MAP[notification.icon ?? ""] ?? CalendarDays;
                      return <Icon className="mr-2 text-sky-800" />;
                    })()}
                    <span>{notification.message}</span>
                  </div>
                  <button onClick={() => onDelete(i)} className="text-red-500 hover:text-red-700">
                    <Trash className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-6 flex justify-end gap-4">
            <Button onClick={() => onDelete(-1)} className="p-2 bg-clear text-sky-800 hover:bg-sky-200">
              {t("notifications_clear_all")}
            </Button>
            
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
