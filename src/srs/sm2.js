// SM-2 Algorithm for SRS
// Learning steps (phút)
const LEARNING_STEPS = [1, 10];

function sm2(card, grade) {
  let { interval, repetitions, easeFactor, state, learningStepIndex, dueDate } = card.srs;

  // Nếu đang ở learning steps
  if (state === 'new' || state === 'learning') {
    if (grade >= 3) {
      if (learningStepIndex < LEARNING_STEPS.length - 1) {
        // Chuyển sang bước learning tiếp theo
        learningStepIndex += 1;
        state = 'learning';
        // Đặt dueDate cho bước tiếp theo (tính bằng phút)
        dueDate = new Date();
        dueDate.setMinutes(dueDate.getMinutes() + LEARNING_STEPS[learningStepIndex]);
      } else {
        // Đã qua hết learning steps, chuyển sang review (SM2)
        state = 'review';
        learningStepIndex = 0;
        repetitions = 0;
        interval = 1;
        easeFactor = 2.5;
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + interval);
      }
    } else {
      // Trả lời sai, quay lại bước đầu tiên
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
    } else {
      repetitions = 0;
      interval = 1;
    }
    // Cập nhật easeFactor
    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
    // Tính ngày ôn tiếp theo
    dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + interval);
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
}

module.exports = sm2; 