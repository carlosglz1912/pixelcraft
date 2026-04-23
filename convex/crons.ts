import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.hourly(
  "cleanup-expired-files",
  { minuteUTC: 0 },
  api.files.cleanupExpired,
  {},
);

export default crons;
