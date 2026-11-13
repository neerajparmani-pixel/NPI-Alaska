export function recordedHours(work) {
  const total = (work.sessions || []).reduce((sum, s) => {
    if (!s.out || !s.in || !s.out.time || !s.in.time) return sum;
    const raw = (Date.parse(s.out.time) - Date.parse(s.in.time)) / 3600000;
    if (!Number.isFinite(raw) || raw < 0) throw Error("Invalid interval");
    const net = raw - (s.breakMinutes || 0) / 60;
    if (net < 0) throw Error("Break exceeds interval");
    return sum + net * (s.members?.length || 1);
  }, 0);
  return Math.round(total * 10000) / 10000;
}
export function hasBothLocations(work) {
  return (
    !!work.sessions?.length &&
    work.sessions.every((s) =>
      [s.in, s.out].every(
        (e) =>
          e &&
          Number.isFinite(e.lat) &&
          Number.isFinite(e.lng) &&
          e.lat >= -90 &&
          e.lat <= 90 &&
          e.lng >= -180 &&
          e.lng <= 180 &&
          e.time,
      ),
    )
  );
}
export function quantity(work, basis) {
  if (work.status !== "approved" || !hasBothLocations(work))
    throw Error("NPI approval and both locations required");
  const units = {
    hourly: work.acceptedHours,
    visit: 1,
    load: work.loads,
    fixed: 1,
  }[basis];
  if (!Number.isFinite(units) || units < 0) throw Error("Invalid units");
  return units;
}
export function charge(work, side) {
  const rate = work.rates[side];
  if (!rate || !Number.isInteger(rate.cents) || rate.cents < 0)
    throw Error("Invalid rate");
  const total = Math.round(quantity(work, rate.basis) * rate.cents);
  if (!Number.isSafeInteger(total)) throw Error("Amount exceeds safe limits");
  return total;
}
export function eligible(works, documents) {
  const allocated = new Set(documents.flatMap((d) => d.workIds));
  return works.filter(
    (w) =>
      w.status === "approved" && hasBothLocations(w) && !allocated.has(w.id),
  );
}
export function approveHours(work, accepted, reason) {
  if (work.status !== "npi-review")
    throw Error("Subcontractor approval must come first");
  if (!hasBothLocations(work))
    throw Error("Check-in and checkout locations are required");
  if (!Number.isFinite(accepted) || accepted < 0 || accepted > 10000)
    throw Error("Invalid accepted hours");
  if (Math.abs(accepted - work.claimedHours) > 0.0001 && !reason?.trim())
    throw Error("Explain the change to claimed hours");
  return {
    ...work,
    status: "approved",
    acceptedHours: accepted,
    npiReason: reason || "",
  };
}

export function overlappingWorkers(work, allWorks) {
  const overlap = new Set();
  for (const own of work.sessions || []) {
    if (!own.out) continue;
    for (const other of allWorks.filter((w) => w.id !== work.id))
      for (const s of other.sessions || []) {
        if (!s.out) continue;
        if (
          Date.parse(own.in.time) < Date.parse(s.out.time) &&
          Date.parse(s.in.time) < Date.parse(own.out.time)
        ) {
          for (const id of own.members || [])
            if (s.members?.includes(id)) overlap.add(id);
        }
      }
  }
  return [...overlap];
}
