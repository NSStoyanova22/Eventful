"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/navigation-menu";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";

interface Event {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  image: string;
  isPublic: boolean;
  attendees: string[];
  status: string;
  createdBy?: string | { toString: () => string };
  createdByName?: string;
}

export default function CreatedEvents() {
  const { data: session } = useSession();
  const router = useRouter();
  const [createdEvents, setCreatedEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCreatedEvents = async () => {
      if (!session?.user?.id) return;

      try {
        setIsLoading(true);
        const res = await fetch("/api/eventCreation");
        if (!res.ok) throw new Error("Failed to fetch events");

        const data = await res.json();
        // Filter events created by the current user
        const userEvents = data.events?.filter(
          (event: Event) => 
            event.createdBy?.toString() === session.user.id ||
            event.createdByName === session.user.name
        ) || [];
        
        setCreatedEvents(userEvents);
      } catch (error) {
        console.error("Error fetching created events:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCreatedEvents();
  }, [session?.user?.id, session?.user?.name]);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-5xl space-y-8">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          
          <header className="rounded-[32px] border border-white/10 bg-white/5 p-8 text-center shadow-[0_30px_100px_rgba(15,23,42,0.35)] backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.5em] text-white/70">
              Event manager
            </p>
            <h1 className="mt-3 text-4xl font-semibold">Your created events</h1>
            <p className="mt-2 text-sm text-white/70">
              Manage and track all the events you've organized.
            </p>
          </header>

          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white"></div>
                  <p className="text-sm text-white/70">Loading your events...</p>
                </div>
              </div>
            ) : createdEvents.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {createdEvents.map((event) => {
                  const startDate = new Date(event.startDate);
                  const endDate = new Date(event.endDate);
                  const now = new Date();
                  const isUpcoming = startDate > now;
                  const isOngoing = startDate <= now && endDate >= now;
                  const isPast = endDate < now;

                  return (
                    <Link
                      key={event._id}
                      href={`/events/${event._id}`}
                      className="group rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:bg-white/10"
                    >
                      {event.image && (
                        <div className="mb-4 overflow-hidden rounded-2xl">
                          <img
                            src={event.image}
                            alt={event.title}
                            className="h-32 w-full object-cover transition group-hover:scale-105"
                          />
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                          {startDate.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                        </p>
                        {isUpcoming && (
                          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200">
                            Upcoming
                          </span>
                        )}
                        {isOngoing && (
                          <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-200">
                            Live
                          </span>
                        )}
                        {isPast && (
                          <span className="rounded-full bg-gray-500/20 px-3 py-1 text-xs font-semibold text-gray-200">
                            Past
                          </span>
                        )}
                      </div>
                      
                      <h2 className="mt-3 text-xl font-semibold text-white">
                        {event.title}
                      </h2>
                      
                      <p className="mt-2 line-clamp-2 text-sm text-white/70">
                        {event.description}
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-xs text-white/60">
                        <MapPin className="h-3.5 w-3.5 text-blue-200" />
                        {event.location || "Location TBA"}
                      </p>
                      
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-white/70">
                          <span className="flex items-center gap-1">
                            👥 {event.attendees?.length || 0} attending
                          </span>
                          <span>·</span>
                          <span>{event.isPublic ? "Public" : "Private"}</span>
                        </div>
                      </div>
                      
                      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-200">
                        Manage event →
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                  <span className="text-3xl">📅</span>
                </div>
                <p className="text-lg font-semibold text-white">No events created yet</p>
                <p className="mt-2 text-sm text-white/70">
                  Start creating amazing events and build your community.
                </p>
                <Link
                  href="/"
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5"
                >
                  Create your first event
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
