"use client";
import * as React from "react";
import { useState, useEffect } from "react";
import { DateTime } from "luxon";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { CalendarDays, Clock, MapPin, Share2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import ConfirmModal from "./confirm-modal";
import axios from "axios";
import { useUser } from "@/app/contexts/UserContext";
import { addNotificationToStorage, getStoredNotifications } from "./notification-utils";
interface PostProps {
  post: {
    _id: string;
    title: string;
    startDate: string;
    description: string;
    location?: {
      name?: string;
      formatted?: string;
      latitude?: number;
      longitude?: number;
    };
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
  const { user: currentUser } = useUser();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

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

    const handleCommentUpdate = (event: any) => {
      if (event.detail?.eventId === post._id) {
        fetchComments();
      }
    };

    window.addEventListener('commentUpdated', handleCommentUpdate);
    return () => window.removeEventListener('commentUpdated', handleCommentUpdate);
  }, [post._id]);

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
    addNotificationToStorage(
      { message: newMessage, icon },
      { dedupeByMessage: true }
    );
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
      const notifications = getStoredNotifications();
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
      
      window.dispatchEvent(new CustomEvent('commentUpdated', { 
        detail: { eventId: post._id } 
      }));
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDelete || !session?.user) return;

    try {
      const userId = (session.user as any).id || (session.user as any)._id || "";

      const response = await axios.delete(`/api/events/${post._id}/comments`, {
        data: {
          commentId: commentToDelete,
          userId,
        },
      });

      if (response.status === 200) {
        setComments((prev) => prev.filter((c) => c._id !== commentToDelete));
        toast("Comment deleted");
        
        window.dispatchEvent(new CustomEvent('commentUpdated', { 
          detail: { eventId: post._id } 
        }));
      }
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      if (error.response?.status === 403) {
        toast("You can only delete your own comments");
      } else {
        toast("Error deleting comment");
      }
    } finally {
      setCommentToDelete(null);
    }
  };
  

  const shareEvent = async () => {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");
    const eventUrl = `${(baseUrl || "").replace(/\/$/, "")}/events/${post._id}`;
    const message = post.location?.name
      ? t("event_share_clipboard_with_location", {
          title: post.title,
          location: post.location.name,
          url: eventUrl,
        })
      : t("event_share_clipboard", {
          title: post.title,
          url: eventUrl,
        });

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = message;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      toast.success(t("event_share_toast_title"), {
        description: t("event_share_toast_hint"),
        icon: <Share2 className="h-4 w-4" />,
      });
    } catch (error) {
      console.error("Failed to copy event link:", error);
      toast.error(t("event_share_error"));
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
          {post?.location?.name && (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              <MapPin className="h-4 w-4 text-emerald-600" />
              <span className="truncate max-w-[150px]">{post.location.name}</span>
            </div>
          )}
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
          <div className="flex items-center gap-3">
            <button
              onClick={shareEvent}
              className="inline-flex items-center gap-2 rounded-full border border-blue-100 px-4 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
            >
              <Share2 className="h-4 w-4" />
              {t("event_share_button")}
            </button>
            <Link href={`/events/${post._id.toString()}`}>
              <button className="rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5">
                {t("moreinfo")}
              </button>
            </Link>
          </div>
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
                    comments.map((comment) => {
                      const userId = (session?.user as any)?.id || (session?.user as any)?._id || "";
                      const isOwnComment = userId === comment.userId;
                      
                      return (
                        <div key={comment._id} className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-sm">
                          <img
                            src={comment.userImage || "https://cdn.pfps.gg/pfps/2301-default-2.png"}
                            alt="User"
                            className="h-10 w-10 rounded-full object-cover"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-slate-900">{comment.userName}</p>
                              {isOwnComment && (
                                <button
                                  onClick={() => {
                                    setCommentToDelete(comment._id);
                                    setDeleteModalOpen(true);
                                  }}
                                  className="text-xs text-red-500 transition hover:text-red-600"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">{comment.text}</p>
                          </div>
                        </div>
                      );
                    })
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteComment}
        onCancel={() => {
          setDeleteModalOpen(false);
          setCommentToDelete(null);
        }}
        isDangerous={true}
      />
    </div>
  );
}
