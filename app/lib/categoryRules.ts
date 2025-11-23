export type OverpassTag = {
  key: string;
  value: string;
};

export type CategoryRule = {
  name: string;
  regex: RegExp;
  overpass: {
    key: string;
    value: string;
  };
};

export const CATEGORY_RULES: CategoryRule[] = [
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