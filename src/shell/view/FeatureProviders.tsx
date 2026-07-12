import type { ReactNode } from "react";
import type { FeatureViewDescriptor } from "./feature-views";

interface Props {
  descriptors: readonly FeatureViewDescriptor[];
  children: ReactNode;
}

// Nesting follows descriptor-list order (first descriptor outermost) — safe
// only because feature providers are independent of each other; see
// ARCHITECTURE.md § Feature View Registration. Registrars mount inside all
// providers so every registrar can consume any feature's context.
export function FeatureProviders({ descriptors, children }: Props) {
  const inner = (
    <>
      {descriptors.map(({ featureId, CommandRegistrar }) => CommandRegistrar && <CommandRegistrar key={featureId} />)}
      {children}
    </>
  );

  return descriptors.reduceRight(
    (tree, { featureId, Provider }) => (Provider ? <Provider key={featureId}>{tree}</Provider> : tree),
    inner,
  );
}
