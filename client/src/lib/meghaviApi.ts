/**
 * Meghavi POC — typed API client hooks
 * All data fetching for the three POC modules lives here.
 */
import { useEffect, useState } from "react";
import { api } from "./api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MeghaviCamera {
  id: number;
  camera_key: string;
  display_name: string;
  area: string;
  status: string;
  location_id: number;
  location_name: string;
  stream_url: string | null;
}

export interface TrendPoint {
  hour: string;
  walkins: number;
  staff_unavail_pct: number;
  meet_greet: number;
}

export interface RecentAlert {
  module: string;
  severity: string;
  occurred_at: string;
  camera_name: string;
  absent_duration_seconds: number | null;
  greeted: boolean | null;
  snapshot_url: string | null;
}

export interface DashboardSummary {
  date: string;
  from: string;
  to: string;
  is_single_day: boolean;
  walkins_today: number;
  prev_walkins_today: number;
  staff_unavailability_pct: number;
  prev_staff_unavailability_pct: number;
  total_absent_minutes: number;
  meet_greet_total: number;
  prev_meet_greet_total: number;
  meet_greet_ungreeted: number;
  greet_rate_pct: number | null;
  total_alerts: number;
  prev_total_alerts: number;
  crowd_events_today: number;
  after_hours_today: number;
  trend: TrendPoint[];
  recent_alerts: RecentAlert[];
}

export interface WalkinsAnalytics {
  from: string;
  to: string;
  total: number;
  prev_total: number;
  avg_dwell_seconds: number;
  prev_avg_dwell_seconds: number;
  peak_hour: string | null;
  prev_peak_hour: string | null;
  peak_count: number;
  cameras_online: number;
  hourly_trend: { hour: string; walkins: number }[];
  by_day: { day: string; walkins: number }[];
  events: WalkinEvent[];
}

export interface WalkinEvent {
  id: number;
  camera_key: string;
  camera_name: string;
  location_name: string;
  detected_at: string;
  person_count: number;
  confidence: number | null;
  snapshot_url: string | null;
  face_crop_url: string | null;
  video_url: string | null;
  dwell_seconds: number;
}

export interface MeetGreetAnalytics {
  from: string;
  to: string;
  total_arrivals: number;
  greeted: number;
  ungreeted: number;
  greet_rate_pct: number | null;
  avg_greet_delay_seconds: number | null;
  prev_total_arrivals: number;
  prev_greeted: number;
  prev_ungreeted: number;
  prev_greet_rate_pct: number | null;
  prev_avg_greet_delay_seconds: number | null;
  by_day: { day: string; total: number; greeted: number; ungreeted: number; greet_rate_pct: number }[];
  hourly: { hour: string; total: number; greeted: number; greet_rate_pct: number }[];
  events: MeetGreetEvent[];
}

export interface MeetGreetEvent {
  id: number | string;
  camera_key: string;
  camera_name: string;
  location_name: string;
  detected_at: string;
  greeted: boolean;
  greet_delay_seconds: number | null;
  confidence: number | null;
  snapshot_url: string | null;
  video_url: string | null;
  duration_seconds?: number;
  customers_in_roi?: number;
  staff_in_roi?: number;
  status?: string;
  exit_reason?: string;
}

export interface StaffAvailabilityAnalytics {
  from: string;
  to: string;
  unavailability_pct: number;
  total_absence_events: number;
  total_absent_minutes: number;
  affected_cameras: number;
  // Previous period — used to show delta vs yesterday / prev week.
  prev_unavailability_pct: number;
  prev_total_absence_events: number;
  prev_total_absent_minutes: number;
  prev_affected_cameras: number;
  hourly_rate: { hour: string; rate: number }[];
  by_day: { day: string; rate: number }[];
  unattended_areas: UnattendedArea[];
  events: StaffAbsenceEvent[];
}

export interface UnattendedArea {
  id: number;
  camera_key: string;
  area: string;
  area_type: string;
  occurred_at: string;
  absent_duration_seconds: number;
  snapshot_url: string | null;
  video_url: string | null;
}

export interface StaffAbsenceEvent {
  id: number;
  camera_key: string;
  camera_name: string;
  location_name: string;
  detected_at: string;
  absent_duration_seconds: number;
  snapshot_url: string | null;
  video_url: string | null;
}

