import { toast } from "sonner";
import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSession } from "next-auth/react";
import { CalendarPlus, ImagePlus } from "lucide-react";

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!session?.user) {
      toast.error("You must be logged in to create or edit an event.");
      return;
    }

    const combinedStartDate = new Date(`${startDate}T${startTime}`);

    if (!title || !description || !startDate || !endDate) {
      toast("Please fill in all required fields.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
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

      toast(eventToEdit ? "Event updated successfully!" : "Event created successfully!");

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
  onSubmit={handleSubmit} // handle form submission
  className="mx-auto max-w-2xl space-y-5 rounded-[28px] border border-white/10 bg-slate-900/20 p-6 text-white shadow-inner shadow-blue-900/30"
>
  <div className="space-y-2 text-center">
    <p className="text-xs uppercase tracking-[0.5em] text-blue-200/70">
      {eventToEdit ? "Update event" : "New event"} {/* show update or new based on editing state */}
    </p>
    <h2 className="text-3xl font-semibold">
      {eventToEdit ? "Refresh the experience" : "Design a new moment"} {/* main title */}
    </h2>
    <p className="text-sm text-white/70">
      This is a {isEventPublic ? "public" : "private"} event {/* display event privacy */}
    </p>
  </div>

  <div className="space-y-4">
    <input
      type="text"
      placeholder="Event title"
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      value={title} // bind input value to title state
      onChange={(e) => setTitle(e.target.value)} // update title state on change
    />
    <textarea
      placeholder="Tell guests what makes this event special..."
      className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      value={description} // bind input value to description state
      onChange={(e) => setDescription(e.target.value)} // update description state on change
    />
  </div>

  <div className="grid gap-4 md:grid-cols-2">
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-[0.4em] text-white/50">
        Start date
      </label>
      <input
        type="date"
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        value={startDate} // bind start date
        onChange={(e) => setStartDate(e.target.value)} // update start date on change
      />
    </div>
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-[0.4em] text-white/50">
        End date
      </label>
      <input
        type="date"
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        value={endDate} // bind end date
        onChange={(e) => setEndDate(e.target.value)} // update end date on change
      />
    </div>
  </div>
    <div className="flex flex-col md:flex-row gap-4 items-end">
  {/* start time */}
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

  {/* guest limit toggle */}
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
      {isPeopleLimitChecked ? `Max ${guestLimit || 0} guests` : "Unlimited guests"}
    </p>
  </div>

  {/* conditional guest number input */}
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
  <div className="space-y-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-center">
    {imageBase64 ? (
      <div className="space-y-3">
        <img
          src={imageBase64}
          alt="Selected"
          className="mx-auto h-40 w-full rounded-2xl object-cover"
        />
        <p className="text-sm text-white/70">Change cover image</p> {/* show current image */}
      </div>
    ) : (
      <div className="flex flex-col items-center gap-3 text-white/70">
        <ImagePlus className="h-8 w-8" /> {/* placeholder icon */}
        <p className="text-sm">Upload a hero image</p> {/* prompt upload */}
      </div>
    )}
    <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
      <input type="file" className="hidden" onChange={handleImageChange} /> {/* file input */}
      Choose file
    </label>
  </div>

  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
    <div>
      <p className="text-sm font-semibold text-white">Public event</p>
      <p className="text-xs text-white/60">
        {isEventPublic
          ? "Visible to all Eventful members"
          : "Only invited guests see this"} {/* show privacy info */}
      </p>
    </div>
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-white/30 bg-transparent text-blue-500 focus:ring-blue-500"
        checked={isEventPublic} // bind public/private state
        onChange={handlePrivacyChange} // toggle public/private
      />
      Public
    </label>
  </div>

  <div className="flex items-center justify-end">
    <button
      type="submit"
      className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={loading} // disable while submitting
    >
      {loading
        ? "Saving..."
        : eventToEdit
        ? "Update event"
        : "Create event"} {/* button text changes based on state */}
    </button>
  </div>
</form>
  );
}