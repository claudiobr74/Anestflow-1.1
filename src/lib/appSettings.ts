export type AppSettings = {
  defaultHospital: string;
  defaultAnesthesiologistName: string;
  defaultCrm: string;
  vitalIntervalMinutes: number;
  soundAlertsEnabled: boolean;
  compactMode: boolean;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultHospital: "",
  defaultAnesthesiologistName: "",
  defaultCrm: "",
  vitalIntervalMinutes: 5,
  soundAlertsEnabled: true,
  compactMode: false
};
