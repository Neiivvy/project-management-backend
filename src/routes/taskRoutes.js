const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const protect = require('../middleware/auth');
const { authorize } = require('../middleware/role');

// 1. Create a Task (Only Admins and Project Managers)
router.post('/', protect, authorize('Admin', 'Project Manager'), async (req, res, next) => {
  try {
    // Destructure using your schema field: projectId
    const { projectId, title, description, priority, status, assignedTo } = req.body;

    const task = await Task.create({
      projectId,
      title,
      description,
      priority,
      status,
      assignedTo
    });

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// 2. Get All Tasks for a Specific Project
router.get('/project/:projectId', protect, async (req, res, next) => {
  try {
    // Querying by your schema field: projectId
    const tasks = await Task.find({ projectId: req.params.projectId })
      .populate('assignedTo', 'name email role');
      
    res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    next(error);
  }
});

// 3. Update Task Status or Details
router.put('/:id', protect, async (req, res, next) => {
  try {
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Role Enforcement: Team Members can only update the status field
    if (req.user.role === 'Team Member') {
      if (req.body.status) {
        task.status = req.body.status;
        await task.save();
      } else {
        return res.status(403).json({ 
          success: false, 
          message: 'Team members are only authorized to update the task status.' 
        });
      }
    } else {
      // Admins & PMs can modify any fields (e.g., changing assignment, title, priority)
      task = await Task.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
    }

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

module.exports = router;