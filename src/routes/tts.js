const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const https = require('https');

// Sử dụng Google TTS (nếu trong production, bạn nên dùng Google Cloud TTS API)
// Đây là cách triển khai đơn giản cho mục đích demo
router.get('/:word', authMiddleware, async (req, res) => {
  try {
    const word = req.params.word;
    if (!word) {
      return res.status(400).json({ message: 'Thiếu từ cần đọc' });
    }

    // Tạo URL cho Google TTS (cách đơn giản)
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&client=tw-ob`;

    // Proxy request từ Google TTS về client
    https.get(ttsUrl, (ttsRes) => {
      // Kiểm tra status code
      if (ttsRes.statusCode !== 200) {
        return res.status(ttsRes.statusCode).json({ message: 'Lỗi khi lấy audio' });
      }

      // Set headers để client biết đây là audio
      res.setHeader('Content-Type', 'audio/mp3');
      res.setHeader('Content-Disposition', `attachment; filename="${word}.mp3"`);
      
      // Pipe response từ Google TTS về client
      ttsRes.pipe(res);
    }).on('error', (err) => {
      console.error('TTS error:', err);
      res.status(500).json({ message: 'Lỗi khi lấy audio từ TTS service' });
    });
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// API lấy URL audio (thay vì proxy)
router.get('/url/:word', authMiddleware, (req, res) => {
  try {
    const word = req.params.word;
    if (!word) {
      return res.status(400).json({ message: 'Thiếu từ cần đọc' });
    }

    // Tạo URL cho Google TTS
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&client=tw-ob`;
    
    // Trả về URL cho client tự xử lý
    res.json({ url: ttsUrl });
  } catch (error) {
    console.error('TTS URL error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Tạo và cache audio cho nhiều từ cùng lúc
router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const { words } = req.body;
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ message: 'Danh sách từ không hợp lệ' });
    }

    // Giới hạn số lượng từ mỗi lần request
    if (words.length > 50) {
      return res.status(400).json({ message: 'Quá nhiều từ trong một request (tối đa 50)' });
    }

    // Tạo URLs cho từng từ
    const audioUrls = words.map(word => ({
      word,
      url: `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&client=tw-ob`
    }));

    res.json({ audioUrls });
  } catch (error) {
    console.error('Batch TTS error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router; 