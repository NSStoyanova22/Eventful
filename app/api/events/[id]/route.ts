import { NextResponse } from "next/server";
import { connect } from "@/app/config/dbConfig";
import Event from "@/app/models/event";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import moderateText from "@/app/lib/moderate";
import { geocodeLocation } from "@/app/lib/geocode";
import { ObjectId } from "mongodb";

const normalizeLocation = (event: any) => ({
  name: event.location || "",
  formatted: event.locationFormatted || event.location || "",
  latitude: event.locationLatitude ?? undefined,
  longitude: event.locationLongitude ?? undefined,
});

const formatAttendees = (attendees: any[]) =>
  (attendees || []).map((attendee: any) => ({
    _id: attendee?._id?.toString?.() ?? attendee?._id ?? attendee?.toString?.() ?? "",
    name: attendee?.name || "",
    lastName: attendee?.lastName || "",
    username: attendee?.username || "",
    email: attendee?.email || "",
    image: attendee?.image || "",
  }));

const formatJoinRequests = (requests: any[]) =>
  (requests || []).map((req: any) => ({
    _id: req?._id?.toString?.() ?? req?._id ?? "",
    status: req?.status || "pending",
    createdAt: req?.createdAt,
    user: {
      _id: req?.user?._id?.toString?.() ?? req?.user?.toString?.() ?? "",
      name: req?.user?.name || "",
      lastName: req?.user?.lastName || "",
      username: req?.user?.username || "",
      email: req?.user?.email || "",
      image: req?.user?.image || "",
    },
  }));

