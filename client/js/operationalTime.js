/* Shared London civil-time conversion. No browser/server local timezone is used. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OperationalTime = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const zone = "Europe/London";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  function localInput(value) {
    const date = new Date(value);
    if (value == null || !Number.isFinite(date.getTime())) throw new Error("Invalid timestamp");
    const p = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  }
  function civilMs(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) throw new Error("Use a full London date and time");
    const normalized = value.length === 16 ? value + ":00" : value;
    const ms = Date.parse(normalized + "Z");
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 19) !== normalized) throw new Error("Invalid date or time");
    return ms;
  }
  function fromLocal(value, occurrence = "reject") {
    if (!["reject", "earlier", "later"].includes(occurrence)) throw new Error("Invalid clock-change occurrence");
    const wall = civilMs(value);
    const normalized = new Date(wall).toISOString().slice(0, 19);
    const offsets = new Set();
    for (let h = -36; h <= 36; h += 12) {
      const probe = wall + h * 3600000;
      offsets.add(civilMs(localInput(probe)) - probe);
    }
    const candidates = [...offsets].map(offset => wall - offset)
      .filter(ms => localInput(ms) === normalized).sort((a, b) => a - b);
    if (!candidates.length) throw new Error("This London time does not exist because the clocks move forward");
    if (candidates.length > 1 && occurrence === "reject") throw new Error("This London time occurs twice: choose first or second occurrence");
    return new Date(occurrence === "later" ? candidates[candidates.length - 1] : candidates[0]);
  }
  function addDays(date, count) {
    if (!Number.isInteger(count)) throw new Error("Invalid day offset");
    return new Date(civilMs(date + "T00:00") + count * 86400000).toISOString().slice(0, 10);
  }
  function scheduleTimes(date, sta, std, dayOffset, occurrence = "reject") {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sta) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(std)) throw new Error("STA and STD must be HH:mm");
    // Legacy schedules had no departure date. Infer overnight only for those records.
    const offset = dayOffset == null ? Number(std < sta) : dayOffset;
    if (!Number.isInteger(offset) || offset < 0 || offset > 7) throw new Error("Departure day offset must be 0–7");
    const staAt = fromLocal(`${date}T${sta}`, occurrence);
    const stdAt = fromLocal(`${addDays(date, offset)}T${std}`, occurrence);
    if (stdAt <= staAt) throw new Error("STD must follow STA; check departure day");
    return { staAt, stdAt, departureDayOffset: offset };
  }
  function editedTime(value, previous, occurrence = "reject") {
    if (!value) return null;
    // Preserve the exact instant (including seconds) when an existing field is unchanged.
    if (occurrence === "reject" && previous && localInput(previous).slice(0, value.length) === value) return new Date(previous);
    return fromLocal(value, occurrence);
  }
  function departurePlan(stdAt, onBlocks, mgt) {
    const std = Date.parse(stdAt), aibt = Date.parse(onBlocks);
    if (!Number.isFinite(std) || !Number.isFinite(aibt) || !Number.isInteger(mgt) || mgt <= 0) return null;
    const ready = aibt + mgt * 60000;
    return { ready: new Date(ready), target: new Date(Math.max(std, ready)),
      mode: ready <= std ? "STD" : "GROUND", buffer: Math.max(0, (std - ready) / 60000),
      delay: Math.max(0, (ready - std) / 60000) };
  }
  function movementDate(flight, role) {
    const arrival = ['ARRIVAL','ARRIVAL_DISPATCH'].includes(role);
    const value = arrival ? flight.arrival?.staAt : flight.departure?.stdAt;
    if (value) return localInput(value).slice(0,10);
    const offset = flight.departureDayOffset == null
      ? Number((flight.departure?.std || '') < (flight.arrival?.sta || '')) : flight.departureDayOffset;
    return arrival ? flight.operatingDate : addDays(flight.operatingDate, offset);
  }
  function dayContext(flight, date) {
    const arrivalDate = movementDate(flight, 'ARRIVAL'), departureDate = movementDate(flight, 'DISPATCH');
    return {arrivalDate, departureDate, arrivalToday:arrivalDate === date, departureToday:departureDate === date,
      dayLabel:arrivalDate === departureDate ? '' : arrivalDate === date
        ? `Nightstop · Departure ${departureDate}` : `Nightstop · Arrival ${arrivalDate}`};
  }
  return { movementDate, dayContext, zone, localInput, fromLocal, addDays, scheduleTimes, editedTime, departurePlan,
    operatingDate: (now = new Date()) => localInput(now).slice(0, 10) };
});
