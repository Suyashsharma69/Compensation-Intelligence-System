// Load environment variables from .env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const prisma = new PrismaClient();

// Create Express app
const app = express();

// Middleware
app.use(cors());          // allow cross-origin requests
app.use(express.json());  // parse JSON request bodies

// Helper: normalize company name (lowercase, trim)
function normalizeCompany(name) {
  return name.trim().toLowerCase();
}

// ---------- API Endpoints ----------

// 1. POST /ingest-salary - add a new salary record
app.post('/ingest-salary', async (req, res) => {
  try {
    // Extract fields from request body
    let {
      company,
      role,
      level_standardized,
      location,
      experience_years,
      base_salary,
      bonus,
      stock,
      confidence,
    } = req.body;

    // ---- Validation ----
    if (!company || !role || !level_standardized || !location || experience_years === undefined || !base_salary) {
      return res.status(400).json({ error: 'Missing required fields: company, role, level_standardized, location, experience_years, base_salary' });
    }

    // Level must be L3, L4, or L5
    if (!['L3', 'L4', 'L5'].includes(level_standardized)) {
      return res.status(400).json({ error: 'level_standardized must be L3, L4, or L5' });
    }

    // Normalize company
    company = normalizeCompany(company);

    // Default missing bonus/stock to 0
    const bonusVal = bonus ? parseFloat(bonus) : 0;
    const stockVal = stock ? parseFloat(stock) : 0;
    const base = parseFloat(base_salary);
    const total = base + bonusVal + stockVal;
    const confidenceScore = confidence ? parseFloat(confidence) : 1.0;

    // Create record in database
    const salary = await prisma.salary.create({
      data: {
        company,
        role,
        level_standardized,
        location,
        experience_years: parseInt(experience_years),
        base_salary: base,
        bonus: bonusVal,
        stock: stockVal,
        total_compensation: total,
        confidence_score: confidenceScore,
      },
    });

    res.json(salary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. GET /salaries - list with filtering & sorting
app.get('/salaries', async (req, res) => {
  try {
    const { company, role, level, location, sortBy = 'total_compensation', order = 'desc' } = req.query;

    // Build filter object
    const where = {};
    if (company) where.company = normalizeCompany(company);
    if (role) where.role = role;
    if (level) where.level_standardized = level;
    if (location) where.location = location;

    // Sorting: order must be 'asc' or 'desc'
    const orderDirection = order === 'asc' ? 'asc' : 'desc';

    const salaries = await prisma.salary.findMany({
      where,
      orderBy: {
        [sortBy]: orderDirection,
      },
    });

    res.json(salaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. GET /company/:company - company overview
app.get('/company/:company', async (req, res) => {
  try {
    const companyName = normalizeCompany(req.params.company);
    const salaries = await prisma.salary.findMany({
      where: { company: companyName },
    });

    if (salaries.length === 0) {
      return res.json({ company: companyName, salaries: [], median: null, levelDistribution: {} });
    }

    // Calculate median total compensation
    const totals = salaries.map(s => s.total_compensation).sort((a, b) => a - b);
    const median = totals[Math.floor(totals.length / 2)];

    // Calculate level distribution
    const levelDist = {};
    for (const s of salaries) {
      levelDist[s.level_standardized] = (levelDist[s.level_standardized] || 0) + 1;
    }

    res.json({
      company: companyName,
      salaries,
      median,
      levelDistribution: levelDist,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. GET /compare?ids=1,2 - compare two salary records
app.get('/compare', async (req, res) => {
  try {
    const idsParam = req.query.ids;
    if (!idsParam) {
      return res.status(400).json({ error: 'Provide ids parameter like ?ids=1,2' });
    }
    const ids = idsParam.split(',').map(id => parseInt(id));
    if (ids.length !== 2) {
      return res.status(400).json({ error: 'You must provide exactly two ids' });
    }

    const salaries = await prisma.salary.findMany({
      where: { id: { in: ids } },
    });

    if (salaries.length !== 2) {
      return res.status(404).json({ error: 'One or both salary records not found' });
    }

    const [s1, s2] = salaries;

    res.json({
      salary1: {
        id: s1.id,
        company: s1.company,
        role: s1.role,
        level: s1.level_standardized,
        base: s1.base_salary,
        bonus: s1.bonus,
        stock: s1.stock,
        total: s1.total_compensation,
        location: s1.location,
        experience: s1.experience_years,
      },
      salary2: {
        id: s2.id,
        company: s2.company,
        role: s2.role,
        level: s2.level_standardized,
        base: s2.base_salary,
        bonus: s2.bonus,
        stock: s2.stock,
        total: s2.total_compensation,
        location: s2.location,
        experience: s2.experience_years,
      },
      levelDifference: `${s1.level_standardized} vs ${s2.level_standardized}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});