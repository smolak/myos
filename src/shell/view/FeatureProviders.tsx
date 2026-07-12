import type { ReactNode } from "react";
import type { FeatureViewDescriptor } from "./feature-views";

interface Props {
  descriptors: readonly FeatureViewDescriptor[];
  children: ReactNode;
}

// Folds the descriptor list into the provider tree: each descriptor's optional
// Provider wraps the tree in descriptor-list order (first descriptor outermost).
// Command Registrars mount inside all providers so every registrar can consume
// any feature's context. Feature providers are independent of each other — see
// ARCHITECTURE.md § Feature View Registration.
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
