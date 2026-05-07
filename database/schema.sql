-- database/schema.sql

CREATE DATABASE
IF NOT EXISTS cardiorest
  CHARACTER
SET utf8mb4
COLLATE utf8mb4_unicode_ci;
USE cardiorest;

-- Käyttäjät
CREATE TABLE users
(
  id INT
  AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR
  (100) NOT NULL,
  email         VARCHAR
  (150) NOT NULL UNIQUE,
  password_hash VARCHAR
  (255) NOT NULL,
  role          ENUM
  ('patient', 'professional') NOT NULL DEFAULT 'patient',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

  -- Mittaukset — tallentaa PPI/RRI-raakadatan Kubios-mittauksesta
  CREATE TABLE measurements
  (
    id INT
    AUTO_INCREMENT PRIMARY KEY,
  user_id          INT       NOT NULL,
  recorded_at      DATETIME  NOT NULL,
  duration_seconds INT       NOT NULL DEFAULT 0,
  rri_data         JSON      NOT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY
    (user_id) REFERENCES users
    (id) ON
    DELETE CASCADE
);

    -- Analyysit — tallentaa Kubios Analytics -tulokset ja time-varying HRV-datan
    CREATE TABLE analyses
    (
      id INT
      AUTO_INCREMENT PRIMARY KEY,
  measurement_id   INT   NOT NULL,
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
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY
      (measurement_id) REFERENCES measurements
      (id) ON
      DELETE CASCADE
);

      -- Päiväkirjamerkinnät — käyttäjän päivittäiset hyvinvointimerkinnät
      CREATE TABLE diary_entries
      (
        id INT
        AUTO_INCREMENT PRIMARY KEY,
  user_id    INT  NOT NULL,
  entry_date DATE NOT NULL,
  content    TEXT NOT NULL,
  mood       VARCHAR
        (50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY
        (user_id) REFERENCES users
        (id) ON
        DELETE CASCADE
);