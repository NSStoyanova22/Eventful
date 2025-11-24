import { toast } from "sonner";
import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSession } from "next-auth/react";
import { CalendarPlus } from "lucide-react";
import { addNotificationToStorage } from "./notification-utils";
import { CategoryRule, CATEGORY_RULES } from "@/app/lib/categoryRules";



type Coordinates = { lat: number; lon: number };
const NOMINATIM_HEADERS = {
  "User-Agent": "EventfulApp/1.0 (info@eventful.local)",
};

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

export function CreateButtonNav() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/40 transition hover:-translate-y-0.5">
          <span className="rounded-full bg-white/20 p-1.5">
            <CalendarPlus className="h-4 w-4" />
          </span>
          Create
        </button>
      </DialogTrigger>
      <DialogContent
  className="
    max-w-3xl
    max-h-[85vh]
    overflow-y-auto
    rounded-[32px]
    border border-white/10
    bg-slate-950/80
    text-white
    shadow-[0_40px_120px_rgba(15,23,42,0.45)]
    backdrop-blur-2xl
  "
>
  <CreateEvent />
</DialogContent>
    </Dialog>
  );
}

export function CreateButtonSide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="group inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
          <CalendarPlus className="h-4 w-4" />
          New event
        </button>
      </DialogTrigger>
   <DialogContent
  className="
    max-w-3xl
    max-h-[85vh]
    overflow-y-auto
    rounded-[32px]
    border border-white/10
    bg-slate-950/80
    text-white
    shadow-[0_40px_120px_rgba(15,23,42,0.45)]
    backdrop-blur-2xl
  "
>
  <CreateEvent />
</DialogContent>
    </Dialog>
  );
}

type EventToEdit = {
  _id: string;
  title?: string;
  description?: string;
  location?: {
    name?: string;
  };
  startDate?: string | Date;
  endDate?: string | Date;
  guestLimit?: number;
  isPublic?: boolean;
  attending?: number;
};

interface CreateEventProps {
  eventToEdit?: EventToEdit;
  onEventUpdated?: (updatedEvent: any) => void;
  onClose?: () => void;
}

