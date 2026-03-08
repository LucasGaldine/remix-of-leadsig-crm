import { BusinessHours } from '@/hooks/useBusinessHours';

export function isOutsideBusinessHours(
  businessHours: BusinessHours[] | undefined,
  scheduleDate: string,
  startTime: string | null | undefined,
  endTime: string | null | undefined
): boolean {
  if (!businessHours || !startTime || !endTime) return false;

  const date = new Date(scheduleDate + 'T00:00:00');
  const dayOfWeek = date.getDay();

  const hours = businessHours.find((bh) => bh.day_of_week === dayOfWeek);

  if (!hours) return false;

  if (hours.is_closed) return true;

  if (!hours.start_time || !hours.end_time) return false;

  const scheduleStart = startTime;
  const scheduleEnd = endTime;
  const businessStart = hours.start_time;
  const businessEnd = hours.end_time;

  return scheduleStart < businessStart || scheduleEnd > businessEnd;
}

export function getBusinessHoursMessage(
  businessHours: BusinessHours[] | undefined,
  scheduleDate: string
): string | null {
  if (!businessHours) return null;

  const date = new Date(scheduleDate + 'T00:00:00');
  const dayOfWeek = date.getDay();

  const hours = businessHours.find((bh) => bh.day_of_week === dayOfWeek);

  if (!hours) return null;

  if (hours.is_closed) {
    return 'Business is normally closed on this day';
  }

  if (hours.start_time && hours.end_time) {
    return `Normal hours: ${formatTime(hours.start_time)} - ${formatTime(hours.end_time)}`;
  }

  return null;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}
