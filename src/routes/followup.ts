import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET /api/followup?procedure_id=X
router.get('/', async (req: Request, res: Response) => {
    try {
        const { procedure_id, patient_id } = req.query;
        let query = `
            SELECT fu.*,
                   pr.procedure_type, pr.procedure_date,
                   pat.first_name, pat.last_name, pat.mrn
            FROM follow_up fu
            JOIN procedures pr ON pr.id = fu.procedure_id
            JOIN patients pat ON pat.id = pr.patient_id
        `;
        const params: any[] = [];
        const conditions: string[] = [];

        if (procedure_id) { params.push(procedure_id); conditions.push(`fu.procedure_id = $${params.length}`); }
        if (patient_id) { params.push(patient_id); conditions.push(`pr.patient_id = $${params.length}`); }

        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY fu.visit_date ASC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /api/followup/:id
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT fu.*, pr.procedure_type, pr.procedure_date,
                    pat.first_name, pat.last_name, pat.mrn
             FROM follow_up fu
             JOIN procedures pr ON pr.id = fu.procedure_id
             JOIN patients pat ON pat.id = pr.patient_id
             WHERE fu.id = $1`, [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Follow-up not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /api/followup
router.post('/', async (req: Request, res: Response) => {
    try {
        const {
            procedure_id, visit_date, months_from_procedure,
            vital_status, death_date, cause_of_death, death_related_to_procedure,
            ambulatory_status,
            imaging_performed, imaging_type, max_sac_diameter_mm, sac_change,
            endoleak_present, endoleak_type,
            reintervention, reintervention_date, reintervention_type,
            notes
        } = req.body;

        const result = await pool.query(
            `INSERT INTO follow_up (
                procedure_id, visit_date, months_from_procedure,
                vital_status, death_date, cause_of_death, death_related_to_procedure,
                ambulatory_status,
                imaging_performed, imaging_type, max_sac_diameter_mm, sac_change,
                endoleak_present, endoleak_type,
                reintervention, reintervention_date, reintervention_type,
                notes
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            RETURNING *`,
            [
                procedure_id, visit_date, months_from_procedure,
                vital_status, death_date, cause_of_death, death_related_to_procedure,
                ambulatory_status,
                imaging_performed, imaging_type, max_sac_diameter_mm, sac_change,
                endoleak_present, endoleak_type,
                reintervention, reintervention_date, reintervention_type,
                notes
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// PUT /api/followup/:id
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            visit_date, months_from_procedure,
            vital_status, death_date, cause_of_death, death_related_to_procedure,
            ambulatory_status,
            imaging_performed, imaging_type, max_sac_diameter_mm, sac_change,
            endoleak_present, endoleak_type,
            reintervention, reintervention_date, reintervention_type,
            notes
        } = req.body;

        const result = await pool.query(
            `UPDATE follow_up SET
                visit_date=$1, months_from_procedure=$2,
                vital_status=$3, death_date=$4, cause_of_death=$5, death_related_to_procedure=$6,
                ambulatory_status=$7,
                imaging_performed=$8, imaging_type=$9, max_sac_diameter_mm=$10, sac_change=$11,
                endoleak_present=$12, endoleak_type=$13,
                reintervention=$14, reintervention_date=$15, reintervention_type=$16,
                notes=$17
             WHERE id=$18 RETURNING *`,
            [
                visit_date, months_from_procedure,
                vital_status, death_date, cause_of_death, death_related_to_procedure,
                ambulatory_status,
                imaging_performed, imaging_type, max_sac_diameter_mm, sac_change,
                endoleak_present, endoleak_type,
                reintervention, reintervention_date, reintervention_type,
                notes, id
            ]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Follow-up not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE /api/followup/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('DELETE FROM follow_up WHERE id=$1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Follow-up not found' });
        res.json({ message: 'Follow-up deleted', id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
