const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const VocabCard = require('../models/VocabCard');
const sm2 = require('../srs/sm2');

// Tạo từ mới
router.post('/', authMiddleware, async (req, res) => {
  const { word, meaning, example, audio, phonetic } = req.body;
  const card = new VocabCard({ user: req.user.id, word, meaning, example, audio, phonetic });
  await card.save();
  res.status(201).json(card);
});

// Lấy tất cả từ của user hoặc chỉ các từ đến hạn nếu có dueDate
router.get('/', authMiddleware, async (req, res) => {
  const { dueDate } = req.query;
  let query = { user: req.user.id };
  if (dueDate) {
    // Lấy các từ có srs.dueDate <= dueDate (tức là đến hạn hoặc quá hạn)
    const endOfDay = new Date(dueDate);
    endOfDay.setHours(23, 59, 59, 999);
    query['srs.dueDate'] = { $lte: endOfDay };
  }
  const cards = await VocabCard.find(query);
  res.json(cards);
});

// Update từ
router.put('/:id', authMiddleware, async (req, res) => {
  const card = await VocabCard.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    req.body,
    { new: true }
  );
  res.json(card);
});

// Xoá từ
router.delete('/:id', authMiddleware, async (req, res) => {
  await VocabCard.deleteOne({ _id: req.params.id, user: req.user.id });
  res.json({ success: true });
});

// Đánh giá SRS cho từ (review)
router.post('/:id/review', authMiddleware, async (req, res) => {
  const { grade } = req.body;
  const card = await VocabCard.findOne({ _id: req.params.id, user: req.user.id });
  if (!card) return res.status(404).json({ message: 'Not found' });
  sm2(card, grade);
  await card.save();
  res.json(card);
});

module.exports = router; 