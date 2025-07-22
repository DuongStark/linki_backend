const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected')).catch(console.error);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vocab', require('./routes/vocab'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/tts', require('./routes/tts'));

app.get('/', (req, res) => {
  res.send('API is running');
});

module.exports = app; 