// ---------------------------------------------------------------------------
// Generic fetch hook
// ---------------------------------------------------------------------------

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useFetch<T>(url: string | null): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: !!url, error: null });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    api.get<T>(url)
      .then((r) => { if (!cancelled) setState({ data: r.data, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState({ data: null, loading: false, error: e?.response?.data?.message || "Failed to load data." }); });
    return () => { cancelled = true; };
  }, [url]);

  return state;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useMeghaviCameras() {
  const { data, loading, error } = useFetch<{ cameras: MeghaviCamera[] }>("/meghavi/cameras");
  return { cameras: data?.cameras ?? [], loading, error };
}

export function useDashboardSummary(from?: string, to?: string) {
  const param = from && to ? `?from=${from}&to=${to}` : from ? `?from=${from}&to=${from}` : "";
  const { data, loading, error } = useFetch<DashboardSummary>(`/meghavi/dashboard/summary${param}`);
  return { summary: data, loading, error };
}

export function useWalkinsAnalytics(from: string | null, to: string | null, locationId?: number) {
  const loc = locationId ? `&location_id=${locationId}` : "";
  const url = from && to ? `/meghavi/analytics/walkins?from=${from}&to=${to}${loc}` : null;
  const { data, loading, error } = useFetch<WalkinsAnalytics>(url);
  return { analytics: data, loading, error };
}

export function useMeetGreetAnalytics(from: string | null, to: string | null, locationId?: number) {
  const loc = locationId ? `&location_id=${locationId}` : "";
  const url = from && to ? `/meghavi/analytics/meet-greet?from=${from}&to=${to}${loc}` : null;
  const { data, loading, error } = useFetch<MeetGreetAnalytics>(url);
  return { analytics: data, loading, error };
}

export function useStaffAvailabilityAnalytics(from: string | null, to: string | null, locationId?: number) {
  const loc = locationId ? `&location_id=${locationId}` : "";
  const url = from && to ? `/meghavi/analytics/staff-availability?from=${from}&to=${to}${loc}` : null;
  const { data, loading, error } = useFetch<StaffAvailabilityAnalytics>(url);
  return { analytics: data, loading, error };
}

// ---------------------------------------------------------------------------
// Waiting Time (derived from meet_greet greet_delay_seconds)
// ---------------------------------------------------------------------------

export interface LongWaitEvent {
  id: number;
  camera_name: string;
  location_name: string;
  wait_seconds: number;
  detected_at: string;
  greeted: boolean;
  snapshot_url: string | null;
}

export interface WaitingTimeAnalytics {
  from: string;
  to: string;
  avg_wait_seconds: number | null;
  max_wait_seconds: number | null;
  min_wait_seconds: number | null;
  customers_served: number;
  prev_avg_wait_seconds: number | null;
  prev_customers_served: number;
  hourly_trend: { hour: string; avg_wait: number }[];
  distribution: { range: string; count: number; percentage: number }[];
  long_wait_events: LongWaitEvent[];
  by_camera: { location: string; avg_wait_seconds: number }[];
}

export function useWaitingTimeAnalytics(from: string | null, to: string | null, locationId?: number) {
  const loc = locationId ? `&location_id=${locationId}` : "";
  const url = from && to ? `/meghavi/analytics/waiting-time?from=${from}&to=${to}${loc}` : null;
  const { data, loading, error } = useFetch<WaitingTimeAnalytics>(url);
  return { analytics: data, loading, error };
}

// ---------------------------------------------------------------------------
// Frisking Bag Anomaly
// ---------------------------------------------------------------------------

export interface FriskingBagEvent {
  id: number;
  saved_at: string;
  frame_number: number | null;
  video_time: string | null;
  class_name: string;
  track_id: number | null;
  confidence: number | null;
  owner_id: string | null;
  owner_distance_px: number | null;
  thumbnail_url: string | null;
  snapshot_url: string | null;
  video_url: string | null;
  camera_name: string;
  location_name: string;
}

export interface FriskingBagAnalytics {
  from: string;
  to: string;
  total_detections: number;
  unique_track_ids: number;
  avg_confidence: number | null;
  owner_association_rate: number;
  prev_total_detections: number;
  prev_owner_association_rate: number;
  events: FriskingBagEvent[];
  confidence_distribution: { bucket: string; count: number }[];
  hourly_trend: { hour: string; detections: number }[];
  by_day: { day: string; detections: number }[];
}

