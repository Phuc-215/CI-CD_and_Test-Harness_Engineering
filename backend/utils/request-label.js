function requestLabel(value) {
  if (typeof value !== "string") return "anonymous";

  const normalized = value.trim();
  return normalized === "" ? "anonymous" : normalized;
}

module.exports = { requestLabel };
