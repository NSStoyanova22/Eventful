import { NextResponse } from "next/server";
import { Filter } from "bad-words";

const filter = new Filter();

export async function POST(req: Request) {
  const { text } = await req.json();

  const isClean = filter.isProfane(text);

  return NextResponse.json({
    allowed: !isClean,
    cleaned: filter.clean(text)
  });
}