export function useFriskingBagAnalytics(from: string | null, to: string | null, locationId?: number) {
  const loc = locationId ? `&location_id=${locationId}` : "";
  const url = from && to ? `/meghavi/analytics/frisking-bag?from=${from}&to=${to}${loc}` : null;
  const { data, loading, error } = useFetch<FriskingBagAnalytics>(url);
  return { analytics: data, loading, error };
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export type RealAlertCategory = "staff_unavailability" | "walkins" | "meet_greet" | "waiting_time" | "frisking_bag";
export type AlertStatus = "active" | "investigating" | "resolved";

export interface RealAlertEvent {
  id: number | string;
  category: RealAlertCategory;
  severity: "high" | "warning" | "info";
  status: AlertStatus;
  title: string;
  description: string;
  location: string;
  camera: string;
  occurred_at: string;
  snapshot_url: string | null;
  video_url: string | null;
  dwell_seconds?: number;
}

export interface AlertsData {
  events: RealAlertEvent[];
  breakdown: { category: string; count: number; percentage: number }[];
  by_hour: { hour: string; count: number }[];
  status_summary: { status: string; count: number; percentage: number }[];
}

export function useAlertsData(from: string | null, to: string | null) {
  const url = from && to ? `/meghavi/alerts?from=${from}&to=${to}` : null;
  const { data, loading, error } = useFetch<AlertsData>(url);
  return { data, loading, error };
}

// ---------------------------------------------------------------------------
// Raw Inferences (from JSON files on disk)
// ---------------------------------------------------------------------------

export interface WalkinInference {
  id: number;
  type: "walkins";
  camera_name: string;
  location: string;
  detected_at: string;
  person_count: number;
  confidence: number | null;
  dwell_seconds: number;
  snapshot_url: string | null;
  face_crop_url: string | null;
  video_url: null;
}

export interface StaffInference {
  id: number;
  type: "staff_unavailability";
  camera_name: string;
  location: string;
  detected_at: string;
  end_time: string | null;
  absent_duration_seconds: number;
  severity: string;
  snapshot_url: string | null;
  video_url: string | null;
}

export interface MeetGreetInference {
  id: string;
  type: "meet_greet";
  camera_name: string;
  location: string;
  detected_at: string | null;
  event_subtype: "greet" | "missed";
  greeted: boolean;
  duration_seconds: number;
  customers_in_roi: number;
  staff_in_roi: number;
  status: string;
  exit_reason: string;
  snapshot_url: string | null;
  video_url: null;
}

export interface InferencesData {
  walkins: WalkinInference[];
  staff_unavailability: StaffInference[];
  meet_greet: MeetGreetInference[];
}

export function useInferences() {
  const { data, loading, error } = useFetch<InferencesData>("/meghavi/inferences");
  return { data, loading, error };
}

// ---------------------------------------------------------------------------
// Overcrowding
// ---------------------------------------------------------------------------

export interface CrowdEvent {
  id: string;
  camera_name: string;
  location: string;
  detected_at: string;
  person_count: number;
  threshold: number;
  severity: string;
  snapshot_url: string | null;
}

export interface OvercrowdingData {
  from: string;
  to: string;
  total: number;
  prev_total: number;
  cameras_active: number;
  alerts_triggered: number;
  peak_hour: string | null;
  hourly_trend: { hour: string; count: number }[];
  by_day: { day: string; count: number }[];
  events: CrowdEvent[];
}

export function useOvercrowdingData(from: string | null, to: string | null) {
  const url = from && to ? `/meghavi/analytics/overcrowding?from=${from}&to=${to}` : null;
  const { data, loading, error } = useFetch<OvercrowdingData>(url);
  return { data, loading, error };
}

// ---------------------------------------------------------------------------
// After Hours
// ---------------------------------------------------------------------------

export interface AfterHoursEvent {
  id: string;
  camera_name: string;
  location: string;
  detected_at: string;
  person_count: number;
  business_hours: string;
  severity: string;
  snapshot_url: string | null;
}

export interface AfterHoursData {
  from: string;
  to: string;
  total: number;
  prev_total: number;
  cameras_triggered: number;
  alerts_sent: number;
  avg_duration: number | null;
  hourly_trend: { hour: string; count: number }[];
  events: AfterHoursEvent[];
}

export function useAfterHoursData(from: string | null, to: string | null) {
  const url = from && to ? `/meghavi/analytics/after-hours?from=${from}&to=${to}` : null;
  const { data, loading, error } = useFetch<AfterHoursData>(url);
  return { data, loading, error };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function yesterdayIST(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function sevenDaysAgoIST(): string {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
