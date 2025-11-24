const NOMINATIM_ENDPOINT =
  "https://nominatim.openstreetmap.org/search?format=json&limit=1";
const NOMINATIM_HEADERS = {
  "User-Agent": "EventfulApp/1.0 (info@eventful.local)",
};

export type GeocodedLocation = {
  name: string;
  latitude: number;
  longitude: number;
  formatted?: string;
};

export async function geocodeLocation(
  place: string
): Promise<GeocodedLocation> {
  if (!place || !place.trim()) {
    throw new Error("Location is required");
  }

  const response = await fetch(
    `${NOMINATIM_ENDPOINT}&q=${encodeURIComponent(place)}`,
    { headers: NOMINATIM_HEADERS }
  );

  if (!response.ok) {
    throw new Error("Failed to resolve location");
  }

  const results = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;

  if (!results.length) {
    throw new Error("No results found for that location");
  }

  const match = results[0];
  return {
    name: place.trim(),
    formatted: match.display_name,
    latitude: Number(match.lat),
    longitude: Number(match.lon),
  };
}
