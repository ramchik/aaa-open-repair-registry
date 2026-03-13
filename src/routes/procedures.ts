import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET /api/procedures  – list all procedures (with optional filters)
router.get('/', async (req: Request, res: Response) => {
    try {
        const { patient_id, procedure_type, center_id, year } = req.query;
        let query = `
            SELECT pr.*,
                   pat.first_name, pat.last_name, pat.date_of_birth, pat.mrn,
                   c.name AS center_name,
                   aaa.repair_type, aaa.max_aaa_diameter_mm, aaa.symptom_status,
                   aaa.aaa_extent, aaa.conversion_to_open
            FROM procedures pr
            JOIN patients pat ON pat.id = pr.patient_id
            LEFT JOIN centers c ON c.id = pr.center_id
            LEFT JOIN procedure_aaa aaa ON aaa.procedure_id = pr.id
        `;
        const params: any[] = [];
        const conditions: string[] = [];

        if (patient_id) { params.push(patient_id); conditions.push(`pr.patient_id = $${params.length}`); }
        if (procedure_type) { params.push(procedure_type); conditions.push(`pr.procedure_type = $${params.length}`); }
        if (center_id) { params.push(center_id); conditions.push(`pr.center_id = $${params.length}`); }
        if (year) { params.push(year); conditions.push(`EXTRACT(YEAR FROM pr.procedure_date) = $${params.length}`); }

        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY pr.procedure_date DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /api/procedures/:id
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const proc = await pool.query(
            `SELECT pr.*,
                    pat.first_name, pat.last_name, pat.date_of_birth, pat.mrn, pat.sex,
                    c.name AS center_name
             FROM procedures pr
             JOIN patients pat ON pat.id = pr.patient_id
             LEFT JOIN centers c ON c.id = pr.center_id
             WHERE pr.id = $1`, [id]
        );
        if (proc.rows.length === 0) return res.status(404).json({ error: 'Procedure not found' });

        const aaa = await pool.query('SELECT * FROM procedure_aaa WHERE procedure_id = $1', [id]);
        const followups = await pool.query(
            'SELECT * FROM follow_up WHERE procedure_id = $1 ORDER BY visit_date ASC', [id]
        );

        res.json({
            ...proc.rows[0],
            aaa_data: aaa.rows[0] || null,
            follow_up: followups.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /api/procedures  – create procedure (+ optional AAA sub-record)
router.post('/', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            patient_id, procedure_type, procedure_date, center_id, surgeon_name,
            asa_class, hypertension, diabetes, diabetes_type, smoking_status, pack_years,
            dyslipidemia, coronary_artery_disease, prior_mi, prior_pci_cabg,
            congestive_heart_failure, nyha_class, chronic_kidney_disease, preop_creatinine,
            on_dialysis, copd, prior_stroke_tia, anticoagulation, antiplatelet, statin_use,
            urgency, anesthesia_type, operative_time_min, estimated_blood_loss_ml, transfusion_units,
            in_hospital_mortality, mortality_date, icu_days, hospital_los_days, notes,
            // AAA-specific
            aaa
        } = req.body;

        const procResult = await client.query(
            `INSERT INTO procedures (
                patient_id, procedure_type, procedure_date, center_id, surgeon_name,
                asa_class, hypertension, diabetes, diabetes_type, smoking_status, pack_years,
                dyslipidemia, coronary_artery_disease, prior_mi, prior_pci_cabg,
                congestive_heart_failure, nyha_class, chronic_kidney_disease, preop_creatinine,
                on_dialysis, copd, prior_stroke_tia, anticoagulation, antiplatelet, statin_use,
                urgency, anesthesia_type, operative_time_min, estimated_blood_loss_ml, transfusion_units,
                in_hospital_mortality, mortality_date, icu_days, hospital_los_days, notes
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35
            ) RETURNING *`,
            [
                patient_id, procedure_type, procedure_date, center_id, surgeon_name,
                asa_class, hypertension, diabetes, diabetes_type, smoking_status, pack_years,
                dyslipidemia, coronary_artery_disease, prior_mi, prior_pci_cabg,
                congestive_heart_failure, nyha_class, chronic_kidney_disease, preop_creatinine,
                on_dialysis, copd, prior_stroke_tia, anticoagulation, antiplatelet, statin_use,
                urgency, anesthesia_type, operative_time_min, estimated_blood_loss_ml, transfusion_units,
                in_hospital_mortality, mortality_date, icu_days, hospital_los_days, notes
            ]
        );

        const procedure = procResult.rows[0];

        let aaaData = null;
        if (aaa && ['AAA_OPEN', 'EVAR', 'FEVAR', 'BEVAR'].includes(procedure_type)) {
            const aaaResult = await client.query(
                `INSERT INTO procedure_aaa (
                    procedure_id, repair_type,
                    max_aaa_diameter_mm, max_iliac_diameter_right_mm, max_iliac_diameter_left_mm,
                    aaa_extent, neck_length_mm, neck_angle_deg, symptom_status, indication,
                    open_approach, clamp_level, graft_configuration, graft_brand,
                    evar_device, evar_access, evar_proximal_seal_zone,
                    iliac_extension_right, iliac_extension_left,
                    number_of_fenestrations, number_of_branches, conversion_to_open,
                    cardiac_complication, cardiac_complication_detail,
                    pulmonary_complication, pulmonary_complication_detail,
                    renal_complication, renal_complication_detail,
                    neurological_complication, neurological_complication_detail,
                    wound_complication, bowel_ischemia, limb_ischemia, graft_complication,
                    return_to_or, return_to_or_reason,
                    readmission_30day, readmission_reason, procedure_notes
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
                    $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39
                ) RETURNING *`,
                [
                    procedure.id, aaa.repair_type,
                    aaa.max_aaa_diameter_mm, aaa.max_iliac_diameter_right_mm, aaa.max_iliac_diameter_left_mm,
                    aaa.aaa_extent, aaa.neck_length_mm, aaa.neck_angle_deg, aaa.symptom_status, aaa.indication,
                    aaa.open_approach, aaa.clamp_level, aaa.graft_configuration, aaa.graft_brand,
                    aaa.evar_device, aaa.evar_access, aaa.evar_proximal_seal_zone,
                    aaa.iliac_extension_right, aaa.iliac_extension_left,
                    aaa.number_of_fenestrations, aaa.number_of_branches, aaa.conversion_to_open,
                    aaa.cardiac_complication, aaa.cardiac_complication_detail,
                    aaa.pulmonary_complication, aaa.pulmonary_complication_detail,
                    aaa.renal_complication, aaa.renal_complication_detail,
                    aaa.neurological_complication, aaa.neurological_complication_detail,
                    aaa.wound_complication, aaa.bowel_ischemia, aaa.limb_ischemia, aaa.graft_complication,
                    aaa.return_to_or, aaa.return_to_or_reason,
                    aaa.readmission_30day, aaa.readmission_reason, aaa.procedure_notes
                ]
            );
            aaaData = aaaResult.rows[0];
        }

        await client.query('COMMIT');
        res.status(201).json({ ...procedure, aaa_data: aaaData });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        client.release();
    }
});

// PUT /api/procedures/:id
router.put('/:id', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const {
            procedure_date, center_id, surgeon_name,
            asa_class, hypertension, diabetes, diabetes_type, smoking_status, pack_years,
            dyslipidemia, coronary_artery_disease, prior_mi, prior_pci_cabg,
            congestive_heart_failure, nyha_class, chronic_kidney_disease, preop_creatinine,
            on_dialysis, copd, prior_stroke_tia, anticoagulation, antiplatelet, statin_use,
            urgency, anesthesia_type, operative_time_min, estimated_blood_loss_ml, transfusion_units,
            in_hospital_mortality, mortality_date, icu_days, hospital_los_days, notes,
            aaa
        } = req.body;

        const procResult = await client.query(
            `UPDATE procedures SET
                procedure_date=$1, center_id=$2, surgeon_name=$3,
                asa_class=$4, hypertension=$5, diabetes=$6, diabetes_type=$7, smoking_status=$8, pack_years=$9,
                dyslipidemia=$10, coronary_artery_disease=$11, prior_mi=$12, prior_pci_cabg=$13,
                congestive_heart_failure=$14, nyha_class=$15, chronic_kidney_disease=$16, preop_creatinine=$17,
                on_dialysis=$18, copd=$19, prior_stroke_tia=$20, anticoagulation=$21, antiplatelet=$22, statin_use=$23,
                urgency=$24, anesthesia_type=$25, operative_time_min=$26, estimated_blood_loss_ml=$27, transfusion_units=$28,
                in_hospital_mortality=$29, mortality_date=$30, icu_days=$31, hospital_los_days=$32, notes=$33,
                updated_at=CURRENT_TIMESTAMP
             WHERE id=$34 RETURNING *`,
            [
                procedure_date, center_id, surgeon_name,
                asa_class, hypertension, diabetes, diabetes_type, smoking_status, pack_years,
                dyslipidemia, coronary_artery_disease, prior_mi, prior_pci_cabg,
                congestive_heart_failure, nyha_class, chronic_kidney_disease, preop_creatinine,
                on_dialysis, copd, prior_stroke_tia, anticoagulation, antiplatelet, statin_use,
                urgency, anesthesia_type, operative_time_min, estimated_blood_loss_ml, transfusion_units,
                in_hospital_mortality, mortality_date, icu_days, hospital_los_days, notes,
                id
            ]
        );
        if (procResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Procedure not found' });
        }

        if (aaa) {
            await client.query(
                `INSERT INTO procedure_aaa (procedure_id, repair_type,
                    max_aaa_diameter_mm, aaa_extent, symptom_status, indication,
                    open_approach, clamp_level, graft_configuration, graft_brand,
                    evar_device, evar_access, evar_proximal_seal_zone,
                    cardiac_complication, pulmonary_complication, renal_complication,
                    neurological_complication, wound_complication, bowel_ischemia,
                    limb_ischemia, graft_complication, return_to_or, return_to_or_reason,
                    readmission_30day, readmission_reason, procedure_notes)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
                 ON CONFLICT (procedure_id) DO UPDATE SET
                    repair_type=EXCLUDED.repair_type,
                    max_aaa_diameter_mm=EXCLUDED.max_aaa_diameter_mm,
                    aaa_extent=EXCLUDED.aaa_extent,
                    symptom_status=EXCLUDED.symptom_status,
                    indication=EXCLUDED.indication,
                    open_approach=EXCLUDED.open_approach,
                    clamp_level=EXCLUDED.clamp_level,
                    graft_configuration=EXCLUDED.graft_configuration,
                    graft_brand=EXCLUDED.graft_brand,
                    evar_device=EXCLUDED.evar_device,
                    evar_access=EXCLUDED.evar_access,
                    evar_proximal_seal_zone=EXCLUDED.evar_proximal_seal_zone,
                    cardiac_complication=EXCLUDED.cardiac_complication,
                    pulmonary_complication=EXCLUDED.pulmonary_complication,
                    renal_complication=EXCLUDED.renal_complication,
                    neurological_complication=EXCLUDED.neurological_complication,
                    wound_complication=EXCLUDED.wound_complication,
                    bowel_ischemia=EXCLUDED.bowel_ischemia,
                    limb_ischemia=EXCLUDED.limb_ischemia,
                    graft_complication=EXCLUDED.graft_complication,
                    return_to_or=EXCLUDED.return_to_or,
                    return_to_or_reason=EXCLUDED.return_to_or_reason,
                    readmission_30day=EXCLUDED.readmission_30day,
                    readmission_reason=EXCLUDED.readmission_reason,
                    procedure_notes=EXCLUDED.procedure_notes`,
                [id, aaa.repair_type,
                 aaa.max_aaa_diameter_mm, aaa.aaa_extent, aaa.symptom_status, aaa.indication,
                 aaa.open_approach, aaa.clamp_level, aaa.graft_configuration, aaa.graft_brand,
                 aaa.evar_device, aaa.evar_access, aaa.evar_proximal_seal_zone,
                 aaa.cardiac_complication, aaa.pulmonary_complication, aaa.renal_complication,
                 aaa.neurological_complication, aaa.wound_complication, aaa.bowel_ischemia,
                 aaa.limb_ischemia, aaa.graft_complication, aaa.return_to_or, aaa.return_to_or_reason,
                 aaa.readmission_30day, aaa.readmission_reason, aaa.procedure_notes]
            );
        }

        await client.query('COMMIT');
        res.json(procResult.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        client.release();
    }
});

// DELETE /api/procedures/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM procedures WHERE id=$1 RETURNING id', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Procedure not found' });
        res.json({ message: 'Procedure deleted', id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
