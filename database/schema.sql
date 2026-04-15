-- database/schema.sql

CREATE DATABASE
IF NOT EXISTS cardiorest CHARACTER
SET utf8mb4
COLLATE utf8mb4_unicode_ci;
USE cardiorest;

-- Käyttäjät (UC_1, TV_11)
CREATE TABLE users
(
    id INT
    AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR
    (100)  NOT NULL,
  email         VARCHAR
    (150)  NOT NULL UNIQUE,
  password_hash VARCHAR
    (255)  NOT NULL,
  role          ENUM
    ('patient', 'professional') NOT NULL DEFAULT 'patient',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

    -- Mittaukset (TV_1)
    CREATE TABLE measurements
    (
        id INT
        AUTO_INCREMENT PRIMARY KEY,
  user_id          INT          NOT NULL,
  recorded_at      TIMESTAMP    NOT NULL,
  duration_seconds INT          NOT NULL,
  rri_data         JSON         NOT NULL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY
        (user_id) REFERENCES users
        (id) ON
        DELETE CASCADE
);

        -- Analyysit (TV_2, TV_3, TV_4, TV_5, TV_10)
        CREATE TABLE analyses
        (
            id INT
            AUTO_INCREMENT PRIMARY KEY,
  measurement_id   INT          NOT NULL,
  readiness        FLOAT,
  rmssd_ms         FLOAT,
  sdnn_ms          FLOAT,
  pns_index        FLOAT,
  sns_index        FLOAT,
  stress_index     FLOAT,
  mean_hr_bpm      FLOAT,
  artefact_level   VARCHAR
            (20),
  timevarying_data JSON,
  sleep_duration_h FLOAT,
  sleep_score      INT,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY
            (measurement_id) REFERENCES measurements
            (id) ON
            DELETE CASCADE
);

            -- Ammattilaisen pääsy potilaan dataan (UC_7, ETV_1, ETV_8)
            CREATE TABLE professional_access
            (
                id INT
                AUTO_INCREMENT PRIMARY KEY,
  patient_id      INT       NOT NULL,
  professional_id INT       NOT NULL,
  granted_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at      TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY
                (patient_id)      REFERENCES users
                (id) ON
                DELETE CASCADE,
  FOREIGN KEY (professional_id)
                REFERENCES users
                (id) ON
                DELETE CASCADE
);