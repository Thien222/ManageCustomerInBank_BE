const express = require('express');
const router = express.Router();
require('dotenv').config();



// POST /ai/chatbot
router.post('/chatbot', async (req, res) => {
  try {
    const { question, context } = req.body;
    if (!question) return res.status(400).json({ error: 'Missing question' });

    let prompt = `Bạn là trợ lý tài chính thông minh, hãy trả lời ngắn gọn, chính xác, dễ hiểu bằng tiếng Việt. Luôn ưu tiên trả lời dựa trên dữ liệu context bên dưới. Nếu không có dữ liệu phù hợp, hãy trả lời "Không có dữ liệu" thay vì xin lỗi.\n`;
    if (context) {
      prompt += `Dữ liệu tài chính hiện tại (cố gắng sử dụng tối đa thông tin này để trả lời):\n${context}\n`;
    }
    prompt += `Câu hỏi: ${question}\nTrả lời chi tiết:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Bạn là trợ lý tài chính thông minh, trả lời ngắn gọn, chính xác, dễ hiểu bằng tiếng Việt. Luôn ưu tiên trả lời dựa trên dữ liệu context, nếu không có dữ liệu thì trả lời "Không có dữ liệu".' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.2
    });

    const answer = completion.choices[0].message.content.trim();
    res.json({ answer });
  } catch (err) {
    console.error('AI chatbot error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Lỗi khi gọi AI chatbot' });
  }
});

module.exports = router; 
