export const sites = {
  courthouse: {
    name: "Courthouse",
    area: "Snow removal",
    tasks: ["Plowing", "Sidewalk clearing", "Sanding", "Ice melt"],
    equipment: "Plow truck",
  },
  dowd: {
    name: "David Dowd",
    area: "Site maintenance",
    tasks: ["Snow clearing", "Sanding", "Ice melt"],
    equipment: "Pickup truck",
  },
  tote: {
    name: "Tote Port",
    area: "Material hauling",
    tasks: ["Hauling", "Site cleanup"],
    equipment: "End dump",
  },
};
export function seed() {
  return [
    {
      id: "AK-101",
      site: "courthouse",
      worker: "Alex Morgan",
      contractor: "Sample contractor",
      equipment: "Plow truck",
      status: "Assigned",
      tasks: [],
      photos: [],
      notes: "Clear assigned areas and check pedestrian access.",
      assignment: "Main lot & sidewalks",
    },
    {
      id: "AK-102",
      site: "tote",
      worker: "Alex Morgan",
      contractor: "Sample contractor",
      equipment: "End dump",
      status: "Assigned",
      tasks: [],
      photos: [],
      notes: "Confirm the loading point with your supervisor.",
      assignment: "Hauling assignment",
    },
    {
      id: "AK-103",
      site: "dowd",
      worker: "Sam Rivera",
      contractor: "Sample contractor",
      equipment: "Pickup truck",
      status: "Submitted",
      tasks: ["Snow clearing"],
      photos: [],
      notes: "Sample record for review. No evidence attached.",
      assignment: "Access road",
      start: "2026-10-27T16:00:00.000Z",
      end: "2026-10-27T18:00:00.000Z",
    },
    {
      id: "AK-104",
      site: "courthouse",
      worker: "Jordan Lee",
      contractor: "Sample contractor",
      equipment: "Plow truck",
      status: "Approved",
      tasks: ["Plowing", "Sanding"],
      photos: [],
      notes: "Sample approved record.",
      assignment: "Visitor lot",
      start: "2026-10-27T14:00:00.000Z",
      end: "2026-10-27T16:30:00.000Z",
    },
  ];
}
export function hours(job) {
  if (!job.start) return "—";
  const end = job.end ? new Date(job.end) : new Date();
  return Math.max(0, (end - new Date(job.start)) / 3600000).toFixed(1);
}
export function submissionError(job) {
  if (!job.tasks.length) return "Select at least one completed task.";
  if (!job.photos.length)
    return "Add at least one work photo before submitting.";
  if (
    job.site === "tote" &&
    (!Number.isInteger(Number(job.loads)) ||
      Number(job.loads) < 0 ||
      job.loads === "")
  )
    return "Enter the number of completed loads (zero or more).";
  if (job.site === "tote" && !job.timecard)
    return "Attach your signed timecard before submitting.";
  return "";
}
export function transition(
  job,
  action,
  actor,
  reason = "",
  now = new Date().toISOString(),
) {
  const next = structuredClone(job);
  if (action === "start" && actor === "worker" && job.status === "Assigned") {
    next.status = "In progress";
    next.start = now;
  } else if (
    action === "submit" &&
    actor === "worker" &&
    ["In progress", "Correction requested"].includes(job.status)
  ) {
    const error = submissionError(job);
    if (error) throw Error(error);
    next.status = "Submitted";
    next.end = job.end || now;
  } else if (
    action === "approve" &&
    actor === "supervisor" &&
    job.status === "Submitted"
  )
    next.status = "Approved";
  else if (
    action === "return" &&
    actor === "supervisor" &&
    job.status === "Submitted" &&
    reason.trim()
  ) {
    next.status = "Correction requested";
    next.correction = reason.trim();
  } else throw Error("This action is not available for this record.");
  next.history = [...(job.history || []), { action, actor, at: now, reason }];
  return next;
}
