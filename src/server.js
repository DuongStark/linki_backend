const app = require('./app');
const webpush = require('web-push');
const { sendDailyReminders } = require('./controllers/notificationController');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Kiểm tra và cấu hình web-push
  const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: 'mailto:' + (process.env.VAPID_MAILTO || 'example@yourdomain.com')
  };

  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    console.warn('\x1b[33m%s\x1b[0m', 
      'WARNING: VAPID keys not found in environment variables. Web Push will not work.'
    );
    console.warn('\x1b[33m%s\x1b[0m',
      'Run "node vapid-keys.js" to generate keys and add them to your .env file.'
    );
  } else {
    try {
      webpush.setVapidDetails(
        vapidKeys.subject,
        vapidKeys.publicKey,
        vapidKeys.privateKey
      );
      console.log('Web Push configured successfully with VAPID keys.');
      
      // Bắt đầu scheduler thông báo tự động
      startNotificationScheduler();
    } catch (error) {
      console.error('\x1b[31m%s\x1b[0m', 'Error configuring Web Push:', error.message);
      console.warn('\x1b[33m%s\x1b[0m', 
        'Notification scheduler will not be started. Please check your VAPID keys.'
      );
    }
  }
});

// Hàm khởi động scheduler
const startNotificationScheduler = () => {
  console.log('Notification scheduler started within main server process');
  
  // Chạy mỗi 5 phút
  setInterval(async () => {
    try {
      console.log('Running notification check:', new Date().toISOString());
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