import { NextResponse } from "next/server";
import { connect } from "@/app/config/dbConfig";
import Event from "@/app/models/event";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const normalizeLocation = (event: any) => ({
  name: event.location || "",
  formatted: event.locationFormatted || event.location || "",
  latitude: event.locationLatitude ?? undefined,
  longitude: event.locationLongitude ?? undefined,
});

const formatRequests = (event: any) =>
  (event.joinRequests || []).map((req: any) => ({
    _id: req?._id?.toString?.() ?? req?._id ?? "",
    status: req?.status || "pending",
    user: {
      _id: req?.user?._id?.toString?.() ?? req?.user?.toString?.() ?? "",
      name: req?.user?.name || "",
      lastName: req?.user?.lastName || "",
      username: req?.user?.username || "",
      email: req?.user?.email || "",
      image: req?.user?.image || "",
    },
    createdAt: req?.createdAt,
  }));

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!params.id) {
    return NextResponse.json({ message: "⚠️ Event ID is required" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "⚠️ Authentication required" }, { status: 401 });
  }

  try {
    await connect();
    const event = await Event.findById(params.id).populate("joinRequests.user");

    if (!event) {
      return NextResponse.json({ message: "⚠️ Event not found" }, { status: 404 });
    }

    const creatorId = event.createdBy?.toString?.();
    if (!creatorId || creatorId !== session.user.id.toString()) {
      return NextResponse.json({ message: "⚠️ Only the host can manage requests" }, { status: 403 });
    }

    const { userId, action }: { userId?: string; action?: "approve" | "decline" } = await req.json();
    if (!userId || !action || !["approve", "decline"].includes(action)) {
      return NextResponse.json({ message: "⚠️ userId and a valid action are required" }, { status: 400 });
    }

    if (!Array.isArray(event.joinRequests)) {
      (event as any).joinRequests = [];
    }

    const requestEntry = (event as any).joinRequests.find(
      (r: any) => r?.user?.toString?.() === userId
    );

    if (!requestEntry) {
      return NextResponse.json({ message: "⚠️ Join request not found" }, { status: 404 });
    }

    requestEntry.status = action === "approve" ? "approved" : "declined";

    if (!Array.isArray(event.attendees)) {
      event.attendees = [];
    }

    if (action === "approve") {
      const alreadyAttendee = event.attendees.some(
        (uid: string | ObjectId) => uid.toString() === userId
      );
      if (!alreadyAttendee) {
        event.attendees.push(new ObjectId(userId));
        event.attending = (event.attending ?? 0) + 1;
      }
    } else {
      const previousLength = event.attendees.length;
      event.attendees = event.attendees.filter(
        (uid: string | ObjectId) => uid.toString() !== userId
      );
      if (previousLength !== event.attendees.length) {
        event.attending = Math.max(0, (event.attending ?? 0) - 1);
      }
    }

    await event.save();
    await event.populate(["joinRequests.user", "attendees"]);

    const normalizedEvent =
      typeof event.toObject === "function"
        ? { ...event.toObject(), location: normalizeLocation(event) }
        : { ...event, location: normalizeLocation(event) };

    return NextResponse.json(
      {
        message: action === "approve" ? "✅ Request approved" : "✅ Request declined",
        requests: formatRequests(event),
        event: normalizedEvent,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error updating join request:", error);
    return NextResponse.json({ message: "❌ Internal server error" }, { status: 500 });
  }
}
