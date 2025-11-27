"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { CalendarDays, ArrowLeft, MapPin, PencilLine, ShieldAlert, Share2, Trash2 } from "lucide-react";
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
import { useTranslation } from "react-i18next";


interface Event {
  _id: string;
  title: string;
  createdBy?: string;
  createdByName?: string;
  location?: {
    name?: string;
    formatted?: string;
    latitude?: number;
    longitude?: number;
  };
  startDate: string;
  endDate?: string;
  status?: string;
  description: string;
  attending: number;
  attendees?: (string | Attendee)[];
  image?: string;
  isPublic?: boolean;
  guestLimit?: number;
  joinRequests?: JoinRequest[];
  requestStatus?: "none" | "pending" | "approved" | "declined";
  canViewDetails?: boolean;
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

type WeatherSummary = {
  headline: string;
  details: {
    temperature: string;
    rainChance: number;
    wind: number;
    humidity: number;
    rainRisk: string;
    tempProfile: string;
    windProfile: string;
  };
  advice: string;
};

interface JoinRequest {
  _id: string;
  status: "pending" | "approved" | "declined";
  createdAt?: string;
  user: {
    _id?: string;
    name?: string;
    lastName?: string;
    username?: string;
    email?: string;
    image?: string;
  };
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
  const [requestStatus, setRequestStatus] = useState<"none" | "pending" | "approved" | "declined">("none");
  const [canViewDetails, setCanViewDetails] = useState<boolean | null>(null);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [requestActionLoading, setRequestActionLoading] = useState<string | null>(null);
  const { t } = useTranslation();
  const [weatherSummary, setWeatherSummary] = useState<WeatherSummary | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const flaggedNotificationSent = useRef(false);
  const weatherHeadline = useMemo(() => {
    if (!weatherSummary) return null;
    return t("event_weather_headline", {
      temp: t(
        `event_weather_profile_${weatherSummary.details.tempProfile ?? "warm"}`
      ),
      wind: t(
        `event_weather_profile_${weatherSummary.details.windProfile ?? "calm"}`
      ),
    });
  }, [weatherSummary, t]);
  const weatherBadgeText = useMemo(() => {
    if (!weatherSummary) return null;
    return t("event_weather_badge", {
      risk: t(
        `event_weather_rain_${weatherSummary.details.rainRisk ?? "low"}`
      ),
    });
  }, [weatherSummary, t]);
  const weatherAdviceText = useMemo(() => {
    if (!weatherSummary) return null;
    const parts: string[] = [];
    const details = weatherSummary.details;
    if (details.rainRisk === "high") {
      parts.push(t("event_weather_advice_rain_high"));
    } else if (details.rainRisk === "medium") {
      parts.push(t("event_weather_advice_rain_medium"));
    }
    if (details.tempProfile === "hot") {
      parts.push(t("event_weather_advice_temp_hot"));
    } else if (details.tempProfile === "cold") {
      parts.push(t("event_weather_advice_temp_cold"));
    }
    if (details.windProfile === "windy") {
      parts.push(t("event_weather_advice_wind_windy"));
    }
    if (!parts.length) {
      parts.push(t("event_weather_advice_default"));
    }
    return parts.join(" ");
  }, [weatherSummary, t]);
  // hydrate client session details with richer db data
  const { user } = useUser();
  const { events } = useEvents();
  const sessionUserId = (session?.user as CustomSessionUser)?.id;

  const mapAttendeeId = useCallback(
    (attendee: any) => attendee?._id?.toString?.() ?? attendee?.toString?.() ?? "",
    []
  );

  const normalizeAttendeeDetails = useCallback(
    (attendees: any[]): Attendee[] =>
      (attendees || []).map((attendee: any) => ({
        _id: mapAttendeeId(attendee),
        name: attendee?.name || "",
        lastName: attendee?.lastName || "",
        username: attendee?.username || "",
        email: attendee?.email || "",
        image: attendee?.image || "",
      })),
    [mapAttendeeId]
  );

