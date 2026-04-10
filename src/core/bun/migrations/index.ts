import type { Migration } from "@core/types";
import { migration001 } from "./001-initial";

export const coreMigrations: Migration[] = [migration001];
