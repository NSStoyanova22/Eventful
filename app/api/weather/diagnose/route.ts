import { NextRequest, NextResponse } from "next/server";
import { geocodeLocation } from "@/app/lib/geocode";

type Coordinates = { latitude: number; longitude: number };

type TimelineResponse = {
  data?: {
    timelines?: Array<{
      intervals?: Array<{
        startTime: string;
        values: {
          temperature?: number;
          humidity?: number;
          windSpeed?: number;
          precipitationProbability?: number;
        };
      }>;
    }>;
  };
};

const WEATHER_CACHE = new Map<
  string,
  { timestamp: number; data: TimelineResponse }
>();
const WEATHER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const TOMORROW_API_KEY = process.env.TOMORROW_IO_API_KEY;
const TOMORROW_BASE_URL = "https://api.tomorrow.io/v4/timelines";
const WEATHER_FIELDS = [
  "temperature",
  "humidity",
  "windSpeed",
  "precipitationProbability",
];

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function cacheKey(coords: Coordinates, targetDate: string): string {
  return `${coords.latitude.toFixed(3)}|${coords.longitude.toFixed(
    3
  )}|${targetDate}`;
}

function getCached(key: string) {
  const entry = WEATHER_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > WEATHER_CACHE_TTL) {
    WEATHER_CACHE.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: TimelineResponse) {
  WEATHER_CACHE.set(key, { timestamp: Date.now(), data });
}

async function fetchTimeline(coords: Coordinates, date: Date) {
  if (!TOMORROW_API_KEY) {
    throw new Error("Tomorrow.io API key is missing.");
  }

  const dateString = formatDate(date);
  const key = cacheKey(coords, dateString);
  const cached = getCached(key);
  if (cached) return cached;

  const startTime = new Date(date);
  startTime.setUTCHours(0, 0, 0, 0);
  const endTime = new Date(startTime);
  endTime.setUTCHours(0, 0, 0, 0);
  endTime.setUTCDate(endTime.getUTCDate() + 1);

  const params = new URLSearchParams({
    location: `${coords.latitude},${coords.longitude}`,
    fields: WEATHER_FIELDS.join(","),
    units: "metric",
    timesteps: "1h",
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  });

  const response = await fetch(`${TOMORROW_BASE_URL}?${params.toString()}`, {
    headers: {
      "Content-Type": "application/json",
      apikey: TOMORROW_API_KEY,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Unable to fetch weather data from Tomorrow.io (${response.status}): ${text}`
    );
  }

  const data = (await response.json()) as TimelineResponse;
  setCache(key, data);
  return data;
}

function pickInterval(data: TimelineResponse) {
  const intervals = data?.data?.timelines?.[0]?.intervals ?? [];
  if (!intervals.length) return null;
  const values = intervals.reduce(
    (acc, interval) => {
      const v = interval.values || {};
      acc.temperature.push(v.temperature ?? null);
      acc.humidity.push(v.humidity ?? null);
      acc.wind.push(v.windSpeed ?? null);
      acc.rain.push(v.precipitationProbability ?? null);
      return acc;
    },
    {
      temperature: [] as Array<number | null>,
      humidity: [] as Array<number | null>,
      wind: [] as Array<number | null>,
      rain: [] as Array<number | null>,
    }
  );

  const avg = (arr: Array<number | null>) =>
    arr.filter((n): n is number => typeof n === "number").reduce((a, b) => a + b, 0) /
    Math.max(1, arr.filter((n) => typeof n === "number").length);

  return {
    values: {
      temperature: avg(values.temperature),
      humidity: avg(values.humidity),
      windSpeed: avg(values.wind),
      precipitationProbability: avg(values.rain),
    },
  };
}

function classifyRain(rainChance: number) {
  if (rainChance >= 60) return "high";
  if (rainChance >= 30) return "medium";
  return "low";
}

function classifyTemp(tempC: number) {
  if (tempC >= 27) return "hot";
  if (tempC <= 10) return "cold";
  return "warm";
}

function classifyWind(windKph: number) {
  if (windKph >= 30) return "windy";
  if (windKph >= 15) return "breezy";
  return "calm";
}

function buildAdvice(rainRisk: string, tempProfile: string, windProfile: string) {
  const adviceParts: string[] = [];
  if (rainRisk === "high") {
    adviceParts.push("Have a rain plan (tents or indoor space).");
  } else if (rainRisk === "medium") {
    adviceParts.push("Consider light rain coverage just in case.");
  }
  if (tempProfile === "hot") {
    adviceParts.push("Provide shade and cold drinks.");
  } else if (tempProfile === "cold") {
    adviceParts.push("Recommend layers or heating options.");
  }
  if (windProfile === "windy") {
    adviceParts.push("Secure decor and avoid tall installations.");
  }
  return adviceParts.length
    ? adviceParts.join(" ")
    : "Conditions look comfortable—no special prep needed.";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { locationName, latitude, longitude, startDate } = body || {};

    if (!startDate) {
      return NextResponse.json(
        { error: "Missing event date." },
        { status: 400 }
      );
    }

    let coords: Coordinates | null = null;
    if (typeof latitude === "number" && typeof longitude === "number") {
      coords = { latitude, longitude };
    }

    if (!coords) {
      if (!locationName) {
        return NextResponse.json(
          { error: "Location information required." },
          { status: 400 }
        );
      }
      const geocoded = await geocodeLocation(locationName);
      coords = { latitude: geocoded.latitude, longitude: geocoded.longitude };
    }

    const eventDate = new Date(startDate);
    if (Number.isNaN(eventDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid event date." },
        { status: 400 }
      );
    }

    const now = new Date();
    const diffDays = Math.round(
      (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    let targetDate = eventDate;
    if (diffDays > 7) {
      const seasonal = new Date(eventDate);
      seasonal.setFullYear(seasonal.getFullYear() - 1);
      targetDate = seasonal;
    }

    const timeline = await fetchTimeline(coords, targetDate);
    const interval = pickInterval(timeline);

    if (!interval) {
      throw new Error("Weather data unavailable for that date.");
    }

    const tempC = interval.values.temperature ?? 0;
    const humidity = interval.values.humidity ?? 0;
    const windMps = interval.values.windSpeed ?? 0;
    const windKph = windMps * 3.6;
    const rainChance = Number(
      interval.values.precipitationProbability ?? 0
    );

    const rainRisk = classifyRain(rainChance);
    const tempProfile = classifyTemp(tempC);
    const windProfile = classifyWind(windKph);

    const summary = {
      headline: `${tempProfile
        .charAt(0)
        .toUpperCase()}${tempProfile.slice(1)} & ${windProfile}`,
      details: {
        temperature: `${tempC.toFixed(1)}°C`,
        rainChance,
        wind: Math.round(windKph),
        humidity: Math.round(humidity),
        rainRisk,
        tempProfile,
        windProfile,
      },
      advice: buildAdvice(rainRisk, tempProfile, windProfile),
    };

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error("Weather diagnostics error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze weather." },
      { status: 500 }
    );
  }
}
