const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');

// Kiểm tra VAPID keys trước khi sử dụng
const vapidDetails = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: 'mailto:' + (process.env.VAPID_MAILTO || 'example@yourdomain.com')
};

// Kiểm tra xem các keys đã được cung cấp chưa
if (!vapidDetails.publicKey || !vapidDetails.privateKey) {
  console.error('VAPID Keys are missing! Web Push will not work properly.');
  console.error('Please run "node vapid-keys.js" and copy the keys to your .env file');
} else {
  // Cấu hình web-push chỉ khi có đầy đủ keys
  try {
    webpush.setVapidDetails(
      vapidDetails.subject,
      vapidDetails.publicKey,
      vapidDetails.privateKey
    );
    console.log('Web Push configured successfully with VAPID keys');
  } catch (error) {
    console.error('Error configuring Web Push:', error.message);
  }
}

// Đăng ký thiết bị cho push notification
router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Thông tin đăng ký không hợp lệ' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Lưu thông tin đăng ký push vào user
    user.pushSubscription = subscription;
    await user.save();

    // Kiểm tra keys trước khi gửi thông báo
    if (!vapidDetails.publicKey || !vapidDetails.privateKey) {
      return res.status(500).json({ 
        message: 'Server không cấu hình VAPID keys cho Web Push',
        requireSetup: true 
      });
    }

    // Gửi thông báo test
    const payload = JSON.stringify({
      title: 'Thông báo từ Anki Vocab',
      body: 'Bạn đã đăng ký nhận thông báo thành công!',
      icon: '/logo192.png'
    });

    await webpush.sendNotification(subscription, payload);
    
    res.status(201).json({ 
      message: 'Đăng ký nhận thông báo thành công',
      publicKey: process.env.VAPID_PUBLIC_KEY
    });
  } catch (error) {
    console.error('Push notification error:', error);
    res.status(500).json({ message: 'Lỗi server khi đăng ký thông báo' });
  }
});

// Cập nhật cài đặt thông báo
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const { enabled, dailyReminder, reminderTime } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Cập nhật thông tin cài đặt thông báo
    user.notifications = {
      enabled: enabled !== undefined ? enabled : user.notifications?.enabled,
      dailyReminder: dailyReminder !== undefined ? dailyReminder : user.notifications?.dailyReminder,
      reminderTime: reminderTime || user.notifications?.reminderTime
    };

    await user.save();
    res.json({ message: 'Cập nhật cài đặt thông báo thành công', notifications: user.notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật cài đặt thông báo' });
  }
});

// Gửi thông báo nhắc học từ tới người dùng cụ thể
router.post('/send-reminder', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user || !user.pushSubscription || !user.notifications?.enabled) {
      return res.status(400).json({ message: 'Người dùng chưa đăng ký nhận thông báo' });
    }

    // Kiểm tra keys trước khi gửi thông báo
    if (!vapidDetails.publicKey || !vapidDetails.privateKey) {
      return res.status(500).json({ 
        message: 'Server không cấu hình VAPID keys cho Web Push',
        requireSetup: true 
      });
    }

    const payload = JSON.stringify({
      title: 'Nhắc nhở học từ vựng',
      body: 'Đã đến giờ ôn tập từ vựng hôm nay rồi!',
      icon: '/logo192.png',
      data: {
        url: '/study'
      }
    });

    await webpush.sendNotification(user.pushSubscription, payload);
    res.json({ message: 'Đã gửi thông báo thành công' });
  } catch (error) {
    console.error('Push notification error:', error);
    if (error.statusCode === 410) {
      // Subscription đã hết hạn hoặc không hợp lệ
      try {
        // Xóa subscription khỏi user
        await User.findByIdAndUpdate(req.user.id, { $unset: { pushSubscription: 1 } });
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
      return res.status(410).json({ message: 'Subscription không còn hợp lệ, cần đăng ký lại' });
    }
    res.status(500).json({ message: 'Lỗi khi gửi thông báo' });
  }
});

module.exports = router; 