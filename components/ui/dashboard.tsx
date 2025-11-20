"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Post from "./post";
import Footer from "@/components/ui/footer";
import { DateTime } from "luxon";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface Event {
  _id: string;
  title: string;
  startDate: string;
  endDate: string;
  attendees: string[];
  isPublic: boolean;
  status: string;
  description: string;
  photos?: string[];
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const { t  } = useTranslation();
  const { data: session } = useSession();
  const profileHref =
    (session?.user as { id?: string } | undefined)?.id
      ? `/${(session?.user as { id?: string }).id}`
      : "#";
  const dt = DateTime.now();
  let hourMessage;

  if (dt.hour >= 4 && dt.hour < 12) {
    hourMessage = t("goodmorning");
  } else if (dt.hour >= 12 && dt.hour < 18) {
    hourMessage = t("goodaf");
  } else {
    hourMessage = t("goodev");
  }

  const [posts, setPosts] = useState<Event[]>([]);
  const [attendingEvents, setAttendingEvents] = useState<Event[]>([]);
  const [finishedEvents, setFinishedEvents] = useState<Event[]>([]);
  const [attendingIndex, setAttendingIndex] = useState(0);
  const [finishedIndex, setFinishedIndex] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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
        if (data?.user) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    if (session?.user?.email) {
      fetchUserByEmail();
    }
  }, [session?.user?.email]);

  useEffect(() => {
    const fetchPosts = async () => {
      const userId = session?.user?.id;
      if (!userId) return;

      try {
        const res = await fetch("/api/eventCreation");
        if (!res.ok) throw new Error("Failed to fetch events");
        const data = await res.json();

        const now = new Date();

        const attending =
          data.events?.filter(
            (event: Event) =>
              event.attendees.includes(userId) && new Date(event.endDate) > now
          ) || [];

        const finished =
          data.events?.filter(
            (event: Event) =>
              event.attendees.includes(userId) && new Date(event.endDate) < now
          ) || [];

        setPosts(data.events || []);
        setAttendingEvents(attending);
        setFinishedEvents(finished);
      } catch (error) {
        console.error(error);
      }
    };

    fetchPosts();
  }, [session?.user?.id]);

  const filteredEvents = posts.filter((event) => {
    const eventEndDate = new Date(event.endDate);
    return (
      event.isPublic && eventEndDate > new Date() && event.status === "approved"
    );
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const uploadPhoto = async (eventId: string | undefined) => {
    if (!eventId) {
      toast.error("Select an event to share photos.");
      return;
    }

    if (!selectedFile) {
      toast("Please select a file first.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      console.log("Uploading photo for event:", eventId);
      console.log("Selected file:", selectedFile.name);

      const res = await fetch(`/api/events/${eventId}/photos`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorMessage = await res.text();
        throw new Error(`Failed to upload photo: ${errorMessage}`);
      }

      toast.success("Photo uploaded successfully!");
      setSelectedFile(null);

      const refreshRes = await fetch("/api/eventCreation");

      if (!refreshRes.ok) {
        const errorMessage = await refreshRes.text();
        throw new Error(`Failed to refresh events: ${errorMessage}`);
      }

      const refreshData = await refreshRes.json();
      const userId = session?.user?.id;

      if (!userId) {
        console.error("User ID not found in session");
        return;
      }

      setFinishedEvents(
        refreshData.events?.filter(
          (event: Event) =>
            event.attendees.includes(userId) &&
            new Date(event.endDate) < new Date()
        ) || []
      );

    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Failed to upload photo.");
    } finally {
      setUploading(false);
    }

  };
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 text-white">
      <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-blue-600/80 via-indigo-700/80 to-slate-900/80 px-8 py-10 shadow-[0_40px_120px_rgba(30,64,175,0.35)]">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.6em] text-white/70">
              {hourMessage}
            </p>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              {user ? `${user.name} ${user.lastName}` : "Creator"}, ready to craft your next event?
            </h1>
            <p className="text-sm text-white/70 md:text-base">
              Track attending guests, share memories from finished events, and discover trending experiences tailored for you.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <Link
              href="/created-events"
              className="rounded-full bg-white px-6 py-3 text-center font-semibold text-slate-900 shadow-lg shadow-blue-900/40 transition hover:-translate-y-0.5"
            >
              Manage my events
            </Link>
            <Link
              href={profileHref}
              className="rounded-full border border-white/30 px-6 py-3 text-center font-semibold text-white/90 transition hover:bg-white/10"
            >
              View profile
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 text-slate-900 md:grid-cols-3">
          {[
            {
              label: t("attending"),
              value: attendingEvents.length,
              tone: "bg-white",
            },
            {
              label: t("finished"),
              value: finishedEvents.length,
              tone: "bg-white/80",
            },
            {
              label: t("explore"),
              value: filteredEvents.length,
              tone: "bg-white/60",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`${stat.tone} rounded-2xl px-4 py-3 text-center shadow-lg shadow-slate-900/10`}
            >
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
                {stat.label}
              </p>
              <p className="text-3xl font-semibold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white backdrop-blur-xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-blue-200/80">
                {t("attending")}
              </p>
              <h2 className="text-2xl font-semibold">Your next stop</h2>
            </div>
            <Link href="/attending" className="text-sm font-semibold text-blue-200 hover:text-white">
              {t("showall")}
            </Link>
          </div>

          {attendingEvents.length > 0 ? (
            <div className="rounded-3xl border border-white/20 bg-gradient-to-br from-blue-700/40 to-purple-700/30 p-6 shadow-inner shadow-blue-900/20">
              <div className="mb-4 flex items-center justify-between text-sm text-white/70">
                <button
                  onClick={() => setAttendingIndex((prev) => Math.max(0, prev - 1))}
                  disabled={attendingIndex === 0}
                  className="rounded-full border border-white/30 px-3 py-1 font-semibold disabled:opacity-30"
                >
                  &lt;
                </button>
                <span>
                  {attendingIndex + 1}/{attendingEvents.length}
                </span>
                <button
                  onClick={() =>
                    setAttendingIndex((prev) =>
                      Math.min(attendingEvents.length - 1, prev + 1)
                    )
                  }
                  disabled={attendingIndex >= attendingEvents.length - 1}
                  className="rounded-full border border-white/30 px-3 py-1 font-semibold disabled:opacity-30"
                >
                  &gt;
                </button>
              </div>
              <h3 className="text-3xl font-semibold">
                {attendingEvents[attendingIndex].title}
              </h3>
              <p className="mt-2 text-sm text-white/70">
                {t("in")}{" "}
                {Math.max(
                  0,
                  Math.ceil(
                    (new Date(attendingEvents[attendingIndex].startDate).getTime() -
                      Date.now()) /
                      (1000 * 60 * 60 * 24)
                  )
                )}{" "}
                {t("days")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-200/70">{t("nojoined")}</p>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-slate-400">
                {t("finished")}
              </p>
              <h2 className="text-2xl font-semibold">Share highlights</h2>
            </div>
            <Link href="/finished-events" className="text-sm font-semibold text-blue-600">
              {t("showall")}
            </Link>
          </div>

          {finishedEvents.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">{t("photosq")}</p>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-lg font-semibold text-slate-900">
                  {finishedEvents[finishedIndex]?.title}
                </p>
                <div className="mt-3 space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                  />
                  <button
                    onClick={() => uploadPhoto(finishedEvents[finishedIndex]._id)}
                    disabled={uploading}
                    className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {uploading ? t("upload") : "Share memory"}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-500">
                <button
                  onClick={() => setFinishedIndex((prev) => Math.max(0, prev - 1))}
                  disabled={finishedIndex === 0}
                  className="rounded-full border border-slate-200 px-3 py-1 font-semibold disabled:opacity-40"
                >
                  &lt;
                </button>
                <span>
                  {finishedIndex + 1}/{finishedEvents.length}
                </span>
                <button
                  onClick={() =>
                    setFinishedIndex((prev) =>
                      Math.min(finishedEvents.length - 1, prev + 1)
                    )
                  }
                  disabled={finishedIndex >= finishedEvents.length - 1}
                  className="rounded-full border border-slate-200 px-3 py-1 font-semibold disabled:opacity-40"
                >
                  &gt;
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{t("nofinished")}</p>
          )}
        </section>
      </div>

      <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 text-white backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-semibold">{t("explore")}</h2>
        </div>
        {filteredEvents.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {filteredEvents.map((post) => (
              <Post key={post._id} post={post} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-200/70">No public events available right now.</p>
        )}
      </section>

      <section className="rounded-[32px] border border-white/10 bg-white p-8 text-slate-900 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-semibold text-slate-900">{t("hot")}</h2>
          <p className="text-sm text-slate-500">Most popular this week</p>
        </div>
        <div className="space-y-6">
          {[...filteredEvents]
            .sort(
              (a, b) =>
                (b.attendees?.length || 0) - (a.attendees?.length || 0)
            )
            .slice(0, 4)
            .map((post) => (
              <Post key={post._id} post={post} />
            ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}