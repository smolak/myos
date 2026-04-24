import type { FeatureDefinition } from "@core/types";
import type { ClockEvents, ClockActions, ClockQueries } from "../shared/types";
import { clockMigrations } from "./migrations";

export const clockFeature: FeatureDefinition<ClockEvents, ClockActions, ClockQueries> = {
  id: "clock",
  name: "Clock",
  version: "1.0.0",
  migrations: clockMigrations,

  manifest: {
    events: {},
    actions: {},
    queries: {},
    permissions: [],
    scheduledTasks: [],
    widgets: [
      {
        id: "display",
        name: "Clock",
        sizes: ["small"],
        description: "Shows the current time, updating every second",
      },
    ],
    commands: [],
  },

  async install(_ctx) {},
  async activate(_ctx) {},
  async deactivate() {},
  async uninstall(_ctx) {},
};
