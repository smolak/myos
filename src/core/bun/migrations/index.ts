import type { Migration } from "@core/types";
import { migration001 } from "./001-initial";
import { migration002 } from "./002-remaining-core-schema";
import { migration003 } from "./003-action-queue-columns";

export const coreMigrations: Migration[] = [migration001, migration002, migration003];
