-- Customer Walk-Ins & Wait-Times Table Schema Backup
CREATE TABLE IF NOT EXISTS walkin_sessions (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id              INTEGER UNIQUE,
    stable_id               INTEGER NOT NULL,
    camera_id               TEXT NOT NULL,
    entry_timestamp         REAL NOT NULL,
    last_seen_timestamp     REAL NOT NULL,
    exit_timestamp          REAL,
    dwell_seconds           REAL NOT NULL DEFAULT 0.0,
    status                  TEXT NOT NULL DEFAULT 'INSIDE',
    best_crop_path          TEXT,
    best_face_crop_path     TEXT,
    reentry_count           INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_walkin_track ON walkin_sessions(stable_id, camera_id);
CREATE INDEX IF NOT EXISTS idx_walkin_status ON walkin_sessions(status);

-- Insert Statements for Recorded Walk-In Sessions
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (1, 1, 7, 'video-cam-01', 1787827903.308338, 1787828091.7595167, 1787828091.7595167, 108.0, 'EXITED', 'data\crops\person_7_1787828010431.jpg', NULL, 0);
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (2, 2, 8, 'video-cam-01', 1787827903.308338, 1787828114.1714652, 1787828114.1714652, 30.7, 'EXITED', 'data\crops\person_6_1787828083394.jpg', 'data\crops\face_live_6_1787828083445.jpg', 0);
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (1541, 3, 7, 'video-cam-01', 1787828101.3806348, 1787828145.5187335, 1787828145.5187335, 44.1, 'EXITED', 'data\crops\person_7_1787828144424.jpg', 'data\crops\face_live_7_1787828144493.jpg', 1);
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (1987, 4, 9, 'video-cam-01', 1787828121.7000182, 1787828122.4687412, 1787828122.4687412, 0.8, 'EXITED', NULL, NULL, 0);
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (2016, 5, 6, 'video-cam-01', 1787828124.3582428, 1787828124.7450042, 1787828124.7450042, 0.4, 'EXITED', 'data\crops\person_6_1787828083394.jpg', NULL, 1);
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (2049, 6, 10, 'video-cam-01', 1787828128.7153683, 1787828130.8254898, 1787828130.8254898, 2.1, 'EXITED', NULL, NULL, 0);
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (2111, 7, 9, 'video-cam-01', 1787828134.3925831, 1787828135.0963469, 1787828135.0963469, 0.7, 'EXITED', NULL, NULL, 1);
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (2134, 8, 11, 'video-cam-01', 1787828136.854273, 1787828141.4658186, 1787828141.4658186, 4.6, 'EXITED', NULL, NULL, 0);
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (2166, 9, 6, 'video-cam-01', 1787828147.1574533, 1787828147.7745032, 1787828147.7745032, 0.6, 'EXITED', 'data\crops\person_6_1787828083394.jpg', NULL, 2);
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (2176, 10, 12, 'video-cam-01', 1787828151.1491854, 1787828151.8030252, 1787828151.8030252, 0.7, 'EXITED', NULL, NULL, 0);
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (2191, 11, 13, 'video-cam-01', 1787828170.4450018, 1787828172.1365669, 1787828172.1365669, 1.7, 'EXITED', NULL, NULL, 0);
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (2222, 12, 14, 'video-cam-01', 1787828218.525753, 1787828219.1844928, 1787828219.1844928, 0.7, 'EXITED', NULL, NULL, 0);
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (2235, 13, 15, 'video-cam-01', 1787828224.7045453, 1787828225.2271636, 1787828225.2271636, 0.5, 'EXITED', NULL, NULL, 0);
INSERT INTO walkin_sessions (id, session_id, stable_id, camera_id, entry_timestamp, last_seen_timestamp, exit_timestamp, dwell_seconds, status, best_crop_path, best_face_crop_path, reentry_count) VALUES (2249, 14, 16, 'video-cam-01', 1787828277.6867065, 1787828278.37931, 1787828278.37931, 0.7, 'EXITED', NULL, NULL, 0);
