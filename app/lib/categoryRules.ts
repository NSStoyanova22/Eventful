export type OverpassTag = {
  key: string;
  value: string;
};

export type CategoryRule = {
  name: string;
  labelKey: string;
  regex: RegExp;
  overpass: {
    key: string;
    value: string;
  };
};

export const CATEGORY_RULES: CategoryRule[] = [
  {
    name: "Music",
    labelKey: "category_music",
    regex: /(concert|music|dj|karaoke|band|gig)/i,
    overpass: { key: "amenity", value: "nightclub" },
  },
  {
    name: "Food & Drink",
    labelKey: "category_food",
    regex: /(dinner|brunch|tasting|food|restaurant|wine|cocktail|coffee)/i,
    overpass: { key: "amenity", value: "restaurant" },
  },
  {
    name: "Sports",
    labelKey: "category_sport",
    regex: /(match|game|tournament|yoga|run|football|basketball|tennis|sport)/i,
    overpass: { key: "leisure", value: "pitch" },
  },
  {
    name: "Art & Culture",
    labelKey: "category_culture",
    regex: /(art|gallery|museum|exhibit|culture|theatre|theater)/i,
    overpass: { key: "tourism", value: "museum" },
  },
  {
    name: "Tech & Business",
    labelKey: "category_business",
    regex: /(startup|tech|coding|developer|business|networking|conference|meetup)/i,
    overpass: { key: "office", value: "it" },
  },
];
