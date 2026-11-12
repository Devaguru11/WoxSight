-- ---------------------------------------------------------------------------
-- Staff Unavailability Video Seed
-- Real absence events from Reception Video 1 camera (2026-08-27)
--
-- Apply AFTER meghavi_poc.sql:
--   psql -U aiserver -h 127.0.0.1 -p 5435 -d aiserver -f server/sql/meghavi_staff_videos_seed.sql
-- ---------------------------------------------------------------------------

-- Insert the video camera (Reception Video 1 → Woxsen)
INSERT INTO meghavi_cameras (camera_key, location_id, display_name, area)
SELECT 'video-01', id, 'Reception Video 1', 'Reception'
FROM   meghavi_locations WHERE name = 'Woxsen'
ON CONFLICT (camera_key) DO NOTHING;

-- Enable staff_availability module for this camera
INSERT INTO meghavi_camera_modules (camera_id, module)
SELECT c.id, 'staff_availability'
FROM   meghavi_cameras c WHERE c.camera_key = 'video-01'
ON CONFLICT (camera_id, module) DO NOTHING;

-- Insert the 5 real absence events
-- video_url uses URL-encoded filenames (spaces → %20)
INSERT INTO meghavi_staff_availability_events
  (camera_id, detected_at, staff_present, absent_duration_seconds, video_url)
SELECT
  c.id,
  vals.detected_at,
  false,
  vals.duration_seconds,
  vals.video_url
FROM meghavi_cameras c
CROSS JOIN (VALUES
  (
    '2026-08-27T06:32:27.704207+00:00'::timestamptz,
    140,
    '/api/meghavi/uploads/staff-availability/video-01_1787812347_1787812487.mp4'
  ),
  (
    '2026-08-27T06:47:41.875739+00:00'::timestamptz,
    163,
    '/api/meghavi/uploads/staff-availability/video-01_1787813261_1787813424.mp4'
  ),
  (
    '2026-08-27T06:55:32.545683+00:00'::timestamptz,
    133,
    '/api/meghavi/uploads/staff-availability/video-01-2026-08-27%2012-25-32.mp4'
  ),
  (
    '2026-08-27T07:05:22.693566+00:00'::timestamptz,
    120,
    '/api/meghavi/uploads/staff-availability/video-01-2026-08-27%2012-35-22.mp4'
  ),
  (
    '2026-08-27T07:07:24.862918+00:00'::timestamptz,
    393,
    '/api/meghavi/uploads/staff-availability/video-01-2026-08-27%2012-37-24.mp4'
  )
) AS vals(detected_at, duration_seconds, video_url)
WHERE c.camera_key = 'video-01';
