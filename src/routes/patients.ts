import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET /api/patients  – list all (with search)
router.get('/', async (req: Request, res: Response) => {
    try {
        const { search, center_id } = req.query;
        let query = `
            SELECT p.*, c.name AS center_name,
                   COUNT(DISTINCT pr.id) AS procedure_count
            FROM patients p
            LEFT JOIN centers c ON p.center_id = c.id
            LEFT JOIN procedures pr ON pr.patient_id = p.id
        `;
        const params: any[] = [];
        const conditions: string[] = [];

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(p.first_name ILIKE $${params.length} OR p.last_name ILIKE $${params.length} OR p.mrn ILIKE $${params.length})`);
        }
        if (center_id) {
            params.push(center_id);
            conditions.push(`p.center_id = $${params.length}`);
        }

        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
        query += ' GROUP BY p.id, c.name ORDER BY p.last_name, p.first_name';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /api/patients/:id  – single patient with procedures
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const patient = await pool.query(
            `SELECT p.*, c.name AS center_name
             FROM patients p
             LEFT JOIN centers c ON p.center_id = c.id
             WHERE p.id = $1`, [id]
        );
        if (patient.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });

        const procs = await pool.query(
            `SELECT pr.*, aaa.repair_type, aaa.max_aaa_diameter_mm, aaa.symptom_status
             FROM procedures pr
             LEFT JOIN procedure_aaa aaa ON aaa.procedure_id = pr.id
             WHERE pr.patient_id = $1
             ORDER BY pr.procedure_date DESC`, [id]
        );

        res.json({ ...patient.rows[0], procedures: procs.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /api/patients  – create patient
router.post('/', async (req: Request, res: Response) => {
    try {
        const {
            mrn, first_name, last_name, date_of_birth, sex, race, ethnicity,
            address, city, state, zip, phone, center_id
        } = req.body;

        const result = await pool.query(
            `INSERT INTO patients
             (mrn, first_name, last_name, date_of_birth, sex, race, ethnicity,
              address, city, state, zip, phone, center_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING *`,
            [mrn, first_name, last_name, date_of_birth, sex, race, ethnicity,
             address, city, state, zip, phone, center_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// PUT /api/patients/:id  – update patient
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            mrn, first_name, last_name, date_of_birth, sex, race, ethnicity,
            address, city, state, zip, phone, center_id
        } = req.body;

        const result = await pool.query(
            `UPDATE patients SET
             mrn=$1, first_name=$2, last_name=$3, date_of_birth=$4,
             sex=$5, race=$6, ethnicity=$7, address=$8, city=$9, state=$10,
             zip=$11, phone=$12, center_id=$13, updated_at=CURRENT_TIMESTAMP
             WHERE id=$14 RETURNING *`,
            [mrn, first_name, last_name, date_of_birth, sex, race, ethnicity,
             address, city, state, zip, phone, center_id, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE /api/patients/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM patients WHERE id=$1 RETURNING id', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
        res.json({ message: 'Patient deleted', id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