  const isHostOfEvent = useCallback(
    (evt: Event | null) => {
      if (!evt) return false;
      const creatorId =
        typeof (evt as any)?.createdBy === "string"
          ? (evt as any).createdBy
          : (evt as any)?.createdBy?._id?.toString?.() ??
            (evt as any)?.createdBy?.toString?.();

      return Boolean(
        (sessionUserId && creatorId === sessionUserId) ||
          (user?.username && evt.createdByName === user.username) ||
          (user?._id && creatorId === user._id)
      );
    },
    [sessionUserId, user]
  );

  const isHost = isHostOfEvent(event);
  const canSeeDetails =
    typeof canViewDetails === "boolean"
      ? canViewDetails
      : Boolean((event?.isPublic ?? false) || isHost || hasJoined);

useEffect(() => {
  if (!id || !events.length || event) return;

  try {
    const currentEvent = events.find((evt: any) => evt._id === id);

    if (!currentEvent) {
      setError(t("event_page_not_found"));
      return;
    }

    setEvent(currentEvent as Event);
    setError(null);

    if (sessionUserId && currentEvent.attendees?.includes(sessionUserId)) {
      setHasJoined(true);
    }
    if ((currentEvent as any)?.requestStatus) {
      setRequestStatus((currentEvent as any).requestStatus);
    }
    if (typeof (currentEvent as any)?.canViewDetails === "boolean") {
      setCanViewDetails((currentEvent as any).canViewDetails);
    }
  } catch (err: any) {
    console.error("Error finding event:", err);
    setError(t("event_page_load_error"));
  }
}, [event, events, id, sessionUserId, t]);

const refreshEventDetails = useCallback(async () => {
  if (!id) return;
  try {
    const response = await axios.get(`/api/events/${id}`);
    const fetchedEvent = response.data?.event as Event | undefined;
    const statusFromServer = response.data?.requestStatus as
      | "none"
      | "pending"
      | "approved"
      | "declined"
      | undefined;

    if (typeof response.data?.canViewDetails === "boolean") {
      setCanViewDetails(response.data.canViewDetails);
    }

    if (statusFromServer) {
      setRequestStatus(statusFromServer);
    }

    if (!fetchedEvent) {
      setError(t("event_page_not_found"));
      return;
    }

    setEvent(fetchedEvent);
    const attendeeIds = (fetchedEvent.attendees || []).map(mapAttendeeId);
    if (sessionUserId && attendeeIds.includes(sessionUserId)) {
      setHasJoined(true);
      setRequestStatus("approved");
    } else {
      setHasJoined(false);
    }

    if (isHostOfEvent(fetchedEvent)) {
      const normalized = normalizeAttendeeDetails(fetchedEvent.attendees as any[]).filter(
        (attendee) => attendee._id
      );
      setAttendeeDetails(normalized);
      const pending = (fetchedEvent.joinRequests || []).filter(
        (req) => req.status === "pending"
      );
      setPendingRequests(pending);
    } else {
      setAttendeeDetails([]);
      setPendingRequests([]);
    }
  } catch (err: any) {
    console.error("Error fetching event:", err);
    setError(t("event_page_load_error"));
  }
}, [id, isHostOfEvent, mapAttendeeId, normalizeAttendeeDetails, sessionUserId, t]);

useEffect(() => {
  refreshEventDetails();
}, [refreshEventDetails]);

useEffect(() => {
  if (!event?.startDate || !canSeeDetails) {
    setWeatherSummary(null);
    setWeatherError(null);
    return;
  }

  const controller = new AbortController();

  const fetchWeather = async () => {
    try {
      setWeatherLoading(true);
      setWeatherError(null);
      const response = await fetch("/api/weather/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: event.startDate,
          latitude: event.location?.latitude,
          longitude: event.location?.longitude,
          locationName: event.location?.name,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Unable to fetch weather.");
      }
      const data = await response.json();
      setWeatherSummary(data.summary);
    } catch (error: any) {
      if (error.name === "AbortError") return;
      console.error("Event weather error:", error);
      setWeatherError(t("event_weather_error"));
      setWeatherSummary(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  fetchWeather();
  return () => controller.abort();
}, [
  event?.startDate,
  event?.location?.latitude,
  event?.location?.longitude,
  event?.location?.name,
  canSeeDetails,
  t,
]);

  useEffect(() => {
    const fetchComments = async () => {
      if (!id || !canSeeDetails) return;
      try {
        const response = await axios.get(`/api/events/${id}/comments`);
        setComments(response.data?.comments ?? []);
      } catch (fetchError) {
        console.error("Error fetching comments:", fetchError);
        setComments([]);
      }
    };

    if (!id || !canSeeDetails) {
      setComments([]);
      return;
    }

    fetchComments();

    const handleCommentUpdate = (event: any) => {
      if (event.detail?.eventId === id) {
        fetchComments();
      }
    };

    window.addEventListener('commentUpdated', handleCommentUpdate);
    return () => window.removeEventListener('commentUpdated', handleCommentUpdate);
  }, [canSeeDetails, id]);

  const isFlagged = Boolean(isHost && event?.status === "flagged");
  useEffect(() => {
    if (!isFlagged || !event?.title) {
      return;
    }
    if (!flaggedNotificationSent.current) {
      const flaggedMessage = t("event_flagged_warning", {
        title: event.title,
      });
      addNotificationToStorage(
        { message: flaggedMessage, icon: "ShieldAlert" },
        { dedupeByMessage: true }
      );
      toast(flaggedMessage);
      flaggedNotificationSent.current = true;
    }
  }, [event?.title, isFlagged, t]);

  const eventToEdit = useMemo(() => {
    if (!event) return null;
    return {
      _id: event._id,
      title: event.title,
      description: event.description,
      location: event.location,
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
      toast.success(t("event_delete_success"));
      router.push("/created-events");
    } catch (deleteError) {
      console.error("Error deleting event:", deleteError);
      toast.error(t("event_delete_error"));
    }
  };

  // allow guests to join or see confirmation state
  const handleJoin = async () => {
    if (!session?.user) {
      toast(t("You must be logged in to join"));
      return;
    }
    const userId = (session.user as CustomSessionUser)?.id;
    if (!userId) {
      toast(t("User ID not found"));
      return;
    }

    setJoining(true);
    try {
      const response = await axios.post(`/api/events/${id}/join`, { userId });

      const nextStatus =
        (response.data?.requestStatus as "none" | "pending" | "approved" | "declined" | undefined) ??
        "none";
      setRequestStatus(nextStatus);

      if (nextStatus === "approved") {
        setHasJoined(true);
        setCanViewDetails(true);
        const updatedAttending = response.data?.attending;
        setEvent((prev) =>
          prev
            ? {
                ...prev,
                attending:
                  typeof updatedAttending === "number"
                    ? updatedAttending
                    : (prev.attending || 0) + (prev.attendees?.includes(userId) ? 0 : 1),
                attendees: prev.attendees ? [...prev.attendees, userId] : [userId],
              }
            : prev
        );
        await refreshEventDetails();
        const message = t("event_join_success_message", {
          title: event?.title || t("event_title_fallback"),
          host: event?.createdByName || t("event_unknown_host"),
        });
        toast(message);
        addNotificationToStorage(
          { message, icon: "CalendarDays" },
          { dedupeByMessage: true }
        );
      } else if (nextStatus === "pending") {
        toast("Your join request was sent to the host.");
      } else if (nextStatus === "declined") {
        toast.error("The host declined your previous request.");
      } else {
        toast.error(t("event_join_error"));
      }
    } catch (error) {
      console.error("Error joining event:", error);
      toast.error(t("event_join_error"));
    } finally {
      setJoining(false);
    }
  };

  const handleRequestDecision = async (
    targetUserId: string,
    action: "approve" | "decline" | "remove"
  ) => {
    if (!id || !targetUserId) return;
    setRequestActionLoading(targetUserId);
    try {
      const response = await axios.patch(`/api/events/${id}`, {
        userId: targetUserId,
        action,
      });

      const updatedRequests = (response.data?.requests as JoinRequest[] | undefined) ?? [];
      setPendingRequests(updatedRequests.filter((req) => req.status === "pending"));

      if (response.data?.event) {
        setEvent(response.data.event);
        setAttendeeDetails(
          normalizeAttendeeDetails((response.data.event as any)?.attendees ?? [])
        );
      }

      if (action === "approve" && targetUserId === sessionUserId) {
        setHasJoined(true);
        setRequestStatus("approved");
      }

      await refreshEventDetails();
      const successMessage =
        action === "approve"
          ? "Request approved"
          : action === "decline"
          ? "Request declined"
          : "Attendee removed";
      toast.success(successMessage);
    } catch (err) {
      console.error("Error updating join request:", err);
      const message =
        (err as any)?.response?.data?.error ||
        (err as any)?.response?.data?.message ||
        "Unable to update request";
      toast.error(message);
    } finally {
      setRequestActionLoading(null);
    }
  };

  const handleAddComment = async () => {
    if (!session?.user) {
      toast(t("You must be logged in to comment"));
      return;
    }
    if (!canSeeDetails) {
      toast("This event is private. Ask the host to approve your request to comment.");
      return;
    }
    if (!newComment.trim()) {
      toast(t("Write something before sending"));
      return;
    }

    const userId = (session.user as CustomSessionUser)?.id;
    if (!userId) {
      toast(t("User information missing"));
      return;
    }

    const displayName =
      [user?.name, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.username ||
      session.user.name ||
      t("event_guest_fallback");

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
        toast(t("Unable to add comment"));
      }
    } catch (commentError) {
      console.error("Error adding comment:", commentError);
      toast(t("Error adding comment"));
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDelete || !session?.user) {
      return;
    }
    if (!canSeeDetails) {
      toast("You need approval from the host to manage comments.");
      return;
    }

    const userId = (session.user as CustomSessionUser)?.id;
    if (!userId) {
      toast(t("User information missing"));
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
        toast(t("Comment deleted"));

        window.dispatchEvent(new CustomEvent('commentUpdated', {
          detail: { eventId: id }
        }));
      } else {
        toast(t("Unable to delete comment"));
      }
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      if (error.response?.status === 403) {
        toast(t("You can only delete your own comments"));
      } else {
        toast(t("Error deleting comment"));
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
    const message = event.location?.name
      ? t("event_share_clipboard_with_location", {
          title: event.title,
          location: event.location.name,
          url: eventUrl,
        })
      : t("event_share_clipboard", {
          title: event.title,
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
      });
    } catch (error) {
      console.error("Failed to copy event link:", error);
      toast.error(t("event_share_error"));
    }
  };

  if (error) {
    return <div className="p-6 text-center text-white/80">{error}</div>;
  }

  if (!event) {
    return (
      <div className="p-6 text-center text-white/80">
        {t("event_page_loading")}
      </div>
    );
  }

  const eventDate = event.startDate ? new Date(event.startDate) : null;
  const formattedDate = eventDate
    ? eventDate.toLocaleDateString("en-GB", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : t("event_tba");
  const formattedTime = eventDate
    ? eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : t("event_tba");
  const heroImage =
    (event as any)?.image ||
    "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80";
  const isPrivateEvent = event.isPublic === false;
  const joinButtonLabel = hasJoined
    ? "Joined"
    : requestStatus === "pending"
    ? "Request pending"
    : requestStatus === "declined"
    ? "Request again"
    : joining
    ? "Joining..."
    : isPrivateEvent
    ? "Request to join"
    : "Join event";
  const joinButtonDisabled = hasJoined || joining || requestStatus === "pending";
  const rsvpTitle = hasJoined
    ? "See you there!"
    : requestStatus === "pending"
    ? "Request sent"
    : requestStatus === "declined"
    ? "Request declined"
    : "Join the guest list";
  const rsvpSubtitle = hasJoined
    ? "You're confirmed. Check your notifications for reminders."
    : requestStatus === "pending"
    ? "Waiting for the host to approve your request."
    : requestStatus === "declined"
    ? "The host declined your last request. You can ask again."
    : "Reserve your spot to receive reminders and updates.";
  const attendanceStatus = hasJoined
    ? "You're in"
    : requestStatus === "pending"
    ? "Awaiting approval"
    : requestStatus === "declined"
    ? "Request declined"
    : "Seats open";

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
            {t("event_back_button")}
          </button>
          {isFlagged && (
            <div className="rounded-3xl border border-yellow-500/40 bg-yellow-900/30 p-5 text-sm text-yellow-100 shadow-[0_20px_60px_rgba(190,152,52,0.25)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-1 h-5 w-5 flex-shrink-0 text-yellow-300" />
                  <div>
                    <p className="text-base font-semibold">
                      {t("event_flagged_card_title")}
                    </p>
                    <p className="text-yellow-100/80">
                      {t("event_flagged_card_description")}
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
                    {t("event_flagged_update_button")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteEventModalOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("event_flagged_delete_button")}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {isPrivateEvent && !canSeeDetails && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              <p className="text-base font-semibold text-white">Private event</p>
              <p className="mt-1 text-white/70">
                The host will need to approve your request before details like the location and conversation are visible.
              </p>
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
                      {t("event_status_flagged_badge")}
                    </span>
                  )}
                  {weatherBadgeText && (
                    <span className="rounded-full bg-sky-500/20 px-4 py-1 text-xs font-semibold text-sky-100">
                      {weatherBadgeText}
                    </span>
                  )}
                  <button
                    onClick={shareCurrentEvent}
                    className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
                  >
                    <Share2 className="h-4 w-4" />
                    {t("event_share_button")}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-8 p-8 lg:grid-cols-[2fr_1fr]">
              <div data-aos="fade-up" className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <p className="text-sm uppercase tracking-[0.4em] text-white/60">
                    {t("event_overview_heading")}
                  </p>
                  <p className="mt-3 text-base text-white/80">
                    {t("event_hosted_by", {
                      host: event.createdByName || t("event_unknown_host"),
                    })}
                  </p>
                  <p className="mt-4 text-lg text-white/85">
                    {canSeeDetails
                      ? event.description
                      : "Details are hidden until the host approves your request."}
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
                    <p className="text-xs uppercase tracking-[0.4em]  mt-2 text-white/60">
                      Status
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {attendanceStatus}
                    </p>
                  </div>
                  
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                      Location
                    </p>
                    <p className="mt-3 text-lg font-semibold text-white flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-sky-300" />
                      {event.location?.name || "To be announced"}
                    </p>
                    <p className="text-sm text-white/70">
                      {canSeeDetails
                        ? "Share this location with attendees so they know where to arrive."
                        : "Location stays hidden until the host approves your request."}
                    </p>
                  </div>
                </div>
              
             {(weatherSummary || weatherLoading || weatherError) && (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/80">
    <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">
      {t("event_weather_heading")}
    </p>

    {weatherLoading ? (
      <p className="mt-1 text-white/70 text-xs">
        {t("event_weather_loading")}
      </p>
    ) : weatherSummary ? (
      <>
        <p className="mt-1 text-sm font-semibold text-white leading-tight">
          {weatherHeadline || weatherSummary.headline}
        </p>

        <div className="mt-2 grid grid-cols-2 gap-y-1 gap-x-3 text-[11px] text-white/70">
          <span>
            {t("event_weather_temp", {
              value: weatherSummary.details.temperature,
              profile: t(
                `event_weather_profile_${weatherSummary.details.tempProfile ?? "warm"}`
              ),
            })}
          </span>
          <span>
            {t("event_weather_rain", {
              value: weatherSummary.details.rainChance,
              risk: t(
                `event_weather_rain_${weatherSummary.details.rainRisk ?? "low"}`
              ),
            })}
          </span>
          <span>
            {t("event_weather_wind", {
              value: weatherSummary.details.wind,
              profile: t(
                `event_weather_profile_${weatherSummary.details.windProfile ?? "calm"}`
              ),
            })}
          </span>
          <span>
            {t("event_weather_humidity", {
              value: weatherSummary.details.humidity,
            })}
          </span>
        </div>

        <p className="mt-2 text-[10px] text-white/60 leading-snug">
          {weatherAdviceText || weatherSummary.advice}
        </p>
      </>
    ) : (
      <p className="mt-1 text-[11px] text-amber-200">
        {weatherError || t("event_weather_error")}
      </p>
    )}
  </div>
)}
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
                  {rsvpTitle}
                </h2>
                <p className="text-sm text-white/70">
                  {rsvpSubtitle}
                </p>
                <Button
                  onClick={handleJoin}
                  disabled={joinButtonDisabled}
                  className={`w-full rounded-full px-6 py-3 text-sm font-semibold ${
                    hasJoined
                      ? "bg-white/30 text-white"
                      : "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white"
                  }`}
                >
                  {joinButtonLabel}
                </Button>
                </>
                ) : (
                  <>
                    <p className="text-sm uppercase tracking-[0.4em] text-white/60">
                      Requests
                    </p>
                    <h2 className="text-2xl font-semibold">Manage guests</h2>
                    <div className="space-y-3">
                      {pendingRequests.length === 0 ? (
                        <p className="text-sm text-white/70">
                          No pending requests right now.
                        </p>
                      ) : (
                        pendingRequests.map((request) => (
                          <div
                            key={request._id}
                            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                          >
                            <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10">
                              <img
                                src={
                                  request.user?.image ||
                                  "https://cdn.pfps.gg/pfps/2301-default-2.png"
                                }
                                alt={request.user?.username || "requester"}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-white">
                                {request.user?.name || request.user?.username || "Guest"}
                              </p>
                              <p className="text-xs text-white/70">
                                {request.user?.email || "Email hidden"}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={requestActionLoading === request.user?._id}
                                onClick={() =>
                                  handleRequestDecision(request.user?._id || "", "approve")
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={requestActionLoading === request.user?._id}
                                onClick={() =>
                                  handleRequestDecision(request.user?._id || "", "decline")
                                }
                              >
                                Decline
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="pt-4">
                      <p className="text-sm uppercase tracking-[0.4em] text-white/60">
                        Attendees
                      </p>
                    </div>
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
                            <div className="ml-auto flex gap-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={requestActionLoading === attendee._id}
                                onClick={() =>
                                  handleRequestDecision(attendee._id, "remove")
                                }
                              >
                                Remove
                              </Button>
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
          {canSeeDetails ? (
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
          ) : (
            <section
              data-aos="fade-up"
              className="rounded-[32px] border border-white/10 bg-slate-900/40 p-8 text-sm text-white/80 shadow-[0_25px_90px_rgba(15,23,42,0.35)]"
            >
              <p className="text-xs uppercase tracking-[0.5em] text-white/60">
                Conversation
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Hidden for now</h2>
              <p className="mt-2">
                This is a private event. Request access and once the host approves, you will be able to view and join the conversation.
              </p>
            </section>
          )}
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
