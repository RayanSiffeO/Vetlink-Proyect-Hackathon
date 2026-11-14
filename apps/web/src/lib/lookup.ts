export function lookupValue<T>(record: Record<string, T>, key: string, fallback: T): T {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : fallback;
}