export interface AppNotification {
  id: string;
  title: string;
  body?: string;
  featureId?: string;
  timestamp: number;
  read: boolean;
}
