import { NextRequest, NextResponse } from "next/server";
import { countries } from "@/data/countries";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nameQuery = searchParams.get("name")?.toLowerCase() ?? "";

  if (nameQuery) {
    const matches = countries.filter(
      (country) => country.name.toLowerCase() === nameQuery
    );

    if (matches.length === 0) {
      return NextResponse.json(
        { message: "Country not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(matches, { status: 200 });
  }

  return NextResponse.json(
    [...countries].sort((a, b) => a.name.localeCompare(b.name)),
    { status: 200 }
  );
}
