import express from 'express';
import path from 'path';
const router = express.Router();

const publicDir = path.join(__dirname, '../../public');

router.get('/theme.css', (req, res) => {
  res.type('text/css').sendFile(path.join(publicDir, 'theme.css'));
});

router.get('/stock/stock.css', (req, res) => {
  res.type('text/css').sendFile(path.join(publicDir, 'stock', 'stock.css'));
});

router.get('/stock/stock.js', (req, res) => {
  res.type('application/javascript').sendFile(path.join(publicDir, 'stock', 'stock.js'));
});

router.get('/stock/logo.svg', (req, res) => {
  res.type('image/svg+xml').sendFile(path.join(publicDir, 'stock', 'logo.svg'));
});

router.get('/stock/motion.svg', (req, res) => {
  res.type('image/svg+xml').sendFile(path.join(publicDir, 'stock', 'motion.svg'));
});

router.get('/stock/motion.mp4', (req, res) => {
  res.type('video/mp4').sendFile(path.join(publicDir, 'stock', 'motion.mp4'));
});

router.get('/stock/motion.gif', (req, res) => {
  res.type('image/gif').sendFile(path.join(publicDir, 'stock', 'motion.gif'));
});

export default router;
