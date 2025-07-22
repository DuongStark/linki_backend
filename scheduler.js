const dotenv = require('dotenv');
const mongoose = require('mongoose');
const webpush = require('web-push');
const { sendDailyReminders } = require('./src/controllers/notificationController');

// Load env variables
dotenv.config();

// Cấu hình web-push
webpush.setVapidDetails(
  'mailto:' + process.env.VAPID_MAILTO || 'example@yourdomain.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
  startScheduler();
}).catch(err => {
  console.error('Database connection error:', err);
  process.exit(1);
});

// Hàm chạy định kỳ để gửi thông báo
const startScheduler = () => {
  console.log('Notification scheduler started');
  
  // Chạy mỗi 5 phút
  setInterval(async () => {
    console.log('Checking for notifications to send...');
    try {
      const result = await sendDailyReminders();
      console.log('Notification check result:', result);
    } catch (error) {
      console.error('Error in notification scheduler:', error);
    }
  }, 5 * 60 * 1000); // 5 phút
  
  // Chạy ngay khi khởi động
  sendDailyReminders().then(result => {
    console.log('Initial notification check result:', result);
  }).catch(error => {
    console.error('Error in initial notification check:', error);
  });
};

// Xử lý thoát gracefully
process.on('SIGINT', () => {
  console.log('Shutting down notification scheduler');
  mongoose.disconnect();
  process.exit(0);
});

// Chạy lệnh: node scheduler.js
// Trong production nên dùng PM2 hoặc tương tự để đảm bảo luôn chạy 