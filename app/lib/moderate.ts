import { Filter } from "bad-words";

const filter = new Filter();

export default function moderateText(text: string): { allowed: boolean; cleaned: string } {
  const isProfane = filter.isProfane(text);

  return {
    allowed: !isProfane,
    cleaned: filter.clean(text),
  };
}

export { moderateText };