export default function CreateEvent({
  eventToEdit,
  onEventUpdated,
  onClose,
}: CreateEventProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(null);
  const [detectedCategory, setDetectedCategory] = useState<CategoryRule | null>(null);
  const [titlePlaceSuggestions, setTitlePlaceSuggestions] = useState<
    { label: string; value: string }[]
  >([]);
  const [isFetchingTitleSuggestions, setIsFetchingTitleSuggestions] = useState(false);
  const [titleSuggestionError, setTitleSuggestionError] = useState<string | null>(null);
  const [weatherSummary, setWeatherSummary] = useState<WeatherSummary | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isPeopleLimitChecked, setIsPeopleLimitChecked] = useState(false);
  const [guestLimit, setGuestLimit] = useState<number>(0);
  const [isEventPublic, setIsEventPublic] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [postImage, setPostImage] = useState<File | null>(null);

  const { data: session } = useSession();

  useEffect(() => {
    if (eventToEdit) {
      setTitle(eventToEdit.title || "");
      setDescription(eventToEdit.description || "");
      setLocation(eventToEdit.location?.name || "");

      if (eventToEdit.startDate) {
        const start = new Date(eventToEdit.startDate);
        setStartDate(start.toISOString().split("T")[0]);
        setStartTime(start.toTimeString().slice(0, 5));
      }
      if (eventToEdit.endDate) {
        const end = new Date(eventToEdit.endDate);
        setEndDate(end.toISOString().split("T")[0]);
      }
      if (eventToEdit.guestLimit && eventToEdit.guestLimit > 0) {
        setIsPeopleLimitChecked(true);
        setGuestLimit(eventToEdit.guestLimit);
      }
      setIsEventPublic(eventToEdit.isPublic || false);
    }
  }, [eventToEdit]);

  useEffect(() => {
    if (!title) {
      setDetectedCategory(null);
      setTitlePlaceSuggestions([]);
      setTitleSuggestionError(null);
      return;
    }
    const match = CATEGORY_RULES.find((rule) => rule.regex.test(title));
    setDetectedCategory(match ?? null);
    setTitlePlaceSuggestions([]);
    setTitleSuggestionError(null);
  }, [title]);

  useEffect(() => {
    if (!location || !startDate) {
      setWeatherSummary(null);
      setWeatherError(null);
      return;
    }

    const startDateTime = startTime
      ? `${startDate}T${startTime}`
      : `${startDate}T00:00`;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setWeatherLoading(true);
        setWeatherError(null);
        const response = await fetch("/api/weather/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationName: location,
            startDate: startDateTime,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch weather");
        }
        const data = await response.json();
        setWeatherSummary(data.summary);
      } catch (error: any) {
        if (error.name === "AbortError") return;
        console.error("Weather diagnostics error:", error);
        setWeatherError(error.message || "Unable to fetch weather.");
        setWeatherSummary(null);
      } finally {
        setWeatherLoading(false);
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [location, startDate, startTime]);

  function handleGuestChange(e: React.ChangeEvent<HTMLInputElement>) {
    setIsPeopleLimitChecked(e.target.checked);
  }

  function handlePrivacyChange(e: React.ChangeEvent<HTMLInputElement>) {
    setIsEventPublic(e.target.checked);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Only JPG, PNG, and WebP images are allowed.");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image must be smaller than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
        setPostImage(file);
      };
      reader.onerror = () => {
        toast.error("Failed to read the selected image.");
      };
      reader.readAsDataURL(file);
    }
  }

  function addFlaggedNotification(eventName: string) {
    const flaggedMessage = `Event "${eventName}" was flagged for review. Only you can see it until it's updated or deleted.`;
    addNotificationToStorage(
      { message: flaggedMessage, icon: "ShieldAlert" },
      { dedupeByMessage: true }
    );
  }

  function getCurrentPosition(): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported in this browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          setUserCoordinates(coords);
          resolve(coords);
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  async function requestLocationSuggestions() {
    setIsLocating(true);
    try {
      const coords = userCoordinates || (await getCurrentPosition());
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lon}`,
        { headers: NOMINATIM_HEADERS }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch location details");
      }
      const data = await response.json();
      const address = data.address || {};
      const suggestions = [
        [address.road, address.neighbourhood, address.city].filter(Boolean).join(", "),
        [address.city || address.town || address.village, address.state]
          .filter(Boolean)
          .join(", "),
        data.display_name,
        `Near (${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)})`,
      ]
        .filter((entry) => entry && entry.trim().length > 0)
        .filter((value, index, arr) => arr.indexOf(value) === index);

      setLocationSuggestions(suggestions as string[]);
      setLocationError(null);
      if (!location && suggestions.length > 0) {
        setLocation(suggestions[0] as string);
      }
    } catch (geoError: any) {
      console.error("Failed to resolve location:", geoError);
      setLocationSuggestions([
        userCoordinates
          ? `Near coordinates (${userCoordinates.lat.toFixed(3)}, ${userCoordinates.lon.toFixed(
              3
            )})`
          : "Unable to determine coordinates",
      ]);
      setLocationError(
        geoError?.message || "Could not determine exact address. Using coordinates instead."
      );
    } finally {
      setIsLocating(false);
    }
  }

  function calculateDistance(
    from: Coordinates,
    to: { lat: number; lon: number }
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(to.lat - from.lat);
    const dLon = toRad(to.lon - from.lon);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(from.lat)) *
        Math.cos(toRad(to.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function fetchTitleBasedSuggestions() {
    if (!detectedCategory) {
      toast("Add more details to the title so we can detect a category.");
      return;
    }

    setIsFetchingTitleSuggestions(true);
    try {
      const coords = userCoordinates || (await getCurrentPosition());
      const query = `
        [out:json][timeout:25];
        (
          node["${detectedCategory.overpass.key}"="${detectedCategory.overpass.value}"](around:5000,${coords.lat},${coords.lon});
          way["${detectedCategory.overpass.key}"="${detectedCategory.overpass.value}"](around:5000,${coords.lat},${coords.lon});
          relation["${detectedCategory.overpass.key}"="${detectedCategory.overpass.value}"](around:5000,${coords.lat},${coords.lon});
        );
        out center;
      `;
      const encoded = encodeURIComponent(query);
      const response = await fetch(
        `https://overpass-api.de/api/interpreter?data=${encoded}`,
        {
          headers: {
            "User-Agent": "EventfulApp/1.0 (info@eventful.local)",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch suggested places");
      }

      const data = await response.json();
      const elements = Array.isArray(data?.elements) ? data.elements : [];

      const places = elements
        .map((element: any) => {
          const elementCoords = {
            lat: element.lat ?? element.center?.lat,
            lon: element.lon ?? element.center?.lon,
          };
          if (!elementCoords.lat || !elementCoords.lon) return null;

          const distance = calculateDistance(coords, elementCoords);
          const name =
            element.tags?.name ||
            element.tags?.["addr:street"] ||
            detectedCategory.name;
          const descriptionParts = [
            name,
            element.tags?.["addr:street"],
            element.tags?.city || element.tags?.["addr:city"],
          ].filter(Boolean);

          return {
            label: `${name} • ${distance.toFixed(1)} km away`,
            value: descriptionParts.join(", "),
            distance,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.distance - b.distance)
        .slice(0, 5) as { label: string; value: string }[];

      if (!places.length) {
        setTitleSuggestionError("No nearby places found for this category.");
      } else {
        setTitleSuggestionError(null);
      }
      setTitlePlaceSuggestions(places);
    } catch (error: any) {
      console.error("Error fetching title-based suggestions:", error);
      setTitleSuggestionError(error?.message || "Failed to fetch suggestions.");
    } finally {
      setIsFetchingTitleSuggestions(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!session?.user) {
      toast.error("You must be logged in to create or edit an event.");
      return;
    }

    const combinedStartDate = new Date(`${startDate}T${startTime}`);

    const trimmedLocation = location.trim();

    if (!title || !description || !startDate || !endDate || !trimmedLocation) {
      toast("Please fill in all required fields.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("location", trimmedLocation);
    formData.append("startDate", combinedStartDate.toISOString());
    formData.append("endDate", new Date(endDate).toISOString());
    formData.append("isPublic", JSON.stringify(isEventPublic));
    formData.append(
      "guestLimit",
      isPeopleLimitChecked ? guestLimit.toString() : "0"
    );

    if (imageBase64) {
      formData.append("imageBase64", imageBase64);
    }

    try {
      let response;

      if (eventToEdit) {
        response = await fetch(`/api/events/${eventToEdit._id}`, {
          method: "PUT",
          body: formData,
          credentials: "include",
        });
      } else {
        formData.append("attending", "0");
        formData.append(
          "userId",
          (session?.user as { id?: string })?.id?.toString() || ""
        );
        response = await fetch("/api/eventCreation", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save event");
      }

      const data = await response.json();
      const moderationStatus = data.status as string | undefined;
      const successMessage = eventToEdit
        ? "Event updated successfully!"
        : "Event created successfully!";

      if (moderationStatus === "flagged") {
        const flaggedMessage = `Event "${title || "Untitled event"}" was flagged for review and is only visible to you. Please revise or delete it.`;
        toast(flaggedMessage);
        addFlaggedNotification(title || "Untitled event");
      } else {
        toast(successMessage);
      }

      if (onEventUpdated) {
        onEventUpdated(data.event);
      }

      if (onClose) {
        onClose();
      }

      setTitle("");
      setDescription("");
      setStartDate("");
      setStartTime("");
      setEndDate("");
      setLocation("");
      setLocationSuggestions([]);
      setIsPeopleLimitChecked(false);
      setGuestLimit(0);
      setIsEventPublic(false);
      setImageBase64(null);
      setWeatherSummary(null);
      setWeatherError(null);
      setTitlePlaceSuggestions([]);
      setTitleSuggestionError(null);
    } catch (error: any) {
      console.error("Error creating/updating event:", error);
      toast.error(`Something went wrong: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

 return (
  <form
    onSubmit={handleSubmit}
    className="
      mx-auto w-full max-w-2xl
      rounded-[28px] border border-white/10
      bg-slate-900/20 p-5 text-white
      shadow-inner shadow-blue-900/30
      flex flex-col gap-4
      h-full
    "
  >
    {/* ---------- HEADER ---------- */}
    <div className="text-center space-y-1">
      <p className="text-[10px] uppercase tracking-[0.45em] text-blue-200/70">
        {eventToEdit ? "Update event" : "New event"}
      </p>

      <DialogTitle className="text-2xl font-semibold text-white">
        {eventToEdit ? "Refresh the experience" : "Design a new moment"}
      </DialogTitle>

      <DialogDescription className="text-xs text-white/60">
        This is a {isEventPublic ? "public" : "private"} event
      </DialogDescription>
    </div>

    <div className="flex-1 overflow-y-auto pr-1 space-y-3">
      {/* Title + Location in 1 row */}
      <div className="grid gap-3 md:grid-cols-2">
        <input
          type="text"
          placeholder="Event title"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          type="text"
          placeholder="City, venue, address"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            if (locationError) setLocationError(null);
          }}
        />
      </div>

      {/* Description (shorter) */}
      <textarea
        placeholder="Tell guests what makes this event special..."
        className="min-h-[70px] max-h-[130px] w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {/* Location actions row */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] uppercase tracking-[0.35em] text-white/50"> Location suggestions:</p>
        <button
          type="button"
          onClick={requestLocationSuggestions}
          disabled={isLocating}
          className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLocating ? "Finding..." : "Near me"}
        </button>

        <button
          type="button"
          onClick={fetchTitleBasedSuggestions}
          disabled={isFetchingTitleSuggestions || !detectedCategory}
          className="rounded-full border border-emerald-300/40 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isFetchingTitleSuggestions ? "Searching..." : "By title"}
        </button>

        {locationError && (
          <span className="text-[11px] text-red-200">{locationError}</span>
        )}

        {detectedCategory && (
          <span className="text-[11px] text-emerald-200">
            Detected: {detectedCategory.name}
          </span>
        )}
      </div>

      {/* Location suggestions */}
      {locationSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {locationSuggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => setLocation(suggestion)}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80 transition hover:bg-white/10"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Title suggestion error */}
      {titleSuggestionError && (
        <p className="text-[11px] text-amber-200">{titleSuggestionError}</p>
      )}

      {/* Title-based venue suggestions */}
      {titlePlaceSuggestions.length > 0 && (
        <div className="rounded-xl border border-emerald-200/20 bg-emerald-900/10 p-3 text-[11px] text-emerald-50 space-y-2">
          <p className="font-semibold uppercase tracking-[0.3em] text-emerald-200 text-[10px]">
            Suggested venues
          </p>
          <div className="flex flex-wrap gap-2">
            {titlePlaceSuggestions.map((place) => (
              <button
                type="button"
                key={place.label}
                onClick={() => setLocation(place.value || place.label)}
                className="rounded-lg border border-emerald-300/30 bg-white/5 px-3 py-1 text-left text-[11px] text-white/90 transition hover:bg-white/20"
              >
                {place.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Weather (compact) */}
      {(weatherSummary || weatherLoading || weatherError) && (
        <div className="rounded-xl border border-sky-200/20 bg-sky-900/10 p-3 text-xs text-white/80">
          {weatherLoading ? (
            <p className="text-sky-200 text-xs">Updating weather...</p>
          ) : weatherSummary ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.25em] text-sky-300">
                Weather
              </p>
              <p className="mt-0.5 text-sm font-semibold text-white leading-tight">
                {weatherSummary.headline}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-y-1 gap-x-2 text-[11px] text-white/70">
                <span>Temp: {weatherSummary.details.temperature}</span>
                <span>Rain: {weatherSummary.details.rainChance}%</span>
                <span>Wind: {weatherSummary.details.wind} kph</span>
                <span>Humidity: {weatherSummary.details.humidity}%</span>
              </div>
              <p className="mt-1 text-[10px] text-white/60 leading-snug">
                {weatherSummary.advice}
              </p>
            </>
          ) : (
            <p className="text-amber-200 text-xs">{weatherError}</p>
          )}
        </div>
      )}

      {/* Dates + time in one tight row */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.35em] text-white/50">
            Start date
          </label>
          <input
            type="date"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.35em] text-white/50">
            End date
          </label>
          <input
            type="date"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.35em] text-white/50">
            Start time
          </label>
          <input
            type="time"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
      </div>

      {/* Guest limit row */}
      <div className="grid gap-3 md:grid-cols-3 items-end">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-white/30 bg-transparent text-blue-500 focus:ring-blue-500"
            checked={isPeopleLimitChecked}
            onChange={handleGuestChange}
          />
          Limit guests
        </label>

        <p className="text-sm font-semibold text-white">
          {isPeopleLimitChecked ? `Max ${guestLimit || 0}` : "Unlimited"}
        </p>

        {isPeopleLimitChecked && (
          <input
            type="number"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            value={guestLimit}
            onChange={(e) => setGuestLimit(Number(e.target.value))}
          />
        )}
      </div>

      {/* Image upload shorter */}
      <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-3 text-center space-y-2">
        {imageBase64 ? (
          <img
            src={imageBase64}
            alt="Selected"
            className="mx-auto h-32 w-full rounded-xl object-cover"
          />
        ) : (
          <p className="text-xs text-white/70">Upload cover image</p>
        )}

        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">
          <input type="file" className="hidden" onChange={handleImageChange} />
          Choose file
        </label>
      </div>
    </div>

    {/* ---------- FOOTER (ALWAYS VISIBLE) ---------- */}
    <div
      className="
        bottom-0
        flex items-center justify-between gap-3
        border-t
        pt-3
        z-50
      "
    >
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-white">
            {isEventPublic ? "Public" : "Private"} event
          </p>
          <p className="text-[10px] text-white/60">
            {isEventPublic ? "Visible to all members" : "Only invited guests"}
          </p>
        </div>

        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-white/30 bg-transparent text-blue-500 focus:ring-blue-500"
            checked={isEventPublic}
            onChange={handlePrivacyChange}
          />
          Public
        </label>
      </div>

      <button
        type="submit"
        className="shrink-0 inline-flex items-center justify-center rounded-full bg-white px-12 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Saving..." : eventToEdit ? "Update" : "Create"}
      </button>
    </div>
  </form>
);
}
