export interface FeatureFlagSet {
  [key: string]: boolean | string | number;
}
export declare const defaultFeatureFlags: FeatureFlagSet;
