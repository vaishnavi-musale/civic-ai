const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_ORIGIN,
  process.env.VITE_FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
const issuesRoutes = require('./routes/issues');
app.use('/api/issues', issuesRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

const aiRoutes = require('./routes/ai');
app.use('/api/ai', aiRoutes);

const profilesRoutes = require('./routes/profiles');
app.use('/api/profiles', profilesRoutes);

app.get('/api/auth', (req, res) => {
  res.json({ message: 'Auth route' });
});

app.get('/', (req, res) => {
  res.send('CivicAI Backend is running');
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
