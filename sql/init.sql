-- ============================================================
-- AICS Lead Magnet Engine — MySQL Schema
-- Bridge table for Moodle LMS integration
-- ============================================================

CREATE TABLE IF NOT EXISTS aics_leads (
    id          INT             AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255)    NOT NULL,
    email       VARCHAR(255)    NOT NULL,
    total_score INT             NOT NULL COMMENT 'Sum of 16 answers (16-64)',
    pillar_1_score INT          NOT NULL COMMENT 'Subtotal pillar 1 (max 16)',
    pillar_2_score INT          NOT NULL COMMENT 'Subtotal pillar 2 (max 16)',
    pillar_3_score INT          NOT NULL COMMENT 'Subtotal pillar 3 (max 16)',
    pillar_4_score INT          NOT NULL COMMENT 'Subtotal pillar 4 (max 16)',
    answers     JSON            NOT NULL COMMENT 'Original 16 answers in JSON',
    industry    VARCHAR(255)    DEFAULT NULL,
    dept_size   VARCHAR(50)     DEFAULT NULL,
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    processed   BOOLEAN         DEFAULT FALSE COMMENT 'Consumed by Moodle?',

    INDEX idx_email        (email),
    INDEX idx_processed    (processed),
    INDEX idx_created_at   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Moodle query example:
-- SELECT * FROM aics_leads WHERE processed = FALSE ORDER BY created_at ASC LIMIT 50;