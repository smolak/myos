export interface DashboardPage {
	id: string;
	name: string;
	layout: LayoutItem[];
	order: number;
}

export interface LayoutItem {
	i: string;
	x: number;
	y: number;
	w: number;
	h: number;
	featureId: string;
	widgetId: string;
	config?: Record<string, unknown>;
}
