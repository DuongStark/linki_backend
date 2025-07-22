const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // Đã hash
  createdAt: { type: Date, default: Date.now },
  pushSubscription: {
    endpoint: String,
    keys: {
      p256dh: String,
      auth: String
    }
  },
  notifications: {
    enabled: { type: Boolean, default: true },
    dailyReminder: { type: Boolean, default: true },
    reminderTime: { type: String, default: '20:00' } // Định dạng HH:MM
  }
});

module.exports = mongoose.model('User', userSchema); 