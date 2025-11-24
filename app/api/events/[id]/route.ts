import { NextResponse } from "next/server";
import { connect } from "@/app/config/dbConfig";
import Event from "@/app/models/event";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import moderateText from "@/app/lib/moderate";
import { geocodeLocation } from "@/app/lib/geocode";

export async function GET(request: Request, { params }: any) {
  try {
    await connect();
    const { id } = params;
    const event = await Event.findById(id).populate("attendees");

    const session = await getServerSession(authOptions);
    const requesterId = session?.user?.id?.toString();
    const creatorId = event?.createdBy?.toString();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.status !== "approved" && creatorId !== requesterId) {
      return NextResponse.json({ error: "Event not available" }, { status: 403 });
    }

    const normalizedLocation = {
      name: (event as any).location || "",
      formatted:
        (event as any).locationFormatted ||
        (event as any).location ||
        "",
      latitude: (event as any).locationLatitude ?? undefined,
      longitude: (event as any).locationLongitude ?? undefined,
    };

    const serializedEvent =
      typeof event.toObject === "function"
        ? { ...event.toObject(), location: normalizedLocation }
        : { ...event, location: normalizedLocation };

    return NextResponse.json({ event: serializedEvent }, { status: 200 });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
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
