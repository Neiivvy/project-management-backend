const express = require("express");

const router = express.Router();

const {
  getMemberDashboard,
} = require("../controllers/dashboardController");

const auth = require("../middleware/authMiddleware");

router.get("/member", auth, getMemberDashboard);

module.exports = router;


// Member
const now = new Date();

const [totalTasks, completedTasks, pendingTasks, inProgressTasks, overdueTasks, recentActivity] =
  await Promise.all([
    Task.countDocuments({ assignedTo: userId }),
    Task.countDocuments({ assignedTo: userId, status: 'Completed' }),
    Task.countDocuments({ assignedTo: userId, status: 'To Do' }),
    Task.countDocuments({ assignedTo: userId, status: 'In Progress' }),
    Task.countDocuments({ assignedTo: userId, status: { $ne: 'Completed' }, deadline: { $lt: now } }),
    Task.find({ assignedTo: userId })
      .populate('projectId', 'title')
      .sort({ updatedAt: -1 })
      .limit(5),
  ]);

const myProjects = await Project.find({ teamMembers: userId })
  .select('title status deadline')
  .populate('manager', 'name');

return res.json({
  success: true,
  data: { totalTasks, completedTasks, pendingTasks, inProgressTasks, overdueTasks, recentActivity, projects: myProjects },
});