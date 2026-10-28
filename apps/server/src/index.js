import express from 'express';
import helmet from 'helmet';
const app = express();
app.use(helmet());
app.use(express.json());
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});
const port = process.env.PORT || 4318;
app.listen(port, () => {
    console.log(`Server running on http://127.0.0.1:${port}`);
});
