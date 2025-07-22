const mongoose = require('mongoose');

const reviewHistorySchema = new mongoose.Schema({
  date: Date,
  grade: Number,
  interval: Number,
  easeFactor: Number
}, { _id: false });

const vocabCardSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  word: String,
  meaning: String,
  example: String,
  audio: String,
  phonetic: String,
  srs: {
    interval: { type: Number, default: 1 }, // ngày
    repetitions: { type: Number, default: 0 },
    easeFactor: { type: Number, default: 2.5 },
    dueDate: { type: Date, default: Date.now }
  },
  reviewHistory: [reviewHistorySchema]
});

module.exports = mongoose.model('VocabCard', vocabCardSchema); 