export async function GET(request: Request, { params }: any) {
  try {
    await connect();
    const { id } = params;
    const event = await Event.findById(id)
      .populate("attendees")
      .populate("joinRequests.user");

    const session = await getServerSession(authOptions);
    const requesterId = session?.user?.id?.toString();
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const creatorId = event.createdBy?.toString();
    const isHost = Boolean(creatorId && requesterId && creatorId === requesterId);
    const attendeeIds = (event.attendees || []).map((attendee: any) =>
      attendee?._id?.toString?.() ?? attendee?.toString?.()
    );
    const isAttendee = Boolean(requesterId && attendeeIds.includes(requesterId));

    const requestStatus =
      (event as any)?.joinRequests?.find(
        (req: any) => req?.user?.toString?.() === requesterId
      )?.status || "none";

    if (event.status !== "approved" && !isHost) {
      return NextResponse.json({ error: "Event not available" }, { status: 403 });
    }

    const canViewDetails = Boolean(event.isPublic || isHost || isAttendee);

    const serializedEvent =
      typeof event.toObject === "function"
        ? { ...event.toObject(), location: normalizeLocation(event) }
        : { ...event, location: normalizeLocation(event) };
    serializedEvent.requestStatus = requestStatus;
    serializedEvent.canViewDetails = canViewDetails;

    // Remove sensitive fields for private events until approved
    if (!canViewDetails && !event.isPublic) {
      serializedEvent.description = "";
      serializedEvent.location = {
        name: "Hidden until host approves your request",
        formatted: "",
      };
      serializedEvent.photos = [];
      serializedEvent.comments = [];
      serializedEvent.attendees = attendeeIds;
    }

    if (isHost) {
      serializedEvent.joinRequests = formatJoinRequests((event as any).joinRequests);
      serializedEvent.attendees = formatAttendees(event.attendees || []);
    } else {
      serializedEvent.joinRequests = [];
      serializedEvent.attendees = attendeeIds;
    }

    return NextResponse.json(
      { event: serializedEvent, requestStatus, canViewDetails },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: any) {
  if (!params?.id) {
    return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    await connect();
    const event = await Event.findById(params.id).populate("joinRequests.user");

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const creatorId = event.createdBy?.toString?.();
    if (!creatorId || creatorId !== session.user.id.toString()) {
      return NextResponse.json({ error: "Only the host can manage requests" }, { status: 403 });
    }

    const {
      userId,
      action,
    }: { userId?: string; action?: "approve" | "decline" | "remove" } = await request.json();
    if (!userId || !action || !["approve", "decline", "remove"].includes(action)) {
      return NextResponse.json(
        { error: "userId and a valid action (approve|decline|remove) are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(event.joinRequests)) {
      (event as any).joinRequests = [];
    }

    const requestEntry = (event as any).joinRequests.find((r: any) => {
      const reqUser = r?.user;
      const reqUserId =
        reqUser?._id?.toString?.() ??
        (typeof reqUser === "string" ? reqUser : reqUser?.toString?.()) ??
        "";
      return reqUserId === userId;
    });

    if (!Array.isArray(event.attendees)) {
      event.attendees = [];
    }

    if (action === "approve") {
      if (!requestEntry) {
        return NextResponse.json({ error: "Join request not found" }, { status: 404 });
      }
      requestEntry.status = "approved";
      const alreadyAttendee = event.attendees.some(
        (uid: string | ObjectId) => uid.toString() === userId
      );
      if (!alreadyAttendee) {
        event.attendees.push(new ObjectId(userId));
        event.attending = (event.attending ?? 0) + 1;
      }
    } else if (action === "decline") {
      if (!requestEntry) {
        return NextResponse.json({ error: "Join request not found" }, { status: 404 });
      }
      requestEntry.status = "declined";
      const previousLength = event.attendees.length;
      event.attendees = event.attendees.filter(
        (uid: string | ObjectId) => uid.toString() !== userId
      );
      if (previousLength !== event.attendees.length) {
        event.attending = Math.max(0, (event.attending ?? 0) - 1);
      }
    } else if (action === "remove") {
      const previousLength = event.attendees.length;
      event.attendees = event.attendees.filter(
        (uid: string | ObjectId) => uid.toString() !== userId
      );
      if (previousLength !== event.attendees.length) {
        event.attending = Math.max(0, (event.attending ?? 0) - 1);
      }
      if (requestEntry) {
        requestEntry.status = "declined";
      }
    }

    await event.save();
    await event.populate(["joinRequests.user", "attendees"]);

    const serializedEvent =
      typeof event.toObject === "function"
        ? { ...event.toObject(), location: normalizeLocation(event) }
        : { ...event, location: normalizeLocation(event) };

    return NextResponse.json(
      {
        message: action === "approve" ? "Request approved" : "Request declined",
        requests: formatJoinRequests(event.joinRequests),
        event: serializedEvent,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating join request:", error);
    return NextResponse.json({ error: "Failed to update join request" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: any) {
  try {
    await connect();
    const { id } = params;

    const existingEvent = await Event.findById(id);
    if (!existingEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const formData = await request.formData();

    const title = formData.get("title")?.toString() ?? existingEvent.title;
    const description =
      formData.get("description")?.toString() ?? existingEvent.description;
    const startDate =
      formData.get("startDate")?.toString() ?? existingEvent.startDate;
    const endDate =
      formData.get("endDate")?.toString() ?? existingEvent.endDate;
    const locationInput = formData.get("location")?.toString();
    const isPublic = formData.has("isPublic")
      ? JSON.parse(formData.get("isPublic")?.toString() || "false")
      : existingEvent.isPublic;
    const guestLimit = formData.has("guestLimit")
      ? parseInt(formData.get("guestLimit")?.toString() || "0")
      : existingEvent.guestLimit;

    let locationName = existingEvent.location || "";
    let locationFormatted = existingEvent.locationFormatted || "";
    let locationLatitude = existingEvent.locationLatitude;
    let locationLongitude = existingEvent.locationLongitude;
    if (typeof locationInput === "string" && locationInput.trim().length > 0) {
      try {
        const resolved = await geocodeLocation(locationInput);
        locationName = resolved.name;
        locationFormatted = resolved.formatted ?? "";
        locationLatitude = resolved.latitude;
        locationLongitude = resolved.longitude;
      } catch (geoError: any) {
        return NextResponse.json(
          { error: geoError.message || "Unable to resolve event location." },
          { status: 400 }
        );
      }
    }

    const moderationStatus = !moderateText(description || "").allowed
      ? "flagged"
      : !moderateText(title || "").allowed
      ? "flagged"
      : "approved";

    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      {
        title,
        description,
        location: locationName,
        locationFormatted,
        locationLatitude,
        locationLongitude,
        startDate,
        endDate,
        isPublic,
        guestLimit,
        status: moderationStatus,
      },
      { new: true }
    );

    if (!updatedEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Event updated", event: updatedEvent, status: moderationStatus },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: any) {
  try {
    await connect();
    const { id } = params;

    const deletedEvent = await Event.findByIdAndDelete(id);
    if (!deletedEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Event deleted" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
