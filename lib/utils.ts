export function extractJson<T>(text: string): T | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.search(/[\[{]/);
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  const open = raw[start];
  const close = open === "[" ? "]" : "}";
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === open) depth++;
    else if (raw[i] === close) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export function timeSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 1000;
}

export function scoreColor(score: number): string {
  if (score >= 5) return "bg-green-500";
  if (score >= 4) return "bg-teal-500";
  if (score >= 3) return "bg-yellow-500";
  if (score >= 2) return "bg-orange-500";
  return "bg-red-500";
}
