"use client";
import * as React from "react";
import { useState, useEffect } from "react";
import { DateTime } from "luxon";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { CalendarDays, Clock, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
interface PostProps {
  post: {
    _id: string;
    title: string;
    startDate: string;
    description: string;
    image?: string;
    createdByImage?: string;
    createdByName?: string;
    attending?: number;
  };
  hideComment?: boolean;
}

interface Comment {
  _id: string;
  userId: string;
  userName: string;
  userImage: string;
  text: string;
  createdAt: string;
}

export default function Post({ post, hideComment }: PostProps) {
  const { t  } = useTranslation();
  const dt = DateTime.now();
  const { data: session } = useSession();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/events/${post._id}/comments`);
        if (!res.ok) throw new Error("Failed to fetch comments");
        const data = await res.json();
        setComments(data.comments);
      } catch (error) {
        console.error("Error fetching comments:", error);
      }
    };
    fetchComments();

  }, [showComments, post._id]);

  
  useEffect(() => {
    const fetchUserByEmail = async () => {
      if (!session?.user?.email) return;
      try {
        const response = await fetch("/api/currentUser", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: session.user.email }),
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.user) {
          setCurrentUser(data.user);
        }
      } catch (error) {
        console.error("Error fetching current user for comments:", error);
      }
    };

    fetchUserByEmail();
  }, [session?.user?.email]);

  function calcTimeLeft() {
    const startDateTime = DateTime.fromISO(post.startDate);
    const diffInDays = startDateTime.diff(dt, "days").days;
    const diffInHours = startDateTime.diff(dt, "hours").hours;

    if (diffInDays >= 1) {
      return `${Math.floor(diffInDays)} ${Math.floor(diffInDays) > 1 ? t("days") : t("day")}`;
    } else if (diffInDays < 1 && diffInHours >= 1) {
      return `${Math.floor(diffInHours)} hour${Math.floor(diffInHours) > 1 ? "s" : ""}`;
    } else {
      return t("less1hour");
    }
  }

  const addNotification = (newMessage: string, icon: string) => {
    const savedNotifications = localStorage.getItem("notifications");
    const notifications = savedNotifications ? JSON.parse(savedNotifications) : [];

    const newNotification = { message: newMessage, icon };

    if (!notifications.some((notification: any) => notification.message === newMessage)) {
      const updatedNotifications = [...notifications, newNotification];
      localStorage.setItem("notifications", JSON.stringify(updatedNotifications));
    }
  };

  useEffect(() => {
    if (calcTimeLeft() === " less than 1 hour") {
      addNotification(post.title + " by " + post.createdByName + " starting soon!", "CalendarDays");
    }
    if (calcTimeLeft() === "1 day") {
      addNotification(post.title + " by " + post.createdByName + " starting tomorrow!", "CalendarDays");
    }
    if (calcTimeLeft() === "10 days") {
      const notificationMessage = post.title + " by " + post.createdByName + " starting in 10 days!";
      const savedNotifications = localStorage.getItem("notifications");
      const notifications = savedNotifications ? JSON.parse(savedNotifications) : [];

      if (!notifications.some((notification: any) => notification.message === notificationMessage)) {
        toast(notificationMessage, {
          description: "Plan the outfit and check the weather!",
          icon: <CalendarDays />,
        });
        addNotification(notificationMessage, "CalendarDays");
      }
    }
  }, []);

  const handleAddComment = async () => {
    if (!session?.user || !newComment.trim()) return;

    try {
      const userId = (session.user as any).id || (session.user as any)._id || "";
      const userName = session.user.name || "Anonymous";
      const userImage =
        fileUrl ||
        currentUser?.image ||
        (session.user as any).image ||
        "https://cdn.pfps.gg/pfps/2301-default-2.png";

      const res = await fetch(`/api/events/${post._id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newComment, userId, userName, userImage }),
      });

      if (!res.ok) throw new Error("Failed to add comment");

      const data = await res.json();

      setComments((prevComments) => [...prevComments, data.comment]);
      setNewComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };
  

  const startDate = DateTime.fromISO(post.startDate);
  const readableDate = startDate.isValid
    ? startDate.toLocaleString(DateTime.DATE_MED)
    : "";
  const readableTime = startDate.isValid
    ? startDate.toLocaleString(DateTime.TIME_SIMPLE)
    : "";

  return (
    <div
      data-aos="fade-up"
      className="group relative mb-6 overflow-hidden rounded-[26px] border border-white/10 bg-white/95 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.15)] transition hover:-translate-y-1 hover:shadow-[0_35px_90px_rgba(15,23,42,0.25)]"
    >
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-3xl border border-slate-100/40 bg-slate-900/5">
          {post.image ? (
            <div className="relative">
              <img
                src={post.image}
                alt={post.title}
                className="h-56 w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
            </div>
          ) : (
            <div className="flex h-56 w-full flex-col items-center justify-center bg-gradient-to-br from-blue-600/60 to-purple-600/60 text-white">
              <CalendarDays className="h-10 w-10 opacity-80" />
              <p className="mt-2 text-sm uppercase tracking-[0.4em]">
                Eventful
              </p>
            </div>
          )}
          <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white backdrop-blur">
              {calcTimeLeft()}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur">
              {readableDate}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold text-slate-900">
              {post.title.charAt(0).toUpperCase() + post.title.slice(1)}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <Users className="h-4 w-4" />
              {post.attending ?? 0} {t("participants")}
            </span>
          </div>
          <p className="text-slate-500">{post.description}</p>
          <div className="flex flex-wrap gap-3 text-sm text-slate-500">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              {readableDate}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              <Clock className="h-4 w-4 text-purple-600" />
              {readableTime}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={post.createdByImage || "https://cdn.pfps.gg/pfps/2301-default-2.png"}
              alt="Created By"
              className="h-12 w-12 rounded-full object-cover shadow-inner"
            />
            <div>
              <p className="text-base font-semibold text-slate-900">
                {post.createdByName || "Eventful Host"}
              </p>
            </div>
          </div>
          <Link href={`/events/${post._id.toString()}`}>
            <button className="rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5">
              {t("moreinfo")}
            </button>
          </Link>
        </div>

        {!hideComment && (
          <>
            <button
              className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-500"
              onClick={() => setShowComments(!showComments)}
            >
              {showComments ? t("closecomment") : t("writecomment")} ({comments.length})
            </button>

            {showComments && (
              <div
                data-aos="fade-up"
                className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
              >
                <div className="max-h-40 overflow-y-auto space-y-3">
                  {comments.length > 0 ? (
                    comments.map((comment) => (
                      <div key={comment._id} className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-sm">
                        <img
                          src={comment.userImage}
                          alt="User"
                          className="h-10 w-10 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{comment.userName}</p>
                          <p className="text-sm text-slate-600">{comment.text}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">{t("nocomment")}</p>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={t("writecomment")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-slate-800"
                    onClick={handleAddComment}
                  >
                    {t("post")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
