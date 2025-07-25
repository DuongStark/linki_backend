// SM-2 Algorithm for SRS
// Learning steps (phút)
const LEARNING_STEPS = [1, 10];
const EASY_INTERVAL = 4; // ngày, mặc định cho Easy

function sm2(card, grade) {
  let { interval, repetitions, easeFactor, state, learningStepIndex, dueDate } = card.srs;

  // Nếu đang ở learning steps
  if (state === 'new' || state === 'learning') {
    if (grade >= 4) { // Easy: tốt nghiệp luôn
      state = 'review';
      learningStepIndex = 0;
      repetitions = 0;
      easeFactor = 2.5;
      dueDate = new Date();
      // Random interval 3, 4, 5 ngày
      const fuzz = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
      interval = EASY_INTERVAL + fuzz;
      dueDate.setDate(dueDate.getDate() + interval);
    } else if (grade === 3) { // Good: sang bước learning tiếp theo
      if (learningStepIndex < LEARNING_STEPS.length - 1) {
        learningStepIndex += 1;
        state = 'learning';
        dueDate = new Date();
        dueDate.setMinutes(dueDate.getMinutes() + LEARNING_STEPS[learningStepIndex]);
      } else {
        // Đã qua hết learning steps, chuyển sang review (SM2)
        state = 'review';
        learningStepIndex = 0;
        repetitions = 0;
        easeFactor = 2.5;
        dueDate = new Date();
        interval = 1;
        dueDate.setDate(dueDate.getDate() + interval);
      }
    } else if (grade === 2) { // Hard: lặp lại bước hiện tại, delay ngắn
      state = 'learning';
      dueDate = new Date();
      dueDate.setMinutes(dueDate.getMinutes() + 2); // 2 phút
    } else { // Again (0,1): reset về bước đầu tiên
      learningStepIndex = 0;
      state = 'learning';
      dueDate = new Date();
      dueDate.setMinutes(dueDate.getMinutes() + LEARNING_STEPS[0]);
    }
    // Lưu lại lịch sử
    card.reviewHistory.push({
      date: new Date(),
      grade,
      interval,
      easeFactor
    });
    card.srs = { interval, repetitions, easeFactor, dueDate, state, learningStepIndex };
    return card;
  }

  // Nếu đã ở review (SM2)
  if (state === 'review') {
    if (grade >= 3) {
      if (repetitions === 0) interval = 1;
      else if (repetitions === 1) interval = 6;
      else interval = Math.round(interval * easeFactor);
      repetitions += 1;
      // Cập nhật easeFactor
      easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
      // Interval fuzzing: random hóa interval ±5% (hoặc ±1 ngày nếu interval > 20)
      let fuzzedInterval = interval;
      if (interval > 1) {
        const fuzzPercent = 0.05;
        let min = Math.floor(interval * (1 - fuzzPercent));
        let max = Math.ceil(interval * (1 + fuzzPercent));
        if (interval > 20) {
          min = Math.min(min, interval - 1);
          max = Math.max(max, interval + 1);
        }
        fuzzedInterval = Math.floor(Math.random() * (max - min + 1)) + min;
      }
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + fuzzedInterval);
      card.reviewHistory.push({
        date: new Date(),
        grade,
        interval: fuzzedInterval,
        easeFactor
      });
      card.srs = { interval: fuzzedInterval, repetitions, easeFactor, dueDate, state, learningStepIndex };
      return card;
    } else {
      // Lapse: quên thẻ đã review
      state = 'lapsed';
      repetitions = 0;
      learningStepIndex = 0;
      // Đặt interval = 0.5 * interval cũ, tối thiểu 1 ngày
      interval = Math.max(1, Math.round((interval || 1) * 0.5));
      dueDate = new Date();
      dueDate.setMinutes(dueDate.getMinutes() + LEARNING_STEPS[0]);
      card.reviewHistory.push({
        date: new Date(),
        grade,
        interval,
        easeFactor
      });
      card.srs = { interval, repetitions, easeFactor, dueDate, state, learningStepIndex };
      return card;
    }
  }
}

module.exports = sm2; 