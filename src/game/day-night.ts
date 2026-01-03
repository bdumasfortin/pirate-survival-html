export const DAY_LENGTH_SECONDS = 24 * 60;
export const DAY_START_HOUR = 8;

export type DayCycleInfo = {
  day: number;
  hours: number;
  minutes: number;
  nightFactor: number;
  timeInDaySeconds: number;
};

export const getDayCycleInfo = (elapsedSeconds: number): DayCycleInfo => {
  const elapsed = Math.max(0, elapsedSeconds);
  const startOffsetMinutes = (DAY_START_HOUR % 24) * 60;
  const startOffsetSeconds = (startOffsetMinutes / (24 * 60)) * DAY_LENGTH_SECONDS;
  const dayTime = elapsed + startOffsetSeconds;
  const day = Math.floor(dayTime / DAY_LENGTH_SECONDS);
  const timeInDay = dayTime % DAY_LENGTH_SECONDS;
  const totalMinutes = Math.floor((timeInDay / DAY_LENGTH_SECONDS) * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const phase = (timeInDay / DAY_LENGTH_SECONDS) % 1;
  const daylight = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  const nightFactor = 1 - daylight;
  return { day, hours, minutes, nightFactor, timeInDaySeconds: timeInDay };
};

const DAY_TITLE_DURATION_SECONDS = 4;

export type DayTitleInfo = {
  dayNumber: number;
  alpha: number;
};

export const getDayTitleInfo = (elapsedSeconds: number): DayTitleInfo | null => {
  const elapsed = Math.max(0, elapsedSeconds);
  const { day, timeInDaySeconds } = getDayCycleInfo(elapsed);

  if (elapsed <= DAY_TITLE_DURATION_SECONDS) {
    const alpha = 1 - elapsed / DAY_TITLE_DURATION_SECONDS;
    return { dayNumber: 1, alpha };
  }

  if (day > 0 && timeInDaySeconds <= DAY_TITLE_DURATION_SECONDS) {
    const alpha = 1 - timeInDaySeconds / DAY_TITLE_DURATION_SECONDS;
    return { dayNumber: day + 1, alpha };
  }

  return null;
};
