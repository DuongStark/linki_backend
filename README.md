# Anki Vocab Backend

Backend cho ứng dụng học từ vựng tiếng Anh kiểu Anki với SRS.

## Cài đặt

```bash
# Cài đặt dependencies
npm install

# Tạo VAPID keys cho Web Push Notifications
node vapid-keys.js

# Tạo file .env từ mẫu sample.env
# Cập nhật MONGODB_URI, JWT_SECRET, và VAPID keys
```

## Chạy ứng dụng

```bash
# Chạy development server với nodemon
npm run dev

# Chạy production server
npm start
```

Lưu ý: Scheduler thông báo được tích hợp sẵn trong server, sẽ tự động chạy khi khởi động server.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập

### Từ vựng
- `GET /api/vocab` - Lấy danh sách từ vựng
- `POST /api/vocab` - Tạo từ mới
- `PUT /api/vocab/:id` - Cập nhật từ
- `DELETE /api/vocab/:id` - Xóa từ
- `POST /api/vocab/:id/review` - Đánh giá SRS cho từ

### Thống kê
- `GET /api/stats` - Lấy thống kê tổng quan
- `GET /api/stats/daily` - Lấy thống kê theo ngày

### Thông báo
- `POST /api/notifications/subscribe` - Đăng ký nhận thông báo
- `PUT /api/notifications/settings` - Cập nhật cài đặt thông báo
- `POST /api/notifications/send-reminder` - Gửi thông báo nhắc học

### TTS (Text-to-Speech)
- `GET /api/tts/:word` - Lấy audio đọc từ
- `GET /api/tts/url/:word` - Lấy URL audio đọc từ
- `POST /api/tts/batch` - Lấy URL audio cho nhiều từ 