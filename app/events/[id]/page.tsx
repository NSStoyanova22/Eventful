"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { getServerSession } from "next-auth";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import Navbar from "@/components/ui/navigation-menu";
import { useCurrentUser } from "@/app/api/useCurrentUser/route";


interface Event {
  _id: string;
  title: string;
  createdBy?: string;
  createdByName?: string;
  startDate: string;
  description: string;
  attending: number;
  attendees?: string[];
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

interface Notification {
  message: string;
  icon: string;
}

export default function EventDetails() {
  const { id } = useParams();
  const { data: session } = useSession();
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [attendeeDetails, setAttendeeDetails] = useState<Attendee[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  const [hasJoined, setHasJoined] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const savedNotifications = localStorage.getItem("notifications");
    return savedNotifications ? JSON.parse(savedNotifications) : [];
  });

  const storeNotificationsToLocalStorage = (notifications: Notification[]) => {
    localStorage.setItem("notifications", JSON.stringify(notifications));
  };
  // hydrate client session details with richer db data
  const { user } = useCurrentUser();

  useEffect(() => {
    // fetch event basics from the cached event list
    const fetchEventData = async () => {
      try {
        console.log("Fetching all events from /api/eventCreation...");
        const response = await axios.get("/api/eventCreation");

        if (!response.data.events || response.data.events.length === 0) {
          throw new Error("No events found");
        }

        const currentEvent = response.data.events.find((evt: Event) => evt._id === id);

        if (!currentEvent) {
          throw new Error("Event not found");
        }

        setEvent(currentEvent);

        const userId = (session?.user as CustomSessionUser)?.id;
        if (userId && currentEvent.attendees?.includes(userId)) {
          setHasJoined(true);
        }
      } catch (err: any) {
        console.error("Error fetching event:", err);
        setError("Error fetching event");
      }
    };

    if (id) {
      fetchEventData();
    }
  }, [id, session]);

  useEffect(() => {
    // load comment thread for this event
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
  }, [id]);

  // normalize creator id for host comparisons
  const creatorId =
    typeof (event as any)?.createdBy === "string"
      ? (event as any)?.createdBy
      : (event as any)?.createdBy?._id?.toString?.() ??
        (event as any)?.createdBy?.toString?.();

  // determine if logged user owns the event
  const isHost = Boolean(
    event &&
      user &&
      (event.createdByName === user.username || creatorId === user._id)
  );

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
        setNotifications((prevNotifications: any) => {
          const updatedNotifications = [...prevNotifications, { message, icon: "CalendarDays" }];
          storeNotificationsToLocalStorage(updatedNotifications);
          return updatedNotifications;
        });
      } else {
        console.error("Failed to join event");
      }
    } catch (error) {
      console.error("Error joining event:", error);
    } finally {
      setJoining(false);
    }
  };

  // push a new comment to the thread
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
                <div className="flex flex-wrap gap-3 text-sm text-white/80">
                  <span className="rounded-full bg-white/10 px-4 py-1">
                    {formattedDate}
                  </span>
                  <span className="rounded-full bg-white/10 px-4 py-1">
                    {formattedTime}
                  </span>
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
                comments.map((comment, index) => (
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
                      <div className="flex items-center gap-2 text-sm text-white/70">
                        <p className="font-semibold text-white">
                          {comment.userName}
                        </p>
                        <span className="text-xs text-white/50">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-2 text-white/80">{comment.text}</p>
                    </div>
                  </div>
                ))
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
    </>
  );
}
