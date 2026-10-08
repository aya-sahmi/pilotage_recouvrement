require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const dashboardRoutes = require('./routes/dashboard.routes');
const performanceRoutes = require('./routes/performance.routes');
const portefeuilleRoutes = require('./routes/portefeuille.routes');
const appelsRoutes = require('./routes/appels.routes');
const gestionnairesRoutes = require('./routes/gestionnaires.routes');
const importsRoutes = require('./routes/imports.routes');
const classementRoutes = require('./routes/classement.routes');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/portefeuille', portefeuilleRoutes);
app.use('/api/3cx', appelsRoutes);
app.use('/api/gestionnaires', gestionnairesRoutes);
app.use('/api/imports', importsRoutes);
app.use('/api/classement', classementRoutes);
app.use('/api/controle', require('./routes/controle.routes'));

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
