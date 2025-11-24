"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Navbar from "@/components/ui/navigation-menu";
import { DateTime } from 'luxon';
import React, { use, useCallback, useEffect, useMemo, useState, useRef } from "react";
import ProfilePost from "@/components/ui/post";
import { signOut } from "next-auth/react"
import Link from "next/link";
import User from "../models/user";
import { getToken } from "next-auth/jwt";
import { param } from "jquery";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import Footer from "@/components/ui/footer";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { useTranslation } from "react-i18next";

type CountryOption = {
  code: string;
  name: string;
  region: string;
  subregion: string;
};

type CalendarHighlight = {
  id: string;
  date: Date;
  title: string;
  time?: string;
  description?: string;
  href?: string;
  role?: string;
};

export default function UserProfile() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useTranslation();
  const [userSession, setUserSession] = useState(Object);
  const [imageSrc, setImageSrc] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [attendingEvents, setAttendingEvents] = useState<any[]>([]);
  const userId = session?.user?.id;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attendingIndex, setAttendingIndex] = useState(0);
  const [openSettings, setOpenSettings] = useState(false);
  const [email, setEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [password, setPassword] = useState("********");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [birthday, setBirthday] = useState({
    day: "01",
    month: "December",
    year: "1994",
  });
  const [receiveEmails, setReceiveEmails] = useState(false);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [user, setUser] = useState<any>(null);

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const justUploadedRef = useRef(false);
   const [date, setDate] = React.useState<Date | undefined>(new Date())


  const handleSave = async () => {
    if (!session?.user?.email) {
      toast("Missing user session.");
      return;
    }

    const payload: Record<string, string> = { email: session.user.email };
    const trimmedName = newName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedUsername = newUsername.trim();

    // Note: Image is already uploaded via handleFileChange, no need to send it here
    if (trimmedName && trimmedName !== user?.name) {
      payload.name = trimmedName;
    }
    if (trimmedLastName && trimmedLastName !== user?.lastName) {
      payload.lastName = trimmedLastName;
    }
    if (trimmedUsername && trimmedUsername !== user?.username) {
      payload.username = trimmedUsername;
    }

    if (Object.keys(payload).length === 1) {
      toast("No changes to save.");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/register", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Profile update failed:", text);
        throw new Error("Failed to update profile");
      }

      const data = await response.json();
      if (data?.user) {
        setUser(data.user);
        setFileUrl(data.user.image ?? null);
      }
      await fetch("/api/auth/session?update=true");
      toast("Profile updated!");
      setNewName("");
      setLastName("");
      setNewUsername("");
      setOpenSettings(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };
  // fetch all events
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch("/api/eventCreation");
        if (!res.ok) throw new Error("Failed to fetch events");
        const data = await res.json();
        setPosts(data.events || []);
        const userAttendingEvents = data.events?.filter(
          (event: any) => event.attendees?.includes(userId)
        ) || [];
        setAttendingEvents(userAttendingEvents);
      } catch (error) {
        console.error(error);
      }
    };
    if (userId) {
      fetchPosts();
    }


    fetchPosts();
  }, [userId]);
  //filter events created by user
  const isEventCreatedByCurrentUser = (event: any) => {
    if (!event || !userId) {
      return false;
    }

    const createdBy = event.createdBy;
    if (typeof createdBy === "string" && createdBy === userId) {
      return true;
    }
    if (createdBy && typeof createdBy === "object") {
      if (typeof createdBy._id === "string" && createdBy._id === userId) {
        return true;
      }
      if (createdBy._id?.toString && createdBy._id.toString() === userId) {
        return true;
      }
      if (createdBy.toString && createdBy.toString() === userId) {
        return true;
      }
    }

    if (user?.username && event.createdByName) {
      return event.createdByName === user.username;
    }

    return false;
  };

  const filteredEvents = posts.filter((event) => isEventCreatedByCurrentUser(event));
  const eventsPerPage = 2;
  const paginatedEvents = filteredEvents.slice(currentIndex, currentIndex + eventsPerPage);
  const paginatedAttendingEvents = attendingEvents.slice(attendingIndex, attendingIndex + eventsPerPage);
  const nextPage = () => {
    if (currentIndex + eventsPerPage < filteredEvents.length) {
      setCurrentIndex(currentIndex + eventsPerPage);
    }
  };

  const prevPage = () => {
    if (currentIndex - eventsPerPage >= 0) {
      setCurrentIndex(currentIndex - eventsPerPage);
    }
  };
  const nextAttendingPage = () => {
    if (attendingIndex + eventsPerPage < attendingEvents.length) {
      setAttendingIndex(attendingIndex + eventsPerPage);
    }
  };

  const prevAttendingPage = () => {
    if (attendingIndex - eventsPerPage >= 0) {
      setAttendingIndex(attendingIndex - eventsPerPage);
    }
  };

  useEffect(() => {
    setAttendingIndex(0);
  }, [attendingEvents.length]);
  // manage page counter and user status
  let eventCounter = filteredEvents.length;
  let userStatus = "";
  if (eventCounter === 0) {
    userStatus = "Newbie";
  }
  else if (eventCounter > 0 && eventCounter < 5) {
    userStatus = "Rising Star";
  }
  else if (eventCounter >= 5 && eventCounter < 10) {
    userStatus = "Entusiast";
  }
  else if (eventCounter >= 10 && eventCounter < 15) {
    userStatus = "Event Architect";
  }
  else if (eventCounter >= 15) {
    userStatus = "Legend";
  }

  const calendarHighlights = useMemo<CalendarHighlight[]>(() => {
    const map = new Map<string, any>();
    const combined = [...filteredEvents, ...attendingEvents];

    combined.forEach((event: any) => {
      if (!event?._id || map.has(event._id)) return;
      map.set(event._id, event);
    });

    return Array.from(map.values())
      .map((event: any) => {
        if (!event?.startDate) return null;
        const start = new Date(event.startDate);
        if (isNaN(start.getTime())) return null;

        const locationSnippet = event.location?.name ? `${event.location.name} · ` : "";
        return {
          id: event._id,
          date: start,
          title: event.title || t("event_title_fallback"),
          time: start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          description: `${locationSnippet}${event.description?.slice(0, 100) ?? ""}`.trim(),
          href: `/events/${event._id}`,
          role: isEventCreatedByCurrentUser(event)
            ? t("calendar_role_hosting")
            : t("calendar_role_attending"),
        } satisfies CalendarHighlight;
      })
      .filter(Boolean) as CalendarHighlight[];
  }, [attendingEvents, filteredEvents, t]);



  useEffect(() => {
    if (session && !isUploadingImage && !justUploadedRef.current) {
      const customSession: any = session;
      const { picture } = customSession.accessToken;
      setUserSession(session);
      setImageSrc(picture || '');
      setFileUrl((prev) => prev || picture || '');
    }
  }, [session, isUploadingImage]);

  // manage country in settings

  const [selectedCountry, setSelectedCountry] = useState(null);
  const [region, setRegion] = useState(null);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch("/api/countries");
        if (!response.ok) {
          throw new Error("Failed to fetch countries");
        }
        const data: CountryOption[] = await response.json();
        setCountries(data);
      } catch (error) {
        console.error("Error fetching countries:", error);
      }
    };

    fetchCountries();
  }, []);

  const handleCountrySelect = async (countryName: string) => {
    try {
      const response = await fetch(`/api/countries?name=${encodeURIComponent(countryName)}`);
      if (response.status === 404) {
        setSelectedCountry(null);
        setRegion(null);
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch country");
      }
      const data: CountryOption[] = await response.json();

      if (data.length > 0) {
        const selectedCountry = data[0];
        // setSelectedCountry(selectedCountry.name);
        // setRegion(selectedCountry.region);
      }
    } catch (error) {
      console.error("Error fetching country data:", error);
    }
  };
  useEffect(() => {
    if (country) {
      handleCountrySelect(country);
    } else {
      setSelectedCountry(null);
      setRegion(null);
    }
  }, [country]);

  useEffect(() => {
    if (session?.user.email !== "") {
      // getUserById(); 
    }
  }, [fileUrl])

  // manage profile pic upload - save to disk instead of base64

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    try {
      setIsUploadingImage(true);
      justUploadedRef.current = true;
      
      const reader = new FileReader();
      reader.onload = (e) => setFileUrl(e.target?.result as string);
      reader.readAsDataURL(file);

      // Upload file to server
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);

      const response = await fetch("/api/upload-profile-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const data = await response.json();
      const newImageUrl = data.imageUrl;
      
      setFileUrl(newImageUrl);
      setUser((prev: any) => ({
        ...prev,
        image: newImageUrl
      }));
      
      window.dispatchEvent(new CustomEvent('profileImageUpdated', { 
        detail: { imageUrl: newImageUrl } 
      }));
      
      setTimeout(async () => {
        try {
          const refreshResponse = await fetch("/api/currentUser", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: session?.user?.email }),
            cache: 'no-store'
          });
          
          if (refreshResponse.ok) {
            const refreshedData = await refreshResponse.json();
            if (refreshedData?.user?.image === newImageUrl) {
              console.log("Image upload verified");
            }
          }
        } catch (error) {
          console.error("Error verifying image upload:", error);
        }
        
        setTimeout(() => {
          justUploadedRef.current = false;
        }, 2000);
      }, 500);
      
      toast.success("Image uploaded successfully!");
      
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
      // Revert to original image on error
      if (user?.image) {
        setFileUrl(user.image);
      }
      justUploadedRef.current = false;
    } finally {
      setIsUploadingImage(false);
    }
  };
  const fetchUserByEmail = useCallback(async () => {
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
      
      if (data.user) {
        setUser(data.user);
        if (!justUploadedRef.current) {
          setFileUrl(data.user.image || null);
        }
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (session?.user?.email && !isUploadingImage && !justUploadedRef.current) {
      fetchUserByEmail();
    }
  }, [session?.user?.email, fetchUserByEmail, isUploadingImage]);



  // manage refresh after profile update§
  const handleToggleSettings = () => {
    if (openSettings) {
      router.refresh();
    }
    setOpenSettings((prev) => !prev);
  };



  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 px-4 py-12 flex items-center justify-center">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </>
    );
  }

  // Don't render profile if not authenticated
  if (!session) {
    return null;
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 px-4 py-12">
        <div className="mx-auto w-full max-w-7xl grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* left side */}

          <aside className="rounded-3xl border border-white/5 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-6 shadow-2xl text-white flex flex-col items-center gap-4">
            <div className="w-full flex items-center justify-between text-white/70 text-sm uppercase tracking-wide">
              <h2>Your Profile</h2>
              {user?.role == "admin" && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">Admin</span>}
            </div>
            <div className="relative w-28 h-28 rounded-full bg-white/10 p-1 shadow-lg shadow-blue-900/30">
              <img
                src={user?.image ? user?.image : "https://cdn.pfps.gg/pfps/2301-default-2.png"}
                className="w-full h-full rounded-full object-cover"
              />
              <span className="absolute -bottom-1 -right-1 rounded-full bg-white text-slate-900 text-xs px-2 py-0.5">LvL</span>
            </div>

            <div className="text-center space-y-1">
              <h1 className="text-2xl font-semibold">{(user?.name || "") + " " + (user?.lastName || "")}</h1>
              <h2 className="text-sm text-white/70">@{user?.username}</h2>
            </div>
            <div className="w-full">
              <HoverCard>
                <HoverCardTrigger className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-2 text-sm font-medium shadow-inner">{userStatus}
                  <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse"></span>
                </HoverCardTrigger>
                <HoverCardContent className="bg-gradient-to-b to-slate-950 via-blue-800 from-indigo-700  text-slate-400 p-4 rounded-2xl shadow-xl border border-slate-100">
                  <div>
                    <span role="img" aria-label="flower">✿</span> <strong>Newbie</strong> - Starting your journey. 0 events created. Keep pushing!
                  </div>
                  <div>
                    <span role="img" aria-label="star">✿ ✿</span> <strong>Rising Star</strong> - You’re on the rise! 1–4 events created. Let’s keep this momentum going!
                  </div>
                  <div>
                    <span role="img" aria-label="fire">✿ ✿ ✿</span> <strong>Enthusiast</strong> - You love what you do! 5–9 events created. The passion is real.
                  </div>
                  <div>
                    <span role="img" aria-label="blueprint">✿ ✿ ✿ ✿</span> <strong>Event Architect</strong> - Crafting experiences! 10–14 events created. You're shaping the scene.
                  </div>
                  <div>
                    <span role="img" aria-label="crown">✿ ✿ ✿ ✿ ✿</span> <strong>Legend</strong> - A force to be reckoned with! 15+ events created. You’re an icon in the making.
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>

            <div className="text-center space-y-1">
              <p className="text-4xl font-black">{eventCounter}</p>
              <p className="text-white/70 text-sm">events created</p>
            </div>

            <div className="flex flex-col w-full gap-3 pt-4">
              <button onClick={handleToggleSettings} className="w-full rounded-2xl bg-white/15 px-4 py-3 text-sm font-semibold tracking-wide text-white shadow-lg shadow-blue-900/30 transition hover:bg-white/25">{openSettings ? "Done" : "Edit profile"}</button>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold tracking-wide text-slate-900 transition hover:bg-slate-100">Sign out</button>
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                highlightedEvents={calendarHighlights}
                className="rounded-lg border border-white/10 bg-white/85 backdrop-blur-xl p-5 shadow-2xl text-sm font-medium text-indigo-700"
              />
            </div>
          </aside>
          {/* IF settings are open */}
          {openSettings ?

            <>
              {/* Right Side - Settings Section */}
              <section className="rounded-3xl border border-white/10 bg-white/85 backdrop-blur-xl p-8 shadow-2xl space-y-8">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Profile settings</p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-3xl font-semibold text-slate-900">Make it yours</h1>
                    <span className="rounded-full bg-blue-100 px-4 py-1 text-sm font-semibold text-blue-700 shadow-inner">Live Preview</span>
                  </div>
                </div>
                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                  <div className="relative mx-auto md:mx-0 w-28 h-28 rounded-full bg-gradient-to-br from-blue-50 to-white p-1 shadow-inner shadow-blue-200">
                    <img
                      src={fileUrl ? fileUrl : user?.image}
                      className="w-full h-full rounded-full object-cover"
                    />
                    {isUploadingImage && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white"></div>
                      </div>
                    )}
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 text-white text-[10px] px-3 py-0.5 shadow-lg">
                      {isUploadingImage ? "Uploading..." : "Preview"}
                    </span>
                  </div>

                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="fileInput" disabled={isUploadingImage} />
                  <button 
                    onClick={() => document.getElementById('fileInput')?.click()} 
                    disabled={isUploadingImage}
                    className="rounded-2xl border border-dashed border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingImage ? "Uploading..." : user?.image ? "Change profile photo" : "Upload profile photo"}
                  </button>
                </div>
                <div className="grid gap-6 md:grid-cols-2">

                  {/* First Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">First Name</label>
                    <input
                      type="text"
                      id="nameInput"
                      placeholder="First Name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  {/* Last Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Last Name</label>
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  {/* Username */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Username</label>
                    <input
                      type="text"
                      placeholder={user?.username ? `@${user.username}` : "Username"}
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
                {/* Email */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Email</label>
                    <input
                      type="email"
                      placeholder={user?.email || "Email"}
                      disabled
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-400 shadow-inner"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Password</label>
                    <input
                      type="password"
                      placeholder="********"
                      disabled
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-400 shadow-inner"
                    />
                  </div>
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">Country</label>
                  <div className="flex items-center space-x-2">
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    >
                      <option value="">Not chosen</option>
                      {countries.map((country) => (
                        <option key={country.code} value={country.name}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>


                {selectedCountry && region && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-inner">
                    <h3 className="font-semibold">{selectedCountry}</h3>
                    <p className="text-blue-900/70">Region: {region}</p>
                  </div>
                )}

                {/* Birthday */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Day</label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      defaultValue=""
                    >
                      <option value="">Day</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Month</label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      defaultValue=""
                    >
                      <option value="">Month</option>
                      {[
                        "January",
                        "February",
                        "March",
                        "April",
                        "May",
                        "June",
                        "July",
                        "August",
                        "September",
                        "October",
                        "November",
                        "December",
                      ].map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Year</label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      defaultValue=""
                    >
                      <option value="">Year</option>
                      {/* Example range: 1985 - 2024 */}
                      {Array.from({ length: 40 }, (_, i) => 1985 + i).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Subscription Checkbox */}
                <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-gradient-to-r from-blue-50 to-sky-50 px-4 py-3 shadow-inner">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Stay in the loop</p>
                    <p className="text-xs text-slate-500">Get curated event inspiration and feature releases.</p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Subscribe
                  </label>
                </div>

                {/* Save Button */}
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:items-center">
                  <button onClick={handleSave} disabled={isSaving} className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/40 transition hover:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
                    {isSaving ? "Saving changes..." : "Save changes"}
                  </button>
                </div>
              </section>
            </>
            : <>
              {/* Right Side - Events Section */}
              <section className="space-y-8 rounded-3xl border border-white/10 bg-white/90 p-8 shadow-2xl backdrop-blur">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Your events</p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-3xl font-semibold text-slate-900">Showcase</h2>
                    <Link href={"/created-events"} className="text-sm font-semibold text-blue-600 hover:text-blue-500">View all</Link>
                  </div>
                </div>

                {/* Created Events */}
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-inner">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Created events</h3>
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600">Page {Math.floor(currentIndex / eventsPerPage) + 1 || 1}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {paginatedEvents.length > 0 ? (
                    <>
                      <button onClick={prevPage} disabled={currentIndex === 0} className={`rounded-full border px-3 py-2 text-lg font-bold transition ${currentIndex === 0 ? 'border-transparent text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-white'}`} >&lt;</button>
                      <div className="flex flex-1 flex-wrap justify-center gap-4">
                        {paginatedEvents.slice().reverse().map((post) => (
                          <div key={post._id} className="w-full md:w-[48%]">
                            <ProfilePost post={post} />
                          </div>
                        ))}
                      </div>
                      <button onClick={nextPage} disabled={currentIndex + eventsPerPage >= filteredEvents.length} className={`rounded-full border px-3 py-2 text-lg font-bold transition ${currentIndex + eventsPerPage >= filteredEvents.length ? 'border-transparent text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-white'}`}>&gt;</button>
                    </>
                       ) : (
                      <p className="text-slate-500">No created events yet.</p>
                    )}

                    </div>
                   
                </div>

                {/*Attending Events Section */}
                <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Attending</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Page {Math.floor(attendingIndex / eventsPerPage) + 1 || 1}</span>
                  </div>
                  {attendingEvents.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={prevAttendingPage}
                        disabled={attendingIndex === 0}
                        className={`rounded-full border px-3 py-2 text-lg font-bold transition ${attendingIndex === 0 ? 'border-transparent text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                      >
                        &lt;
                      </button>
                      <div className="flex flex-1 flex-wrap justify-center gap-4">
                        {paginatedAttendingEvents.slice().reverse().map((event) => (
                          <div key={event._id} className="w-full md:w-[48%]">
                            <ProfilePost post={event} />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={nextAttendingPage}
                        disabled={attendingIndex + eventsPerPage >= attendingEvents.length}
                        className={`rounded-full border px-3 py-2 text-lg font-bold transition ${attendingIndex + eventsPerPage >= attendingEvents.length ? 'border-transparent text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                      >
                        &gt;
                      </button>
                    </div>
                  ) : (
                    <p className="text-slate-500">No attending events yet.</p>
                  )}
                </div>
              </section>
            </>}

        </div>
      </div>

    </>
  )

}
