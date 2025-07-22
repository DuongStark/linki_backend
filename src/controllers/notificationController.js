const webpush = require('web-push');
const User = require('../models/User');
const VocabCard = require('../models/VocabCard');

// Hàm kiểm tra VAPID keys hợp lệ
const checkVapidKeys = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  
  if (!publicKey || !privateKey) {
    console.error('VAPID Keys are missing! Web Push will not work properly.');
    return false;
  }
  
  return true;
};

// Hàm gửi thông báo đến một user
const sendNotification = async (user, payload) => {
  try {
    if (!user.pushSubscription || !user.notifications?.enabled) {
      return { success: false, message: 'User không có push subscription hoặc đã tắt thông báo' };
    }
    
    // Kiểm tra VAPID keys
    if (!checkVapidKeys()) {
      return { success: false, message: 'Server không cấu hình VAPID keys cho Web Push' };
    }

    await webpush.sendNotification(user.pushSubscription, JSON.stringify(payload));
    return { success: true };
  } catch (error) {
    console.error('Send notification error:', error);
    
    // Nếu subscription không hợp lệ, xóa nó khỏi user
    if (error.statusCode === 410) {
      try {
        await User.findByIdAndUpdate(user._id, { $unset: { pushSubscription: 1 } });
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }
    
    return { success: false, error };
  }
};

// Gửi thông báo nhắc học hàng ngày
const sendDailyReminders = async () => {
  try {
    // Kiểm tra VAPID keys
    if (!checkVapidKeys()) {
      return { error: 'VAPID keys không hợp lệ hoặc không được cấu hình' };
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Tìm các user có bật thông báo nhắc nhở hàng ngày và đến giờ nhắc
    const users = await User.find({
      'notifications.enabled': true,
      'notifications.dailyReminder': true,
      'pushSubscription': { $exists: true }
    });
    
    // Lọc users theo thời gian nhắc
    const usersToNotify = users.filter(user => {
      if (!user.notifications?.reminderTime) return false;
      
      const [hour, minute] = user.notifications.reminderTime.split(':').map(Number);
      return hour === currentHour && Math.abs(minute - currentMinute) < 5; // Trong khoảng 5 phút
    });
    
    console.log(`Found ${usersToNotify.length} users to send reminders`);
    
    // Gửi thông báo cho từng user
    const results = await Promise.all(usersToNotify.map(async (user) => {
      // Đếm số từ cần học hôm nay
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const dueCards = await VocabCard.countDocuments({
        user: user._id,
        'srs.dueDate': { $gte: today, $lt: tomorrow }
      });
      
      // Thêm từ quá hạn
      const overdueCards = await VocabCard.countDocuments({
        user: user._id,
        'srs.dueDate': { $lt: today },
        'reviewHistory.0': { $exists: true }
      });
      
      const totalDue = dueCards + overdueCards;
      
      // Tạo nội dung thông báo
      const payload = {
        title: 'Nhắc nhở học từ vựng',
        body: totalDue > 0 
          ? `Bạn có ${totalDue} từ cần ôn tập hôm nay!` 
          : 'Hãy học thêm từ mới hôm nay!',
        icon: '/logo192.png',
        data: {
          url: '/study'
        }
      };
      
      return sendNotification(user, payload);
    }));
    
    return {
      total: usersToNotify.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
  } catch (error) {
    console.error('Send daily reminders error:', error);
    return { error: error.message };
  }
};

module.exports = {
  sendNotification,
  sendDailyReminders
}; 