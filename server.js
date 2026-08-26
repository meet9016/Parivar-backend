const express = require('express');
const http = require('http');
const path = require('path');
require('dotenv').config();

const routes = require('./src/routes/index');
const connectDB = require('./src/config/database');
const socketManager = require('./src/config/socket');
connectDB();

const app = express();
const server = http.createServer(app);

socketManager.init(server);

const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With, Accept, Origin, x-tenant-id');

  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }

  return next();
});

// API Logging Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.get('/', (req, res) => {
  res.send('Parivar App Server is Running!');
});

app.post('/test', (req, res) => {
  res.status(200).json({
    status: 200,
    message: 'PARIVAR.APP API WORKING',
    data: []
  });
});

// Unified API Routes
const tenantMiddleware = require('./src/middleware/tenantMiddleware');
app.use('/api', tenantMiddleware, routes);

app.use((req, res) => {
  res.status(404).json({
    status: 404,
    message: 'Route not found',
    data: []
  });
});

app.use((error, req, res, next) => {
  if (error) {
    return res.status(400).json({
      status: 400,
      message: error.message,
      data: []
    });
  }

  return next();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`http://localhost:${PORT}`);
});


