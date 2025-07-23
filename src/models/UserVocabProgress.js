const mongoose = require('mongoose');

const reviewHistorySchema = new mongoose.Schema({
  date: Date,
  grade: Number,
  interval: Number,
  easeFactor: Number
}, { _id: false });

const userVocabProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vocab: { type: mongoose.Schema.Types.ObjectId, ref: 'SharedVocabCard', required: true },
  deck: { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', required: true },
  srs: {
    interval: { type: Number, default: 1 },
    repetitions: { type: Number, default: 0 },
    easeFactor: { type: Number, default: 2.5 },
    dueDate: { type: Date, default: Date.now },
    state: { type: String, enum: ['new', 'learning', 'review'], default: 'new' },
    learningStepIndex: { type: Number, default: 0 }
  },
  reviewHistory: [reviewHistorySchema]
});

const dailyStudyQueueSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deck: { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', required: true },
  date: { type: String, required: true }, // yyyy-mm-dd
  cardIds: [{ type: mongoose.Schema.Types.ObjectId, required: true }], // UserVocabProgress _id
});

module.exports = mongoose.model('UserVocabProgress', userVocabProgressSchema);
module.exports.DailyStudyQueue = mongoose.model('DailyStudyQueue', dailyStudyQueueSchema); 