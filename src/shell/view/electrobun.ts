import { Electroview } from "electrobun/view";
import type { AppRPCSchema } from "../shared/rpc-schema";

const rpc = Electroview.defineRPC<AppRPCSchema>({
  handlers: {
    requests: {},
    messages: {},
  },
});

new Electroview({ rpc });

export { rpc };
