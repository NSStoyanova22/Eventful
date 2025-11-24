"use client";

import { useEffect, useState } from "react";
import NotificationDialog from "./notificationsDialog";
import { Bell, BellDot  } from "lucide-react";
import {
  StoredNotification,
  getStoredNotifications,
  persistNotifications,
  NOTIFICATIONS_EVENT,
} from "./notification-utils";

export default function MyNotifications() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);

  useEffect(() => {
    setNotifications(getStoredNotifications());
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<StoredNotification[]>;
      if (Array.isArray(customEvent.detail)) {
        setNotifications(customEvent.detail);
      } else {
        setNotifications(getStoredNotifications());
      }
    };

    window.addEventListener(NOTIFICATIONS_EVENT, handler);
    return () => {
      window.removeEventListener(NOTIFICATIONS_EVENT, handler);
    };
  }, []);

  const handleClick = () => {
    setOpen(true);
  };

  const handleDelete = (index: number) => {
    const updatedNotifications =
      index < 0
        ? []
        : notifications.filter((_, i) => i !== index);

    setNotifications(updatedNotifications);
    persistNotifications(updatedNotifications);
  };
  const NotificationIcon = notifications.length > 0 ? BellDot : Bell;
  return (
    <>
       <div className="relative">
        <button
          className="relative ml-auto flex items-center justify-center"
          onClick={handleClick}
        >
          <NotificationIcon className="h-7 w-7 text-slate-300" />
        </button>
      </div>
      <NotificationDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
        onDelete={handleDelete}
      />
    </>
  );
}
