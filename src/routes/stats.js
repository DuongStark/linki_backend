const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const SharedVocabCard = require('../models/SharedVocabCard');
const UserVocabProgress = require('../models/UserVocabProgress');

// Lấy thống kê tổng quan tối ưu cho dashboard (chỉ trả về count, không lấy toàn bộ tiến trình học)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const total = await SharedVocabCard.countDocuments();
    const studied = await UserVocabProgress.countDocuments({ user: userId });
    const mastered = await UserVocabProgress.countDocuments({ user: userId, 'srs.interval': { $gt: 21 } });
    const now = new Date();
    const dueToday = await UserVocabProgress.countDocuments({ user: userId, 'srs.state': 'review', 'srs.dueDate': { $lte: now } });
    // Số đã học hôm nay: reviewHistory có entry date là hôm nay
    const todayStr = now.toISOString().slice(0, 10);
    const learnedToday = await UserVocabProgress.countDocuments({
      user: userId,
      reviewHistory: { $elemMatch: { date: { $gte: new Date(todayStr), $lt: new Date(new Date(todayStr).getTime() + 24*60*60*1000) } } }
    });
    res.json({
      total,
      studied,
      mastered,
      dueToday,
      learnedToday
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Lấy thống kê học tập theo ngày (7 ngày gần nhất)
router.get('/daily', authMiddleware, async (req, res) => {
  try {
    // Để trống hoặc trả về mảng rỗng nếu chưa cần
    res.json([]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router; 