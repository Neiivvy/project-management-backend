const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Task = require('../models/Task');
const auth = require('../middleware/auth'); // your existing auth middleware

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/tasks/'),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// GET full task details
router.get('/:id/details', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('project', 'name')
      .populate('assignedBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('comments.postedBy', 'name');

    if (!task) return res.status(404).json({ message: 'Task not found' });

    res.json({
      title: task.title,
      description: task.description,
      projectName: task.project?.name,
      priority: task.priority,
      dueDate: task.dueDate,
      assignedBy: task.assignedBy?.name,
      status: task.status,
      comments: task.comments,
      attachments: task.attachments
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST comment
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.comments.push({ text, postedBy: req.user.id });
    await task.save();
    await task.populate('comments.postedBy', 'name');

    res.json(task.comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST file upload
router.post('/:id/attachments', auth, upload.single('file'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.attachments.push({
      fileName: req.file.originalname,
      fileUrl: `/uploads/tasks/${req.file.filename}`,
      uploadedBy: req.user.id
    });
    await task.save();

    res.json(task.attachments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;