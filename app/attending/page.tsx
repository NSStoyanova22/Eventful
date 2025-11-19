"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Navbar from "@/components/ui/navigation-menu";
import Link from "next/link";

interface Event {
  _id: string;
  title: string;
  startDate: string;
}

export default function AttendingEvents() {
  const { data: session } = useSession();
  const [attendingEvents, setAttendingEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAttendingEvents = async () => {
      if (!session?.user?.id) return;

      try {
        setIsLoading(true);
        const res = await fetch(`/api/attending?userId=${session.user.id}`);
        if (!res.ok) throw new Error("Failed to fetch attending events");

        const data = await res.json();
        setAttendingEvents(data.events || []);
      } catch (error) {
        console.error("Error fetching attending events:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendingEvents();
  }, [session?.user?.id]);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-5xl space-y-8">
          <header className="rounded-[32px] border border-white/10 bg-white/5 p-8 text-center shadow-[0_30px_100px_rgba(15,23,42,0.35)] backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.5em] text-white/70">
              My calendar
            </p>
            <h1 className="mt-3 text-4xl font-semibold">Your joined events</h1>
            <p className="mt-2 text-sm text-white/70">
              Keep track of what's coming up and jump back into event details anytime.
            </p>
          </header>

          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
            {isLoading ? (
              <p className="text-sm text-white/70">Loading...</p>
            ) : attendingEvents.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {attendingEvents.map((event) => {
                  const date = new Date(event.startDate);
                  return (
                    <Link
                      key={event._id}
                      href={`/events/${event._id}`}
                      className="group rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:bg-white/10"
                    >
                      <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                        {date.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                      </p>
                      <h2 className="mt-3 text-xl font-semibold text-white">
                        {event.title}
                      </h2>
                      <p className="text-sm text-white/70">
                        {date.toLocaleDateString()} ·{" "}
                        {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-200">
                        View details →
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                <p className="text-lg font-semibold text-white">No RSVP yet</p>
                <p className="mt-2 text-sm text-white/70">
                  Discover new events to start filling your calendar.
                </p>
                <Link
                  href="/"
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-white px-6 py-2 text-sm font-semibold text-slate-900"
                >
                  Go to dashboard
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}