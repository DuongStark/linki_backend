const mongoose = require('mongoose');

const sharedVocabCardSchema = new mongoose.Schema({
  word: { type: String, required: true },
  meaning: String,
  example: String,
  audio: String,
  phonetic: String,
  image: String, // URL hình ảnh minh họa (nếu có)
  tags: [String],
  deck: { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', required: true },
});

module.exports = mongoose.model('SharedVocabCard', sharedVocabCardSchema); 