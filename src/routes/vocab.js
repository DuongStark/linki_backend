const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const SharedVocabCard = require('../models/SharedVocabCard');
const UserVocabProgress = require('../models/UserVocabProgress');
const Deck = require('../models/Deck');
const { DailyStudyQueue } = require('../models/UserVocabProgress');

// Lấy danh sách deck user có quyền truy cập (deck mẫu + deck cá nhân)
router.get('/decks', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  // Deck mẫu (shared) hoặc deck cá nhân của user
  const decks = await Deck.find({ $or: [ { type: 'shared' }, { type: 'personal', owner: userId } ] });
  res.json(decks);
});

// Lấy thông tin chi tiết 1 deck
router.get('/decks/:deckId', authMiddleware, async (req, res) => {
  const deckId = req.params.deckId;
  const deck = await Deck.findById(deckId);
  if (!deck) return res.status(404).json({ message: 'Deck not found' });
  res.json(deck);
});

// Import toàn bộ từ của deck mẫu vào tiến trình học của user
router.post('/decks/import/:deckId', authMiddleware, async (req, res) => {
  try {
    const deckId = req.params.deckId;
    const userId = req.user.id;
    // Debug log
    console.log('Import deckId:', deckId);
    // Lấy toàn bộ từ mẫu trong deck
    const sharedCards = await SharedVocabCard.find({ deck: deckId });
    console.log('Found sharedCards:', sharedCards.length);
    if (sharedCards.length > 0) {
      console.log('SharedCard IDs:', sharedCards.map(card => card._id.toString()));
    }
    // Lấy toàn bộ tiến trình học đã có của user với deck này
    const existing = await UserVocabProgress.find({ user: userId, deck: deckId }).select('vocab');
    const existingVocabIds = new Set(existing.map(e => e.vocab.toString()));
    // Lọc các từ chưa có tiến trình học
    const toInsert = sharedCards
      .filter(card => !existingVocabIds.has(card._id.toString()))
      .map(card => ({
        user: userId,
        vocab: card._id,
        deck: deckId
      }));
    console.log('To insert:', toInsert.length);
    if (toInsert.length > 0) {
      await UserVocabProgress.insertMany(toInsert);
    }
    res.json({ message: `Đã import ${toInsert.length} từ vào tiến trình học của bạn.` });
  } catch (err) {
    console.error('Import deck error:', err);
    res.status(500).json({ message: 'Lỗi khi import bộ từ.' });
  }
});

// Lấy danh sách tiến trình học của user với deck này (join sang từ mẫu)
router.get('/decks/:deckId/progress', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const deckId = req.params.deckId;
  const progresses = await UserVocabProgress.find({ user: userId, deck: deckId }).populate('vocab');
  const result = progresses.map(p => ({
    _id: p._id,
    word: p.vocab.word,
    meaning: p.vocab.meaning,
    example: p.vocab.example,
    phonetic: p.vocab.phonetic,
    audio: p.vocab.audio,
    image: p.vocab.image,
    tags: p.vocab.tags,
    definition: p.vocab.definition,
    pos: p.vocab.pos,
    srs: p.srs,
    reviewHistory: p.reviewHistory,
    vocabId: p.vocab._id,
    deck: p.deck,
  }));
  res.json(result);
});

// Lấy danh sách từ vựng của deck (dùng cho deck mẫu, không join tiến trình học)
router.get('/decks/:deckId/vocab', authMiddleware, async (req, res) => {
  const deckId = req.params.deckId;
  const cards = await SharedVocabCard.find({ deck: deckId });
  res.json(cards);
});

