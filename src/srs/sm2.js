// SM-2 Algorithm for SRS
function sm2(card, grade) {
  let { interval, repetitions, easeFactor } = card.srs;

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
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + interval);

  // Lưu lại lịch sử
  card.reviewHistory.push({
    date: new Date(),
    grade,
    interval,
    easeFactor
  });

  // Cập nhật trạng thái SRS
  card.srs = { interval, repetitions, easeFactor, dueDate };
  return card;
}

module.exports = sm2; 