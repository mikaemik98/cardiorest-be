-- database/seed.sql
-- Testitiedot kehitystä varten

USE cardiorest;

-- Testikäyttäjät (salasana: "test1234")
INSERT INTO users
    (name, email, password_hash, role)
VALUES
    ('Matti Meikäläinen', 'matti@test.fi', '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'patient'),
    ('Anna Virtanen', 'anna@test.fi', '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'professional');

-- Testimittaus
INSERT INTO measurements
    (user_id, recorded_at, duration_seconds, rri_data)
VALUES
    (1, '2026-03-15 07:00:00', 27000,
        '[1000, 995, 1010, 980, 1005, 990, 1015, 970, 1008, 985]');

-- Testianalyysi
INSERT INTO analyses
    (
    measurement_id, readiness, rmssd_ms, sdnn_ms,
    pns_index, sns_index, stress_index, mean_hr_bpm,
    artefact_level, sleep_duration_h, sleep_score
    )
VALUES
    (
        1, 85.0, 68.3, 74.1,
        0.75, -1.02, 6.4, 58.0,
        'GOOD', 7.5, 85
);