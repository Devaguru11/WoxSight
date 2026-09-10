-- ============================================================
-- Receptionist Absence Database Backup Script
-- Table: absence_events_video
-- Database: SQLite (data/results/metadata.sqlite)
-- Total Records: 13
-- ============================================================

-- 1. Create Table (Drop if exists for replace behavior)
-- DROP TABLE IF EXISTS absence_events_video;

CREATE TABLE absence_events_video (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    camera_id TEXT NOT NULL,
                    site_name TEXT,
                    start_time TEXT NOT NULL,
                    end_time TEXT NOT NULL,
                    duration_seconds REAL NOT NULL,
                    video_path TEXT NOT NULL,
                    file_size_bytes INTEGER,
                    status TEXT DEFAULT 'completed',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );

CREATE INDEX idx_absence_camera_time 
                ON absence_events_video(camera_id, start_time);

-- 2. Insert Queries for all rows in absence_events_video
INSERT INTO absence_events_video (id, camera_id, site_name, start_time, end_time, duration_seconds, video_path, file_size_bytes, status, created_at) VALUES
  (1, 'video-01', 'Reception Video 1', '2026-08-27T06:32:27.704207+00:00', '2026-08-27T06:34:47.671871+00:00', 139.97, 'data\absences\video-01_1787812347_1787812487.mp4', 16968069, 'completed', '2026-08-27 06:34:47'),
  (2, 'video-01', 'Reception Video 1', '2026-08-27T06:47:41.875739+00:00', '2026-08-27T06:50:24.992915+00:00', 163.12, 'data\absences\video-01_1787813261_1787813424.mp4', 17041761, 'completed', '2026-08-27 06:50:25'),
  (3, 'video-01', 'Reception Video 1', '2026-08-27T06:55:32.545683+00:00', '2026-08-27T06:57:45.297699+00:00', 132.75, 'data\absences\video-01-2026-08-27 12-25-32.mp4', 17031638, 'completed', '2026-08-27 06:57:45'),
  (4, 'video-01', 'Reception Video 1', '2026-08-27T07:05:22.693566+00:00', '2026-08-27T07:07:22.200072+00:00', 119.51, 'data\absences\video-01-2026-08-27 12-35-22.mp4', 19687715, 'completed', '2026-08-27 07:07:22'),
  (5, 'video-01', 'Reception Video 1', '2026-08-27T07:07:24.862918+00:00', '2026-08-27T07:13:57.452142+00:00', 392.59, 'data\absences\video-01-2026-08-27 12-37-24.mp4', 56738068, 'completed', '2026-08-27 07:13:57'),
  (6, 'video-01', 'Reception Video 1', '2026-08-28T05:59:17.185679+00:00', '2026-08-28T06:03:47.706341+00:00', 270.52, 'data\absences\video-01-2026-08-28 11-29-17.mp4', 29888183, 'completed', '2026-08-28 06:03:47'),
  (7, 'video-01', 'Reception Video 1', '2026-08-28T06:07:30.723694+00:00', '2026-08-28T06:11:03.425937+00:00', 212.7, 'data\absences\video-01-2026-08-28 11-37-30.mp4', 29877277, 'completed', '2026-08-28 06:11:03'),
  (8, 'video-01', 'Reception Video 1', '2026-08-28T07:06:41.674326+00:00', '2026-08-28T07:19:08.747892+00:00', 747.07, 'data\absences\video-01-2026-08-28 12-36-41.mp4', 83159468, 'completed', '2026-08-28 07:19:08'),
  (9, 'video-01', 'Reception Video 1', '2026-08-28T07:27:13.326094+00:00', '2026-08-28T07:29:45.924825+00:00', 152.6, 'data\absences\video-01-2026-08-28 12-57-13.mp4', 22499249, 'completed', '2026-08-28 07:29:45'),
  (10, 'video-01', 'Reception Video 1', '2026-08-28T07:30:49.395236+00:00', '2026-08-28T07:34:30.424645+00:00', 221.03, 'data\absences\video-01-2026-08-28 13-00-49.mp4', 35306826, 'completed', '2026-08-28 07:34:30'),
  (11, 'video-01', 'Reception Video 1', '2026-08-28T07:34:33.130192+00:00', '2026-08-28T07:36:28.246392+00:00', 115.11, 'data\absences\video-01-2026-08-28 13-04-33.mp4', 16746018, 'completed', '2026-08-28 07:36:28'),
  (12, 'video-01', 'Reception Video 1', '2026-08-28T07:36:31.319073+00:00', '2026-08-28T07:38:09.408903+00:00', 98.09, 'data\absences\video-01-2026-08-28 13-06-31.mp4', 13085572, 'completed', '2026-08-28 07:38:09'),
  (13, 'video-01', 'Reception Video 1', '2026-08-28T07:38:12.920241+00:00', '2026-08-28T07:39:35.304461+00:00', 82.38, 'data\absences\video-01-2026-08-28 13-08-12.mp4', 12215897, 'completed', '2026-08-28 07:39:35');
