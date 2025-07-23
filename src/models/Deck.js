const mongoose = require('mongoose');

const deckSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['shared', 'personal'], required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // chỉ với deck cá nhân
  description: String,
  tags: [String],
});

module.exports = mongoose.model('Deck', deckSchema); 