/** 为等价手工 mutation 生成稳定指纹，确保确认前复用幂等键。 */
export function stableMutationJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableMutationJson).join(",")}]`;
  }
  if (typeof value !== "object") return "null";
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined && typeof item !== "function" && typeof item !== "symbol")
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) =>
    `${JSON.stringify(key)}:${stableMutationJson(item)}`).join(",")}}`;
}
