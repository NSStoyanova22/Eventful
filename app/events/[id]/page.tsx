"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { CalendarDays, ArrowLeft, PencilLine, ShieldAlert, Share2, Trash2 } from "lucide-react";
import Navbar from "@/components/ui/navigation-menu";
import { useUser } from "@/app/contexts/UserContext";
import { useEvents } from "@/app/contexts/EventsContext";
import ConfirmModal from "@/components/ui/confirm-modal";
import CreateEvent from "@/components/ui/createEvent";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addNotificationToStorage } from "@/components/ui/notification-utils";


interface Event {
  _id: string;
  title: string;
  createdBy?: string;
  createdByName?: string;
  startDate: string;
  endDate?: string;
  status?: string;
  description: string;
  attending: number;
  attendees?: string[];
  image?: string;
  isPublic?: boolean;
  guestLimit?: number;
}

interface Comment {
  _id: string;
  userId: string;
  userName: string;
  userImage: string;
  text: string;
  createdAt: string;
}

interface Attendee {
  _id: string;
  name?: string;
  lastName?: string;
  username?: string;
  email?: string;
  image?: string;
}

interface CustomSessionUser {
  id?: string;
  name?: string;
  email?: string;
  image?: string;
}

export default function EventDetails() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [attendeeDetails, setAttendeeDetails] = useState<Attendee[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteEventModalOpen, setDeleteEventModalOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [hasJoined, setHasJoined] = useState(false);
  // hydrate client session details with richer db data
  const { user } = useUser();
  const { events } = useEvents();

  useEffect(() => {
    if (!id || !events.length) return;

    try {
      const currentEvent = events.find((evt: any) => evt._id === id);

      if (!currentEvent) {
        setError("Event not found");
        return;
      }

      setEvent(currentEvent as Event);

      const userId = (session?.user as CustomSessionUser)?.id;
      if (userId && currentEvent.attendees?.includes(userId)) {
        setHasJoined(true);
      }
    } catch (err: any) {
      console.error("Error finding event:", err);
      setError("Error finding event");
    }
  }, [id, events, session]);

  useEffect(() => {
    const fetchComments = async () => {
      if (!id) return;
      try {
        const response = await axios.get(`/api/events/${id}/comments`);
        setComments(response.data?.comments ?? []);
      } catch (fetchError) {
        console.error("Error fetching comments:", fetchError);
        setComments([]);
      }
    };

    fetchComments();

    const handleCommentUpdate = (event: any) => {
      if (event.detail?.eventId === id) {
        fetchComments();
      }
    };

    window.addEventListener('commentUpdated', handleCommentUpdate);
    return () => window.removeEventListener('commentUpdated', handleCommentUpdate);
  }, [id]);

  const creatorId =
    typeof (event as any)?.createdBy === "string"
      ? (event as any)?.createdBy
      : (event as any)?.createdBy?._id?.toString?.() ??
        (event as any)?.createdBy?.toString?.();

  const isHost = Boolean(
    event &&
      user &&
      (event.createdByName === user.username || creatorId === user._id)
  );
  const isFlagged = Boolean(isHost && event?.status === "flagged");

  const eventToEdit = useMemo(() => {
    if (!event) return null;
    return {
      _id: event._id,
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate ?? event.startDate,
      guestLimit: (event as any)?.guestLimit ?? 0,
      isPublic: (event as any)?.isPublic ?? false,
      attending: event.attending,
    };
  }, [event]);

  const handleEventUpdated = (updatedEvent: any) => {
    if (updatedEvent) {
      setEvent(updatedEvent);
    }
  };

  const handleDeleteEvent = async () => {
    if (!id) return;
    try {
      await axios.delete(`/api/events/${id}`);
      toast("Event deleted");
      router.push("/created-events");
    } catch (deleteError) {
      console.error("Error deleting event:", deleteError);
      toast("Failed to delete event");
    }
  };

  useEffect(() => {
    // fetch detailed attendee info when host views the page
    const fetchAttendees = async () => {
      if (!id || !isHost) return;
      try {
        const response = await axios.get(`/api/events/${id}`);
        const populatedAttendees = response.data?.event?.attendees ?? [];
        const normalizedAttendees = populatedAttendees.map((attendee: any) => ({
          _id: attendee?._id?.toString?.() ?? attendee?._id ?? "",
          name: attendee?.name || "",
          lastName: attendee?.lastName || "",
          username: attendee?.username || "",
          email: attendee?.email || "",
          image: attendee?.image || "",
        }));
        setAttendeeDetails(normalizedAttendees);
      } catch (fetchError) {
        console.error("Error fetching attendees:", fetchError);
        setAttendeeDetails([]);
      }
    };

    fetchAttendees();
  }, [id, isHost]);

  // allow guests to join or see confirmation state
  const handleJoin = async () => {
    if (!session?.user) {
      toast("You must be logged in to join");
      return;
    }
    const userId = (session.user as CustomSessionUser)?.id;
    if (!userId) {
      toast("User ID not found");
      return;
    }

    setJoining(true);
    try {
      const response = await axios.post(`/api/events/${id}/join`, { userId });

      if (response.status === 200) {
        setHasJoined(true);

        setEvent((prev) =>
          prev
            ? {
              ...prev,
              attending: (prev.attending || 0) + 1,
              attendees: prev.attendees ? [...prev.attendees, userId] : [userId],
            }
            : prev
        );
        const message = ("Joined " + event?.title + " by " + event?.createdByName + "!");
        toast(message);
        addNotificationToStorage(
          { message, icon: "CalendarDays" },
          { dedupeByMessage: true }
        );
      } else {
        console.error("Failed to join event");
      }
    } catch (error) {
      console.error("Error joining event:", error);
    } finally {
      setJoining(false);
    }
  };

  const handleAddComment = async () => {
    if (!session?.user) {
      toast("You must be logged in to comment");
      return;
    }
    if (!newComment.trim()) {
      toast("Write something before sending");
      return;
    }

    const userId = (session.user as CustomSessionUser)?.id;
    if (!userId) {
      toast("User information missing");
      return;
    }

    const displayName =
      [user?.name, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.username ||
      session.user.name ||
      "Guest";

    const userImage =
      user?.image ||
      (session.user as CustomSessionUser)?.image ||
      "https://cdn.pfps.gg/pfps/2301-default-2.png";

    setAddingComment(true);
    try {
      const response = await axios.post(`/api/events/${id}/comments`, {
        text: newComment.trim(),
        userId,
        userName: displayName,
        userImage,
      });
      if (response.status === 200 && response.data?.comment) {
        setComments((prev) => [...prev, response.data.comment]);
        setNewComment("");
        
        window.dispatchEvent(new CustomEvent('commentUpdated', { 
          detail: { eventId: id } 
        }));
      } else {
        toast("Unable to add comment");
      }
    } catch (commentError) {
      console.error("Error adding comment:", commentError);
      toast("Error adding comment");
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDelete || !session?.user) {
      return;
    }

    const userId = (session.user as CustomSessionUser)?.id;
    if (!userId) {
      toast("User information missing");
      return;
    }

    try {
      const response = await axios.delete(`/api/events/${id}/comments`, {
        data: {
          commentId: commentToDelete,
          userId,
        },
      });

      if (response.status === 200) {
        setComments((prev) => prev.filter((c) => c._id !== commentToDelete));
        toast("Comment deleted");
        
        window.dispatchEvent(new CustomEvent('commentUpdated', { 
          detail: { eventId: id } 
        }));
      } else {
        toast("Unable to delete comment");
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

  const shareCurrentEvent = async () => {
    if (!event?._id) return;
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");
    const eventUrl = `${(baseUrl || "").replace(/\/$/, "")}/events/${event._id}`;
    const message = `Join me at "${event.title}" on Eventful: ${eventUrl}`;

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
      toast("Event link copied!");
    } catch (error) {
      console.error("Failed to copy event link:", error);
      toast.error("Unable to copy event link");
    }
  };

  if (error) {
    return <div>{error}</div>;
  }

  if (!event) {
    return <div>Loading event...</div>;
  }

  const eventDate = event.startDate ? new Date(event.startDate) : null;
  const formattedDate = eventDate
    ? eventDate.toLocaleDateString("en-GB", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "TBA";
  const formattedTime = eventDate
    ? eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "TBA";
  const heroImage =
    (event as any)?.image ||
    "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80";

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 px-4 py-12 text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {isFlagged && (
            <div className="rounded-3xl border border-yellow-500/40 bg-yellow-900/30 p-5 text-sm text-yellow-100 shadow-[0_20px_60px_rgba(190,152,52,0.25)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-1 h-5 w-5 flex-shrink-0 text-yellow-300" />
                  <div>
                    <p className="text-base font-semibold">Event flagged for review</p>
                    <p className="text-yellow-100/80">
                      Only you can view this event right now. Update the details to remove
                      sensitive wording or delete it if it was created by mistake.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    className="border-yellow-400/40 text-yellow-50 hover:bg-yellow-500/10"
                    onClick={() => setEditDialogOpen(true)}
                  >
                    <PencilLine className="mr-2 h-4 w-4" />
                    Update event
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteEventModalOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete event
                  </Button>
                </div>
              </div>
            </div>
          )}
          <section
            data-aos="fade-up"
            className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/40 shadow-[0_40px_120px_rgba(15,23,42,0.45)] backdrop-blur-2xl"
          >
            <div className="relative h-72 w-full">
              <img
                src={heroImage}
                alt={event.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 space-y-3">
                <p className="text-xs uppercase tracking-[0.5em] text-white/80">
                  Eventful
                </p>
                <h1 className="text-4xl font-semibold">{event.title}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
                  <span className="rounded-full bg-white/10 px-4 py-1">
                    {formattedDate}
                  </span>
                  <span className="rounded-full bg-white/10 px-4 py-1">
                    {formattedTime}
                  </span>
                  {event.status === "flagged" && (
                    <span className="rounded-full bg-amber-500/30 px-4 py-1 text-xs font-semibold text-amber-100">
                      Status: {event.status}
                    </span>
                  )}
                  <button
                    onClick={shareCurrentEvent}
                    className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-8 p-8 lg:grid-cols-[2fr_1fr]">
              <div data-aos="fade-up" className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <p className="text-sm uppercase tracking-[0.4em] text-white/60">
                    Overview
                  </p>
                  <p className="mt-3 text-base text-white/80">
                    Hosted by{" "}
                    <span className="font-semibold text-white">
                      {event.createdByName || "Unknown"}
                    </span>
                  </p>
                  <p className="mt-4 text-lg text-white/85">
                    {event.description}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                      Attendance
                    </p>
                    <p className="mt-3 text-3xl font-semibold">
                      {event.attending}
                    </p>
                    <p className="text-sm text-white/70">people already in</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                      Status
                    </p>
                    <p className="mt-3 text-lg font-semibold">
                      {hasJoined ? "You're in" : "Seats open"}
                    </p>
                    <p className="text-sm text-white/70">
                      {event.attendees?.length || 0} confirmed attendees
                    </p>
                  </div>
                </div>
              </div>

              <div
                data-aos="fade-left"
                className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6"
              >
              {!isHost ? (
                <>
                <p className="text-sm uppercase tracking-[0.4em] text-white/60">
                  RSVP
                </p>
                <h2 className="text-2xl font-semibold">
                  {hasJoined ? "See you there!" : "Join the guest list"}
                </h2>
                <p className="text-sm text-white/70">
                  {hasJoined
                    ? "You're confirmed. Check your notifications for reminders."
                    : "Reserve your spot to receive reminders and updates."}
                </p>
                <Button
                  onClick={handleJoin}
                  disabled={hasJoined || joining}
                  className={`w-full rounded-full px-6 py-3 text-sm font-semibold ${
                    hasJoined
                      ? "bg-white/30 text-white"
                      : "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white"
                  }`}
                >
                  {hasJoined ? "Joined" : joining ? "Joining..." : "Join event"}
                </Button>
                </>
                ) : (
                  <>
                    <p className="text-sm uppercase tracking-[0.4em] text-white/60">
                      Attendees
                    </p>
                    <h2 className="text-2xl font-semibold">Guest list</h2>
                    <div className="space-y-3">
                      {attendeeDetails.length === 0 ? (
                        <p className="text-sm text-white/70">
                          No attendees yet.
                        </p>
                      ) : (
                        attendeeDetails.map((attendee) => (
                          <div
                            key={attendee._id}
                            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                          >
                            <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10">
                              <img
                                src={
                                  attendee.image ||
                                  "https://cdn.pfps.gg/pfps/2301-default-2.png"
                                }
                                alt={attendee.username || "attendee"}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {attendee.name || attendee.username || "Guest"}{" "}
                                {attendee.lastName || ""}
                              </p>
                              <p className="text-xs text-white/70">
                                {attendee.email || "Email hidden"}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                 ) }
              </div>
              
            </div>
          </section>
          <section
            data-aos="fade-up"
            className="rounded-[32px] border border-white/10 bg-slate-900/40 p-8 shadow-[0_25px_90px_rgba(15,23,42,0.35)]"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-white/60">
                  Conversation
                </p>
                <h2 className="text-2xl font-semibold text-white">
                  Comments ({comments.length})
                </h2>
              </div>
            </div>

            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm text-white/60">
                  Be the first to share your thoughts about this event.
                </p>
              ) : (
                comments.map((comment, index) => {
                  const isOwnComment = (session?.user as CustomSessionUser)?.id === comment.userId;
                  
                  return (
                    <div
                      key={comment._id}
                      data-aos="fade-up"
                      data-aos-delay={index * 70}
                      className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-white/10">
                        <img
                          src={
                            comment.userImage ||
                            "https://cdn.pfps.gg/pfps/2301-default-2.png"
                          }
                          alt={comment.userName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-white/70">
                            <p className="font-semibold text-white">
                              {comment.userName}
                            </p>
                            <span className="text-xs text-white/50">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {isOwnComment && (
                            <button
                              onClick={() => {
                                setCommentToDelete(comment._id);
                                setDeleteModalOpen(true);
                              }}
                              className="text-xs text-red-400 transition hover:text-red-300"
                              title="Delete comment"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                        <p className="mt-2 text-white/80">{comment.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div
              data-aos="fade-up"
              className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              {session?.user ? (
                <>
                  <p className="text-sm uppercase tracking-[0.4em] text-white/60">
                    Add a comment
                  </p>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share details, plans, or tips for fellow attendees..."
                    className="mt-3 h-28 w-full rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={addingComment}
                    className="mt-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-2 text-sm font-semibold text-white"
                  >
                    {addingComment ? "Posting..." : "Post comment"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-white/70">
                  Log in to join the conversation.
                </p>
              )}
            </div>
          </section>
        </div>
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
      <ConfirmModal
        isOpen={deleteEventModalOpen}
        title="Delete Event"
        message="Deleting this event will remove it permanently for everyone. This action cannot be undone."
        confirmText="Delete event"
        cancelText="Cancel"
        onConfirm={handleDeleteEvent}
        onCancel={() => setDeleteEventModalOpen(false)}
        isDangerous
      />
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl border border-white/10 bg-slate-950/90 text-white">
          <DialogHeader>
            <DialogTitle>Edit event details</DialogTitle>
            <DialogDescription className="text-white/70">
              Update the title, description, or settings to resubmit the event for approval.
            </DialogDescription>
          </DialogHeader>
          {eventToEdit && (
            <CreateEvent
              eventToEdit={eventToEdit}
              onEventUpdated={handleEventUpdated}
              onClose={() => setEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
