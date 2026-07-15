const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const protect = require('../middleware/auth');

// 1. Post a Comment onto a Task (Includes optional attachments for file sharing)
router.post('/', protect, async (req, res, next) => {
  try {
    const { taskId, text, attachments } = req.body;

    const comment = await Comment.create({
      taskId,
      text,
      attachments, // Array of file URLs sent from the frontend/cloud storage
      userId: req.user.id, // Securely mapped from the decoded JWT token payload
    });

    // Populate user profile info before sending back to the user interface
    await comment.populate('userId', 'name role');

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    next(error);
  }
});

// 2. Fetch all Comments for a specific Task (Chronological order)
router.get('/task/:taskId', protect, async (req, res, next) => {
  try {
    const comments = await Comment.find({ taskId: req.params.taskId })
      .populate('userId', 'name role')
      .sort({ createdAt: 1 }); // Oldest first to build a clean conversation thread

    res.status(200).json({ success: true, count: comments.length, data: comments });
  } catch (error) {
    next(error);
  }
});

module.exports = router;