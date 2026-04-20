import type { Migration } from "@core/types";
import { migration001 } from "./001-initial";
import { migration002 } from "./002-remaining-core-schema";

export const coreMigrations: Migration[] = [migration001, migration002];
