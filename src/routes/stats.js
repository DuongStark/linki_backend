const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const VocabCard = require('../models/VocabCard');

// Lấy thống kê tổng quan
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Tổng số từ
    const totalCards = await VocabCard.countDocuments({ user: userId });
    
    // Số từ đã học (đã review ít nhất 1 lần)
    const studiedCards = await VocabCard.countDocuments({ 
      user: userId,
      'reviewHistory.0': { $exists: true } 
    });
    
    // Số từ đã thuộc (SRS interval > 21 ngày ~ khoảng 3 tuần)
    const masteredCards = await VocabCard.countDocuments({ 
      user: userId,
      'srs.interval': { $gt: 21 }
    });
    
    // Số từ đến hạn hôm nay
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dueToday = await VocabCard.countDocuments({
      user: userId,
      'srs.dueDate': { $gte: today, $lt: tomorrow }
    });
    
    // Số từ quá hạn
    const overdue = await VocabCard.countDocuments({
      user: userId,
      'srs.dueDate': { $lt: today },
      'reviewHistory.0': { $exists: true }
    });

    res.json({
      total: totalCards,
      studied: studiedCards,
      mastered: masteredCards,
      dueToday: dueToday,
      overdue: overdue,
      new: totalCards - studiedCards
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Lấy thống kê học tập theo ngày (7 ngày gần nhất)
router.get('/daily', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Lấy tất cả review trong 7 ngày qua
    const cards = await VocabCard.find({
      user: userId,
      'reviewHistory.date': { $gte: sevenDaysAgo }
    });

    // Tạo map thống kê theo ngày
    const dailyStats = {};
    
    // Khởi tạo các ngày trong 7 ngày qua
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyStats[dateStr] = { reviewCount: 0, newCards: 0 };
    }
    
    // Lấp đầy dữ liệu
    cards.forEach(card => {
      card.reviewHistory.forEach(review => {
        if (review.date >= sevenDaysAgo) {
          const dateStr = review.date.toISOString().split('T')[0];
          if (dailyStats[dateStr]) {
            dailyStats[dateStr].reviewCount++;
            // Nếu đây là lần review đầu tiên của từ này, tăng newCards
            if (card.reviewHistory.length === 1 && 
                card.reviewHistory[0].date.toISOString().split('T')[0] === dateStr) {
              dailyStats[dateStr].newCards++;
            }
          }
        }
      });
    });
    
    // Chuyển thành mảng để dễ sử dụng ở frontend
    const result = Object.keys(dailyStats).map(date => ({
      date,
      reviewCount: dailyStats[date].reviewCount,
      newCards: dailyStats[date].newCards
    }));
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router; 