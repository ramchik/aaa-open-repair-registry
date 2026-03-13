import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET /api/stats/dashboard  – high-level counts and outcome metrics
router.get('/dashboard', async (req: Request, res: Response) => {
    try {
        const [
            totals,
            byType,
            mortalityByType,
            rupturedCount,
            complicationRates,
            recentProcedures,
            annualVolume,
            evarOpenRatio
        ] = await Promise.all([
            // Overall counts
            pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM patients) AS total_patients,
                    (SELECT COUNT(*) FROM procedures) AS total_procedures,
                    (SELECT COUNT(*) FROM follow_up) AS total_followups
            `),
            // Procedures by type
            pool.query(`
                SELECT procedure_type, COUNT(*) AS count
                FROM procedures
                GROUP BY procedure_type
                ORDER BY count DESC
            `),
            // 30-day mortality by procedure type
            pool.query(`
                SELECT procedure_type,
                       COUNT(*) AS total,
                       SUM(CASE WHEN in_hospital_mortality THEN 1 ELSE 0 END) AS deaths,
                       ROUND(100.0 * SUM(CASE WHEN in_hospital_mortality THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS mortality_rate_pct
                FROM procedures
                GROUP BY procedure_type
                ORDER BY procedure_type
            `),
            // Ruptured AAA count
            pool.query(`
                SELECT COUNT(*) AS ruptured_count
                FROM procedures pr
                JOIN procedure_aaa aaa ON aaa.procedure_id = pr.id
                WHERE aaa.symptom_status = 'Ruptured'
            `),
            // Complication rates (AAA cases)
            pool.query(`
                SELECT
                    COUNT(*) AS total_aaa,
                    ROUND(100.0 * SUM(CASE WHEN cardiac_complication THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS cardiac_pct,
                    ROUND(100.0 * SUM(CASE WHEN pulmonary_complication THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS pulmonary_pct,
                    ROUND(100.0 * SUM(CASE WHEN renal_complication THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS renal_pct,
                    ROUND(100.0 * SUM(CASE WHEN neurological_complication THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS neuro_pct,
                    ROUND(100.0 * SUM(CASE WHEN return_to_or THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS return_to_or_pct,
                    ROUND(100.0 * SUM(CASE WHEN readmission_30day THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS readmission_pct,
                    ROUND(100.0 * SUM(CASE WHEN conversion_to_open THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS conversion_pct
                FROM procedure_aaa
            `),
            // Recent 10 procedures
            pool.query(`
                SELECT pr.id, pr.procedure_type, pr.procedure_date, pr.urgency, pr.surgeon_name,
                       pat.first_name, pat.last_name, pat.mrn,
                       aaa.max_aaa_diameter_mm, aaa.symptom_status
                FROM procedures pr
                JOIN patients pat ON pat.id = pr.patient_id
                LEFT JOIN procedure_aaa aaa ON aaa.procedure_id = pr.id
                ORDER BY pr.procedure_date DESC, pr.created_at DESC
                LIMIT 10
            `),
            // Annual procedure volume (last 5 years)
            pool.query(`
                SELECT EXTRACT(YEAR FROM procedure_date) AS year,
                       COUNT(*) AS total,
                       SUM(CASE WHEN procedure_type IN ('AAA_OPEN','EVAR','FEVAR','BEVAR') THEN 1 ELSE 0 END) AS aaa_count
                FROM procedures
                WHERE procedure_date >= NOW() - INTERVAL '5 years'
                GROUP BY year
                ORDER BY year
            `),
            // EVAR vs open ratio
            pool.query(`
                SELECT
                    SUM(CASE WHEN procedure_type = 'EVAR' THEN 1 ELSE 0 END) AS evar,
                    SUM(CASE WHEN procedure_type = 'AAA_OPEN' THEN 1 ELSE 0 END) AS open_repair,
                    SUM(CASE WHEN procedure_type IN ('FEVAR','BEVAR') THEN 1 ELSE 0 END) AS complex_evar
                FROM procedures
                WHERE procedure_type IN ('AAA_OPEN','EVAR','FEVAR','BEVAR')
            `)
        ]);

        res.json({
            totals: totals.rows[0],
            procedures_by_type: byType.rows,
            mortality_by_type: mortalityByType.rows,
            ruptured_aaa: rupturedCount.rows[0],
            complication_rates: complicationRates.rows[0],
            recent_procedures: recentProcedures.rows,
            annual_volume: annualVolume.rows,
            aaa_repair_type_breakdown: evarOpenRatio.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /api/stats/aaa-outcomes  – detailed AAA outcome analysis
router.get('/aaa-outcomes', async (req: Request, res: Response) => {
    try {
        const { year, repair_type } = req.query;
        let filter = 'WHERE 1=1';
        const params: any[] = [];

        if (year) { params.push(year); filter += ` AND EXTRACT(YEAR FROM pr.procedure_date) = $${params.length}`; }
        if (repair_type) { params.push(repair_type); filter += ` AND aaa.repair_type = $${params.length}`; }

        const result = await pool.query(`
            SELECT
                aaa.repair_type,
                COUNT(*) AS n,
                ROUND(AVG(aaa.max_aaa_diameter_mm), 1) AS avg_diameter_mm,
                ROUND(AVG(pr.operative_time_min), 0) AS avg_op_time_min,
                ROUND(AVG(pr.estimated_blood_loss_ml), 0) AS avg_ebl_ml,
                ROUND(AVG(pr.hospital_los_days), 1) AS avg_los_days,
                ROUND(AVG(pr.icu_days), 1) AS avg_icu_days,
                ROUND(100.0 * SUM(CASE WHEN pr.in_hospital_mortality THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS mortality_pct,
                ROUND(100.0 * SUM(CASE WHEN aaa.cardiac_complication THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS cardiac_pct,
                ROUND(100.0 * SUM(CASE WHEN aaa.renal_complication THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS renal_pct,
                ROUND(100.0 * SUM(CASE WHEN aaa.conversion_to_open THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS conversion_pct,
                ROUND(100.0 * SUM(CASE WHEN aaa.readmission_30day THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS readmission_pct,
                SUM(CASE WHEN aaa.symptom_status = 'Ruptured' THEN 1 ELSE 0 END) AS ruptured_n,
                SUM(CASE WHEN pr.urgency = 'Elective' THEN 1 ELSE 0 END) AS elective_n
            FROM procedure_aaa aaa
            JOIN procedures pr ON pr.id = aaa.procedure_id
            ${filter}
            GROUP BY aaa.repair_type
        `, params);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /api/stats/followup-summary?procedure_id=X
router.get('/followup-summary', async (req: Request, res: Response) => {
    try {
        const { procedure_type } = req.query;
        const params: any[] = [];
        let filter = '';
        if (procedure_type) { params.push(procedure_type); filter = `WHERE pr.procedure_type = $1`; }

        const result = await pool.query(`
            SELECT
                COUNT(DISTINCT fu.procedure_id) AS procedures_with_followup,
                ROUND(100.0 * SUM(CASE WHEN fu.vital_status = 'Deceased' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS late_mortality_pct,
                ROUND(100.0 * SUM(CASE WHEN fu.reintervention THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS reintervention_pct,
                ROUND(100.0 * SUM(CASE WHEN fu.endoleak_present THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS endoleak_pct,
                ROUND(100.0 * SUM(CASE WHEN fu.sac_change = 'Increased' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS sac_growth_pct
            FROM follow_up fu
            JOIN procedures pr ON pr.id = fu.procedure_id
            ${filter}
        `, params);

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /api/centers
router.get('/centers', async (_req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM centers ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
