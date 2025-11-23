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
import { CalendarPlus, ImagePlus } from "lucide-react";
import { addNotificationToStorage } from "./notification-utils";

type CategoryRule = {
  name: string;
  regex: RegExp;
  overpass: {
    key: string;
    value: string;
  };
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    name: "Music",
    regex: /(concert|music|dj|karaoke|band|gig)/i,
    overpass: { key: "amenity", value: "nightclub" },
  },
  {
    name: "Food & Drink",
    regex: /(dinner|brunch|tasting|food|restaurant|wine|cocktail|coffee)/i,
    overpass: { key: "amenity", value: "restaurant" },
  },
  {
    name: "Sports",
    regex: /(match|game|tournament|yoga|run|football|basketball|tennis|sport)/i,
    overpass: { key: "leisure", value: "pitch" },
  },
  {
    name: "Art & Culture",
    regex: /(art|gallery|museum|exhibit|culture|theatre|theater)/i,
    overpass: { key: "tourism", value: "museum" },
  },
  {
    name: "Tech & Business",
    regex: /(startup|tech|coding|developer|business|networking|conference|meetup)/i,
    overpass: { key: "office", value: "it" },
  },
];

type Coordinates = { lat: number; lon: number };

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
      <DialogContent className="max-w-3xl rounded-[32px] border border-white/10 bg-slate-950/80 text-white shadow-[0_40px_120px_rgba(15,23,42,0.45)] backdrop-blur-2xl">
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
      <DialogContent className="max-w-3xl rounded-[32px] border border-white/10 bg-slate-950/80 text-white shadow-[0_40px_120px_rgba(15,23,42,0.45)] backdrop-blur-2xl">
        <CreateEvent />
      </DialogContent>
    </Dialog>
  );
}

type EventToEdit = {
  _id: string;
  title?: string;
  description?: string;
  location?: string;
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
      setLocation(eventToEdit.location || "");

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
      return;
    }
    const match = CATEGORY_RULES.find((rule) => rule.regex.test(title));
    setDetectedCategory(match ?? null);
  }, [title]);

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
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lon}`
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
        `https://overpass-api.de/api/interpreter?data=${encoded}`
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
      className="mx-auto max-w-2xl space-y-5 rounded-[28px] border border-white/10 bg-slate-900/20 p-6 text-white shadow-inner shadow-blue-900/30"
    >
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-blue-200/70">
          {eventToEdit ? "Update event" : "New event"} {/* show update or new based on editing state */}
        </p>
        <DialogTitle className="text-3xl font-semibold text-white">
          {eventToEdit ? "Refresh the experience" : "Design a new moment"} {/* main title */}
        </DialogTitle>
        <DialogDescription className="text-sm text-white/70">
          This is a {isEventPublic ? "public" : "private"} event {/* display event privacy */}
        </DialogDescription>
      </div>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="Event title"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Tell guests what makes this event special..."
          className="min-h-[40px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.4em] text-white/50">
            Location
          </label>
          <input
            type="text"
            placeholder="City, venue, address"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              if (locationError) {
                setLocationError(null);
              }
            }}
          />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={requestLocationSuggestions}
            disabled={isLocating}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLocating ? "Finding nearby places..." : "Suggest near me"}
          </button>
          <button
            type="button"
            onClick={fetchTitleBasedSuggestions}
            disabled={isFetchingTitleSuggestions || !detectedCategory}
            className="rounded-full border border-emerald-300/40 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isFetchingTitleSuggestions
              ? "Searching nearby venues..."
              : "Suggest based on title"}
          </button>
          {locationError && (
            <span className="text-xs text-red-200">{locationError}</span>
          )}
          {detectedCategory && (
            <span className="text-xs text-emerald-200">
              Detected category: {detectedCategory.name}
            </span>
          )}
        </div>
        {locationSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {locationSuggestions.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                onClick={() => setLocation(suggestion)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 transition hover:bg-white/10"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        {titleSuggestionError && (
          <p className="text-xs text-amber-200">{titleSuggestionError}</p>
        )}
        {titlePlaceSuggestions.length > 0 && (
          <div className="rounded-2xl border border-emerald-200/20 bg-emerald-900/10 p-3 text-xs text-emerald-50">
            <p className="mb-2 font-semibold uppercase tracking-[0.3em] text-emerald-200">
              Suggested venues
            </p>
            <div className="flex flex-wrap gap-2">
              {titlePlaceSuggestions.map((place) => (
                <button
                  type="button"
                  key={place.label}
                  onClick={() => setLocation(place.value || place.label)}
                  className="rounded-xl border border-emerald-300/30 bg-white/5 px-3 py-1 text-left text-[11px] text-white/90 transition hover:bg-white/20"
                >
                  {place.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.4em] text-white/50">
            Start date
          </label>
          <input
            type="date"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.4em] text-white/50">
            End date
          </label>
          <input
            type="date"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-4 items-end md:flex-row">
        <div className="flex-1 space-y-2">
          <label className="text-xs uppercase tracking-[0.4em] text-white/50">
            Start time
          </label>
          <input
            type="time"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="flex-1 flex flex-col space-y-1">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/30 bg-transparent text-blue-500 focus:ring-blue-500"
              checked={isPeopleLimitChecked}
              onChange={handleGuestChange}
            />
            Limit
          </label>
          <p className="text-sm font-semibold text-white">
            {isPeopleLimitChecked
              ? `Max ${guestLimit || 0} guests`
              : "Unlimited guests"}
          </p>
        </div>
        {isPeopleLimitChecked && (
          <div className="flex-1 space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-white/50">
              Number of guests
            </label>
            <input
              type="number"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              value={guestLimit}
              onChange={(e) => setGuestLimit(Number(e.target.value))}
            />
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-center">
        {imageBase64 ? (
          <div className="space-y-2">
            <img
              src={imageBase64}
              alt="Selected"
              className="mx-auto h-40 w-full rounded-2xl object-cover"
            />
            <p className="text-sm text-white/70">Change cover image</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/70">
            <p className="text-sm">Upload a hero image</p>
          </div>
        )}
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
          <input type="file" className="hidden" onChange={handleImageChange} />
          Choose file
        </label>
      </div>

      <div className="flex items-center justify-between ">
         <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 gap-4">
        
        <div>
          <p className="text-sm font-semibold text-white">{isEventPublic ? "Public" : "Private"} event</p>
          <p className="text-xs text-white/60">
            {isEventPublic
              ? "Visible to all Eventful members"
              : "Only invited guests see this"}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
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
          className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Saving..." : eventToEdit ? "Update event" : "Create event"}
        </button>
      </div>
      

     
    </form>
  )
}
