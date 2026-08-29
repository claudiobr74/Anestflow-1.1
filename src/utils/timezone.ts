/**
 * Timezone utilities for AnestFlow
 * Ensures all dates and times are handled correctly in "America/Sao_Paulo" timezone
 */

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Returns the date/time components of a Date object in the specified timezone
 */
export function getTzParts(date: Date, timeZone: string = DEFAULT_TIMEZONE): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const partVal = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  return {
    year: parseInt(partVal("year"), 10),
    month: parseInt(partVal("month"), 10),
    day: parseInt(partVal("day"), 10),
    hour: parseInt(partVal("hour"), 10),
    minute: parseInt(partVal("minute"), 10),
    second: parseInt(partVal("second"), 10),
  };
}

/**
 * Combines a local date string (YYYY-MM-DD) and a local time string (HH:MM)
 * into a standard UTC ISO string representing that exact moment in the specified timezone.
 */
export function combineDateAndTime(dateStr: string, timeStr: string, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!dateStr) {
    dateStr = getLocalDateStringNow(timeZone);
  }
  if (!timeStr) {
    timeStr = "00:00";
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  // Use a candidate date at UTC face value
  const utcCandidate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const tzParts = getTzParts(utcCandidate, timeZone);

  // Calculate difference between timezone local representation and desired local face value
  const candidateLocalTime = Date.UTC(tzParts.year, tzParts.month - 1, tzParts.day, tzParts.hour, tzParts.minute);
  const desiredLocalTime = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMs = candidateLocalTime - desiredLocalTime;

  // The correct UTC time is the candidate shifted by that offset
  return new Date(utcCandidate.getTime() - offsetMs).toISOString();
}

/**
 * Formats a given date/time source into a "HH:mm" string for "America/Sao_Paulo"
 */
export function formatToLocalTime(dateInput: string | Date | number | undefined, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const parts = getTzParts(d, timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

/**
 * Gets the current YYYY-MM-DD string representing local date in the specified timezone
 */
export function getLocalDateStringNow(timeZone: string = DEFAULT_TIMEZONE): string {
  const d = new Date();
  const parts = getTzParts(d, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/**
 * Gets the current HH:mm string representing local time in the specified timezone
 */
export function getLocalTimeStringNow(timeZone: string = DEFAULT_TIMEZONE): string {
  const d = new Date();
  const parts = getTzParts(d, timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

/**
 * Safely parses any date/time string, converting it correctly from UTC to local components
 */
export function getLocalTimeFromIso(isoString?: string, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!isoString) return "";
  return formatToLocalTime(isoString, timeZone);
}
