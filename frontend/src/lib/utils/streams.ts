function isValueWrapper(value: unknown): value is { value?: unknown } {
  return typeof value === "object" && value !== null && "value" in value;
}

export function extractFieldValue(field: unknown): unknown {
  if (isValueWrapper(field)) {
    return extractFieldValue(field.value);
  }
  return field;
}

