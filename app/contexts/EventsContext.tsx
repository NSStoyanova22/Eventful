"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

type Event = {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  image?: string;
  createdByImage?: string;
  createdByName?: string;
  attending?: number;
  isPublic?: boolean;
  guestLimit?: number;
  createdBy?: string;
  attendees: string[];
  status: string;
  photos?: string[];
};

type EventsContextType = {
  events: Event[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  addEvent: (event: Event) => void;
  updateEvent: (eventId: string, updates: Partial<Event>) => void;
  deleteEvent: (eventId: string) => void;
};

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/eventCreation");
      if (!res.ok) throw new Error("Failed to fetch events");

      const data = await res.json();
      setEvents(data.events || []);
    } catch (err: any) {
      console.error("Error fetching events:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const addEvent = useCallback((event: Event) => {
    setEvents((prev) => [event, ...prev]);
  }, []);

  const updateEvent = useCallback((eventId: string, updates: Partial<Event>) => {
    setEvents((prev) =>
      prev.map((event) => (event._id === eventId ? { ...event, ...updates } : event))
    );
  }, []);

  const deleteEvent = useCallback((eventId: string) => {
    setEvents((prev) => prev.filter((event) => event._id !== eventId));
  }, []);

  return (
    <EventsContext.Provider
      value={{
        events,
        loading,
        error,
        refetch: fetchEvents,
        addEvent,
        updateEvent,
        deleteEvent,
      }}
    >
      {children}
    </EventsContext.Provider>
  );
}

export function useEvents() {
  const context = useContext(EventsContext);
  if (context === undefined) {
    throw new Error("useEvents must be used within an EventsProvider");
  }
  return context;
}
