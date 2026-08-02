function requestLabel(value) {
  if (typeof value !== "string") return "anonymous";

  const normalized = value.trim();
  if (normalized === "") return "anonymous";

  if (normalized.length > 64) {
    return normalized.slice(0, 64);
  }

  if (normalized.startsWith("internal:")) {
    return normalized.slice("internal:".length);
  }

  if (normalized.includes("\n")) {
    return normalized.split("\n")[0];
  }

  return normalized;
}

module.exports = { requestLabel };
