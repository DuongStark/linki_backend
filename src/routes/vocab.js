const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const VocabCard = require('../models/VocabCard');
const sm2 = require('../srs/sm2');
const SharedVocabCard = require('../models/SharedVocabCard');
const UserVocabProgress = require('../models/UserVocabProgress');
const Deck = require('../models/Deck');
const { DailyStudyQueue } = require('../models/UserVocabProgress');

// Tạo từ mới
router.post('/', authMiddleware, async (req, res) => {
  const { word, meaning, example, audio, phonetic } = req.body;
  const card = new VocabCard({ user: req.user.id, word, meaning, example, audio, phonetic });
  await card.save();
  res.status(201).json(card);
});

// Lấy tất cả từ của user hoặc chỉ các từ đến hạn nếu có dueDate
router.get('/', authMiddleware, async (req, res) => {
  const { allDue } = req.query;
  const now = new Date();
  if (allDue === 'true') {
    // Trả về tất cả thẻ review đến hạn và thẻ mới, không giới hạn quota
    const reviewCards = await VocabCard.find({
      user: req.user.id,
      'srs.state': 'review',
      'srs.dueDate': { $lte: now }
    });
    const newCards = await VocabCard.find({
      user: req.user.id,
      'srs.state': 'new'
    });
    // Xáo trộn từng nhóm
    const cards = [...shuffleArray(reviewCards), ...shuffleArray(newCards)];
    return res.json(cards);
  }
  // Giới hạn mặc định
  const MAX_NEW = 20;
  const MAX_REVIEW = 100;
  // Lấy thẻ review đến hạn (ưu tiên)
  let reviewCards = await VocabCard.find({
    user: req.user.id,
    'srs.state': 'review',
    'srs.dueDate': { $lte: now }
  });
  reviewCards = shuffleArray(reviewCards).slice(0, MAX_REVIEW);
  // Lấy thẻ mới (chưa học)
  let newCards = await VocabCard.find({
    user: req.user.id,
    'srs.state': 'new'
  });
  newCards = shuffleArray(newCards).slice(0, MAX_NEW);
  const cards = [...reviewCards, ...newCards];
  res.json(cards);
});

// Lấy tất cả từ của user (không filter dueDate hay trạng thái) - dùng cho trang quản lý từ vựng
router.get('/all', authMiddleware, async (req, res) => {
  let query = { user: req.user.id };
  const cards = await VocabCard.find(query);
  res.json(cards);
});

// API: Thời gian (giờ, phút) đến thẻ due tiếp theo
router.get('/next-due', authMiddleware, async (req, res) => {
  const now = new Date();
  const { deckId, deckType } = req.query;

  let nextCard = null;

  if (deckType === 'shared' && deckId) {
    // Truy vấn UserVocabProgress cho deck shared
    nextCard = await UserVocabProgress.findOne({
      user: req.user.id,
      deck: deckId,
      'srs.dueDate': { $gt: now }
    }).sort({ 'srs.dueDate': 1 });
    if (nextCard) nextCard = nextCard.srs;
  } else {
    // Truy vấn VocabCard cho deck cá nhân
    nextCard = await VocabCard.findOne({
      user: req.user.id,
      'srs.dueDate': { $gt: now }
    }).sort({ 'srs.dueDate': 1 });
    if (nextCard) nextCard = nextCard.srs;
  }

  if (!nextCard) return res.json({ hours: null, minutes: null });

  const diffMs = nextCard.dueDate - now;
  const totalMinutes = Math.ceil(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  res.json({ hours, minutes });
});

// API: Import toàn bộ bộ từ mẫu vào tiến trình học của user (chỉ tạo nếu chưa có)
router.post('/import-shared', authMiddleware, async (req, res) => {
  try {
    // Lấy toàn bộ từ mẫu
    const sharedCards = await SharedVocabCard.find({});
    const userId = req.user.id;
    let imported = 0;
    for (const card of sharedCards) {
      // Kiểm tra nếu user đã có tiến trình học với từ này thì bỏ qua
      const exists = await UserVocabProgress.findOne({ user: userId, vocab: card._id });
      if (!exists) {
        await UserVocabProgress.create({ user: userId, vocab: card._id });
        imported++;
      }
    }
    res.json({ message: `Đã import ${imported} từ vào tiến trình học của bạn.` });
  } catch (err) {
    console.error('Import shared vocab error:', err);
    res.status(500).json({ message: 'Lỗi khi import bộ từ mẫu.' });
  }
});

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
    // Lấy toàn bộ từ mẫu trong deck
    const sharedCards = await SharedVocabCard.find({ deck: deckId });
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
  const cards = await UserVocabProgress.find({ _id: { $in: queue.cardIds } })
    .populate('vocab', 'word meaning example phonetic audio image tags');
  // Lọc chỉ trả về các thẻ còn đến hạn trong ngày
  let filteredCards = cards.filter(card =>
    card.srs.state === 'new' ||
    (card.srs.state === 'learning' && new Date(card.srs.dueDate) <= now) ||
    (card.srs.state === 'review' && new Date(card.srs.dueDate) <= now)
  );
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
    srs: p.srs,
    reviewHistory: p.reviewHistory,
    vocabId: p.vocab?._id,
    deck: p.deck,
  });
  res.json(filteredCards.map(mapCard));
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
  // Thử tìm trong UserVocabProgress trước
  let card = await UserVocabProgress.findOne({ _id: req.params.id, user: req.user.id });
  if (card) {
    sm2(card, grade);
    await card.save();
    return res.json(card);
  }
  // Nếu không có, thử tìm trong VocabCard (từ cá nhân)
  card = await VocabCard.findOne({ _id: req.params.id, user: req.user.id });
  if (!card) return res.status(404).json({ message: 'Not found' });
  sm2(card, grade);
  await card.save();
  res.json(card);
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