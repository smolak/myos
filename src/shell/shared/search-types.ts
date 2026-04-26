import type { FeatureSearchResult } from "@core/types";

export interface SearchResult extends FeatureSearchResult {
  readonly featureId: string;
  readonly featureName: string;
}
