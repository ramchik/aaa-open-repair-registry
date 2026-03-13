-- 002_vascular_registry_schema.sql
-- Comprehensive Vascular Patient Registry Schema
-- Modeled after VQI (Vascular Quality Initiative) data elements

-- Drop old tables if upgrading
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS repairs CASCADE;
DROP TABLE IF EXISTS follow_up CASCADE;
DROP TABLE IF EXISTS procedure_aaa CASCADE;
DROP TABLE IF EXISTS procedures CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS centers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ─────────────────────────────────────────────
-- CENTERS / HOSPITALS
-- ─────────────────────────────────────────────
CREATE TABLE centers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'USA',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- USERS (surgeons / data managers)
-- ─────────────────────────────────────────────
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'surgeon',   -- admin | surgeon | data_manager
    center_id INT REFERENCES centers(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- PATIENTS
-- ─────────────────────────────────────────────
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    mrn VARCHAR(100),                     -- Medical Record Number (optional, center-specific)
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    sex VARCHAR(10),                      -- Male | Female | Other
    race VARCHAR(60),                     -- White | Black | Hispanic | Asian | Native American | Other | Unknown
    ethnicity VARCHAR(60),               -- Hispanic or Latino | Not Hispanic or Latino | Unknown
    -- Contact
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    phone VARCHAR(30),
    -- Center link
    center_id INT REFERENCES centers(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- PROCEDURES (master record, procedure-agnostic)
-- ─────────────────────────────────────────────
CREATE TABLE procedures (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    procedure_type VARCHAR(60) NOT NULL,  -- AAA_OPEN | EVAR | FEVAR | BEVAR | CEA | CAS | LOWER_EXTREMITY | DIALYSIS_ACCESS | OTHER
    procedure_date DATE NOT NULL,
    center_id INT REFERENCES centers(id) ON DELETE SET NULL,
    surgeon_name VARCHAR(255),

    -- ── Pre-operative Risk Factors ──
    asa_class INT,                        -- 1–5
    hypertension BOOLEAN DEFAULT FALSE,
    diabetes BOOLEAN DEFAULT FALSE,
    diabetes_type VARCHAR(30),            -- None | Type 1 | Type 2 | Insulin-dependent
    smoking_status VARCHAR(20),           -- Never | Former | Current
    pack_years DECIMAL(5,1),
    dyslipidemia BOOLEAN DEFAULT FALSE,
    coronary_artery_disease BOOLEAN DEFAULT FALSE,
    prior_mi BOOLEAN DEFAULT FALSE,
    prior_pci_cabg BOOLEAN DEFAULT FALSE,
    congestive_heart_failure BOOLEAN DEFAULT FALSE,
    nyha_class INT,                       -- 1–4
    chronic_kidney_disease BOOLEAN DEFAULT FALSE,
    preop_creatinine DECIMAL(5,2),
    on_dialysis BOOLEAN DEFAULT FALSE,
    copd BOOLEAN DEFAULT FALSE,
    prior_stroke_tia BOOLEAN DEFAULT FALSE,
    anticoagulation BOOLEAN DEFAULT FALSE,
    antiplatelet BOOLEAN DEFAULT FALSE,
    statin_use BOOLEAN DEFAULT FALSE,

    -- ── Operative Details ──
    urgency VARCHAR(20),                  -- Elective | Urgent | Emergent | Ruptured
    anesthesia_type VARCHAR(40),          -- General | Regional/Spinal | Local+Sedation | Local
    operative_time_min INT,
    estimated_blood_loss_ml INT,
    transfusion_units INT DEFAULT 0,

    -- ── In-hospital Outcomes ──
    in_hospital_mortality BOOLEAN DEFAULT FALSE,
    mortality_date DATE,
    icu_days INT,
    hospital_los_days INT,

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- AAA-SPECIFIC PROCEDURE DATA
-- (covers Open Repair, EVAR, FEVAR, BEVAR)
-- ─────────────────────────────────────────────
CREATE TABLE procedure_aaa (
    id SERIAL PRIMARY KEY,
    procedure_id INT UNIQUE NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,

    -- ── Anatomy / Imaging ──
    repair_type VARCHAR(20) NOT NULL,     -- Open | EVAR | FEVAR | BEVAR | Chimney
    max_aaa_diameter_mm INT,
    max_iliac_diameter_right_mm INT,
    max_iliac_diameter_left_mm INT,
    aaa_extent VARCHAR(40),               -- Infrarenal | Juxtarenal | Pararenal | Suprarenal | Thoracoabdominal
    neck_length_mm INT,
    neck_angle_deg INT,
    symptom_status VARCHAR(20),           -- Asymptomatic | Symptomatic | Ruptured
    indication TEXT,

    -- ── Open Repair ──
    open_approach VARCHAR(30),            -- Transperitoneal | Retroperitoneal
    clamp_level VARCHAR(30),              -- Infrarenal | Juxtarenal | Suprarenal | Supraceliac
    graft_configuration VARCHAR(40),      -- Tube | Bifurcated | Aorto-iliac | Aorto-femoral
    graft_brand VARCHAR(100),

    -- ── Endovascular (EVAR/FEVAR/BEVAR) ──
    evar_device VARCHAR(100),
    evar_access VARCHAR(30),              -- Percutaneous | Cutdown
    evar_proximal_seal_zone INT,          -- 0=infrarenal, 1=juxtarenal, 2=pararenal, 3=visceral, 4=thoracic
    iliac_extension_right BOOLEAN DEFAULT FALSE,
    iliac_extension_left BOOLEAN DEFAULT FALSE,
    number_of_fenestrations INT,
    number_of_branches INT,
    conversion_to_open BOOLEAN DEFAULT FALSE,

    -- ── Peri-operative Complications ──
    cardiac_complication BOOLEAN DEFAULT FALSE,
    cardiac_complication_detail TEXT,
    pulmonary_complication BOOLEAN DEFAULT FALSE,
    pulmonary_complication_detail TEXT,
    renal_complication BOOLEAN DEFAULT FALSE,
    renal_complication_detail TEXT,
    neurological_complication BOOLEAN DEFAULT FALSE,   -- stroke, spinal cord ischemia
    neurological_complication_detail TEXT,
    wound_complication BOOLEAN DEFAULT FALSE,
    bowel_ischemia BOOLEAN DEFAULT FALSE,
    limb_ischemia BOOLEAN DEFAULT FALSE,
    graft_complication BOOLEAN DEFAULT FALSE,
    return_to_or BOOLEAN DEFAULT FALSE,
    return_to_or_reason TEXT,
    readmission_30day BOOLEAN DEFAULT FALSE,
    readmission_reason TEXT,

    procedure_notes TEXT
);

-- ─────────────────────────────────────────────
-- FOLLOW-UP VISITS
-- ─────────────────────────────────────────────
CREATE TABLE follow_up (
    id SERIAL PRIMARY KEY,
    procedure_id INT NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    months_from_procedure DECIMAL(6,1),

    -- ── Vital Status ──
    vital_status VARCHAR(20),             -- Alive | Deceased
    death_date DATE,
    cause_of_death VARCHAR(255),
    death_related_to_procedure BOOLEAN,

    -- ── Functional Status ──
    ambulatory_status VARCHAR(40),        -- Independent | Assisted | Non-ambulatory

    -- ── Imaging (mainly EVAR surveillance) ──
    imaging_performed BOOLEAN DEFAULT FALSE,
    imaging_type VARCHAR(30),             -- CTA | Duplex Ultrasound | X-ray | MRA
    max_sac_diameter_mm INT,
    sac_change VARCHAR(20),               -- Stable | Increased | Decreased
    endoleak_present BOOLEAN DEFAULT FALSE,
    endoleak_type VARCHAR(10),            -- I | II | III | IV | V

    -- ── Reintervention ──
    reintervention BOOLEAN DEFAULT FALSE,
    reintervention_date DATE,
    reintervention_type TEXT,

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────────
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    record_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- SEED: default center + admin user (password: admin123)
-- ─────────────────────────────────────────────
INSERT INTO centers (name, city, state) VALUES ('Default Hospital', 'Your City', 'Your State');

INSERT INTO users (username, email, password_hash, role, center_id)
VALUES ('admin', 'admin@registry.local',
        '$2b$10$placeholder_change_this_hash', 'admin', 1);
