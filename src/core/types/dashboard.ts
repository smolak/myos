export interface DashboardPage {
  readonly id: string;
  readonly name: string;
  readonly layout: LayoutItem[];
  readonly order: number;
}

export interface LayoutItem {
  readonly i: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly featureId: string;
  readonly widgetId: string;
  readonly config?: Record<string, unknown>;
}
