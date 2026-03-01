// app/types/campaign.ts

export interface CampaignSettings {
  id: string;
  shop: string;
  enabled: boolean;
  discountPercent: number;
  timerMinutes: number;
  displayStyle: "progress" | "countdown";
  primaryColor: string;
}

export interface DashboardData {
  campaign: CampaignSettings | null;
  shopName: string;
}