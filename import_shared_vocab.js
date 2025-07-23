// Script import bộ từ vào SharedVocabCard và gán vào deck mẫu
// Cách dùng: node import_shared_vocab.js /path/to/600\ TOEIC\ VOCABULARY.txt

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const SharedVocabCard = require('./src/models/SharedVocabCard');
const Deck = require('./src/models/Deck');

if (process.argv.length < 3) {
  console.error('Usage: node import_shared_vocab.js <path_to_vocab_file>');
  process.exit(1);
}

const vocabFile = process.argv[2];
const DECK_NAME = 'TOEIC 600';

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function importVocab() {
  try {
    // 1. Tạo deck mẫu nếu chưa có
    let deck = await Deck.findOne({ name: DECK_NAME, type: 'shared' });
    if (!deck) {
      deck = await Deck.create({ name: DECK_NAME, type: 'shared', description: '600 từ TOEIC mẫu' });
      console.log('Created deck:', deck._id);
    }

    // 2. Xóa các từ mẫu cũ không có deck (nếu cần)
    await SharedVocabCard.deleteMany({ deck: { $exists: false } });

    // 3. Import từ vào SharedVocabCard và gán deck
    const data = fs.readFileSync(vocabFile, 'utf8');
    const lines = data.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));
    let count = 0;
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 5) continue;
      const [ , word, type, phonetic, , meaning ] = parts;
      // Kiểm tra trùng từ trong deck
      const exists = await SharedVocabCard.findOne({ word: word.trim(), deck: deck._id });
      if (exists) continue;
      const card = new SharedVocabCard({
        word: word.trim(),
        meaning: meaning.trim(),
        phonetic: phonetic.trim(),
        deck: deck._id,
      });
      await card.save();
      count++;
    }
    console.log(`Imported ${count} vocab cards to deck '${DECK_NAME}'.`);
  } catch (err) {
    console.error('Import error:', err);
  } finally {
    mongoose.disconnect();
  }
}

importVocab(); 