import express from 'express';
import cors from 'cors';
import path from 'path';
import pool from './db';
import patientRoutes from './routes/patients';
import procedureRoutes from './routes/procedures';
import followupRoutes from './routes/followup';
import statsRoutes from './routes/stats';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── API Routes ──────────────────────────────────────
app.use('/api/patients', patientRoutes);
app.use('/api/procedures', procedureRoutes);
app.use('/api/followup', followupRoutes);
app.use('/api/stats', statsRoutes);

// Centers list (convenience)
app.get('/api/centers', async (_req, res) => {
    try {
        const result = await pool.query('SELECT * FROM centers ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Health check
app.get('/api/health', async (_req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch {
        res.status(503).json({ status: 'error', database: 'disconnected' });
    }
});

// SPA fallback – serve frontend for all non-API routes
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Vascular Registry API running on port ${PORT}`);
});

export default app;