// Lấy danh sách từ cần học hôm nay trong deck (theo quota, SRS, dueDate, và daily queue)
router.get('/decks/:deckId/due', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const deckId = req.params.deckId;
  const now = new Date();
  const today = now.toISOString().slice(0, 10); // yyyy-mm-dd
  const MAX_NEW = 20;
  const MAX_REVIEW = 100;

  // Nếu chỉ lấy số lượng (count), trả về nhanh cho dashboard
  if (req.query.count === 'true') {
    const queue = await DailyStudyQueue.findOne({ user: userId, deck: deckId, date: today });
    if (queue) return res.json({ count: queue.cardIds.length });
    // Nếu chưa có queue, sinh mới như dưới nhưng chỉ trả về count
    const allProgress = await UserVocabProgress.find({ user: userId, deck: deckId })
      .select('srs.state srs.dueDate');
    const reviewCards = allProgress.filter(card => card.srs.state === 'review' && new Date(card.srs.dueDate) <= now);
    const newCards = allProgress.filter(card => card.srs.state === 'new');
    const count = Math.min(reviewCards.length, MAX_REVIEW) + Math.min(newCards.length, MAX_NEW);
    return res.json({ count });
  }

  // 1. Kiểm tra đã có queue cho hôm nay chưa
  let queue = await DailyStudyQueue.findOne({ user: userId, deck: deckId, date: today });
  if (!queue) {
    // 2. Nếu chưa có, sinh mới queue cho hôm nay
    const allProgress = await UserVocabProgress.find({ user: userId, deck: deckId })
      .populate('vocab', 'word meaning example phonetic audio image tags');
    // Review cards đến hạn
    let reviewCards = allProgress.filter(card => card.srs.state === 'review' && new Date(card.srs.dueDate) <= now);
    reviewCards = shuffleArray(reviewCards).slice(0, MAX_REVIEW);
    // New cards (chưa học)
    let newCards = allProgress.filter(card => card.srs.state === 'new');
    // Lấy đủ quota từ mới để tổng số thẻ đúng quota (ưu tiên review trước)
    newCards = shuffleArray(newCards).slice(0, Math.max(0, MAX_NEW - reviewCards.length));
    // Chốt danh sách cho hôm nay: review trước, còn quota thì lấy thêm new
    const cards = [...reviewCards, ...newCards];
    const cardIds = cards.map(c => c._id);
    queue = await DailyStudyQueue.create({ user: userId, deck: deckId, date: today, cardIds });
  } else {
    // Nếu queue rỗng (do tạo trước khi import), bổ sung quota từ mới
    if (queue.cardIds.length === 0) {
      // Chỉ bổ sung quota từ mới nếu queue vừa được tạo (trong vòng 1 phút gần đây)
      const nowTime = new Date();
      const queueCreated = new Date(queue.createdAt || queue.date);
      const diffMs = nowTime - queueCreated;
      if (diffMs < 60 * 1000) { // 1 phút
        const allProgress = await UserVocabProgress.find({ user: userId, deck: deckId });
        let reviewCards = allProgress.filter(card => card.srs.state === 'review' && new Date(card.srs.dueDate) <= now);
        reviewCards = shuffleArray(reviewCards).slice(0, MAX_REVIEW);
        let newCards = allProgress.filter(card => card.srs.state === 'new');
        newCards = shuffleArray(newCards).slice(0, Math.max(0, MAX_NEW - reviewCards.length));
        const cards = [...reviewCards, ...newCards];
        queue.cardIds = cards.map(c => c._id);
        await queue.save();
      }
      // Nếu queue đã tồn tại lâu (user đã học hết), không bổ sung nữa
    } else {
      // Bổ sung thẻ review/learning đến hạn nếu có
      const dueNow = await UserVocabProgress.find({
        user: userId,
        deck: deckId,
        _id: { $nin: queue.cardIds },
        $or: [
          { 'srs.state': 'learning', 'srs.dueDate': { $lte: now } },
          { 'srs.state': 'review', 'srs.dueDate': { $lte: now } }
        ]
      }).select('_id');
      if (dueNow.length > 0) {
        queue.cardIds.push(...dueNow.map(c => c._id));
        await queue.save();
      }
    }
  }
  // 3. Lấy chi tiết các thẻ trong queue (chỉ populate trường cần thiết)
  let cards = await UserVocabProgress.find({ _id: { $in: queue.cardIds } })
    .populate('vocab', 'word meaning example phonetic tags image definition pos');
  // Lọc chỉ trả về các thẻ còn đến hạn trong ngày
  let filteredCards = cards.filter(card =>
    card.srs.state === 'new' ||
    (card.srs.state === 'learning' && new Date(card.srs.dueDate) <= now) ||
    (card.srs.state === 'review' && new Date(card.srs.dueDate) <= now)
  );
  // Nếu không còn review/new đến hạn, trả về toàn bộ thẻ learning (bất kể dueDate)
  if (filteredCards.length === 0) {
    // Lấy toàn bộ thẻ learning chưa đến hạn (bất kể dueDate)
    const allLearning = cards.filter(card => card.srs.state === 'learning');
    if (allLearning.length > 0) {
      filteredCards = allLearning;
    }
  }
  // Trộn random các loại thẻ (learning, new, review) nếu có đủ 2 loại trở lên
  const learning = filteredCards.filter(c => c.srs.state === 'learning');
  const review = filteredCards.filter(c => c.srs.state === 'review');
  const newCards = filteredCards.filter(c => c.srs.state === 'new');
  let mixed = [];
  if ((learning.length + review.length + newCards.length) > 1) {
    // Trộn đều các loại, ưu tiên learning xuất hiện nhiều hơn một chút
    let pools = [learning, newCards, review].filter(arr => arr.length > 0);
    let maxLen = Math.max(...pools.map(arr => arr.length));
    for (let i = 0; i < maxLen; i++) {
      for (let arr of pools) {
        if (arr[i]) mixed.push(arr[i]);
      }
    }
    // Xáo trộn nhẹ để tránh lặp pattern
    mixed = shuffleArray(mixed);
    filteredCards = mixed;
  }
  // KHÔNG random lại quota từ mới nếu đã có queue, chỉ lấy các thẻ đến hạn thực sự
  const mapCard = (p) => ({
    _id: p._id,
    word: p.vocab?.word,
    meaning: p.vocab?.meaning,
    example: p.vocab?.example,
    phonetic: p.vocab?.phonetic,
    audio: p.vocab?.audio,
    image: p.vocab?.image,
    tags: p.vocab?.tags,
    definition: p.vocab?.definition,
    pos: p.vocab?.pos,
    srs: p.srs,
    vocabId: p.vocab?._id,
    deck: p.deck,
  });
  res.json(filteredCards.map(mapCard));
});

// Đánh giá SRS cho từ (review) - cho UserVocabProgress
router.post('/progress/:id/review', authMiddleware, async (req, res) => {
  const { grade } = req.body;
  let card = await UserVocabProgress.findOne({ _id: req.params.id, user: req.user.id });
  if (!card) return res.status(404).json({ message: 'Not found' });
  require('../srs/sm2')(card, grade);
  await card.save();
  res.json(card);
});

// API đếm số lượng thẻ learning trong deck cho user
router.get('/decks/:deckId/learning-count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const deckId = req.params.deckId;
    const count = await UserVocabProgress.countDocuments({ user: userId, deck: deckId, 'srs.state': 'learning' });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi đếm thẻ learning.' });
  }
});

// Hàm xáo trộn mảng (Fisher-Yates)
function shuffleArray(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = router; 