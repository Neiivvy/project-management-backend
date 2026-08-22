const express = require("express");
const Task = require("../models/Task");
const Project = require("../models/project");
const Comment = require("../models/Comment");

const { protect } = require("../middleware/auth");
const { restrictTo } = require("../middleware/role");
const mongoose = require("mongoose");
const notify = require("../utils/notify");

const router = express.Router();

// ======================================================
// Helper: Check project access
// ======================================================

const checkProjectAccess = async (projectId, userId, userRole) => {
  const project = await Project.findById(projectId);

  if (!project) {
    return {
      authorized: false,
      error: "Project not found",
    };
  }

  const isMember = project.teamMembers.some(
    (m) => m.toString() === userId.toString(),
  );

  const isManager = project.manager.toString() === userId.toString();

  const isAdmin = userRole === "admin";

  if (!isAdmin && !isManager && !isMember) {
    return {
      authorized: false,
      error: "Not authorized to access this project",
    };
  }

  return {
    authorized: true,
    project,
  };
};

// ======================================================
// POST /api/tasks
// PM/Admin creates task
// ======================================================

router.post(
  "/",
  protect,
  restrictTo("admin", "project_manager"),
  async (req, res, next) => {
    try {
      const { title, description, priority, deadline, projectId, assignedTo } =
        req.body;

      if (!projectId) {
        return res.status(400).json({
          message: "projectId is required",
        });
      }

      if (!assignedTo) {
        return res.status(400).json({
          message: "assignedTo is required",
        });
      }

      const project = await Project.findById(projectId);

      if (!project) {
        return res.status(404).json({
          message: "Project not found",
        });
      }

      // PM can only create tasks in their own projects
      if (
        req.user.role === "project_manager" &&
        project.manager.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          message: "Not authorized to create tasks in this project",
        });
      }

      // Make sure assigned user belongs to project
      const isMember = project.teamMembers.some(
        (m) => m.toString() === assignedTo.toString(),
      );

      if (!isMember) {
        return res.status(400).json({
          message: "Assigned user must be a member of this project",
        });
      }

      const task = await Task.create({
        title,
        description,
        priority,
        deadline,
        projectId,
        assignedTo,
      });

      await task.populate([
        {
          path: "assignedTo",
          select: "name email",
        },
        {
          path: "projectId",
          select: "title",
        },
      ]);

      // Notify assigned member
      await notify({
        userId: assignedTo,
        type: "task_assigned",
        title: `New task assigned: ${task.title}`,
        message: `You've been assigned a new task in ${project.title}`,
        relatedEntityType: "task",
        relatedEntityId: task._id,
      });

      res.status(201).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ======================================================
// GET /api/tasks
// ======================================================

router.get("/", protect, async (req, res, next) => {
  try {
    let query = {};

    if (req.user.role === "admin") {
      if (req.query.projectId) {
        query.projectId = req.query.projectId;
      }
    } else if (req.user.role === "project_manager") {
      if (req.query.projectId) {
        const project = await Project.findById(req.query.projectId);

        if (
          !project ||
          project.manager.toString() !== req.user._id.toString()
        ) {
          return res.status(403).json({
            message: "Not authorized to view tasks in this project",
          });
        }

        query.projectId = req.query.projectId;
      } else {
        const pmProjects = await Project.find({
          manager: req.user._id,
        }).select("_id");

        query.projectId = {
          $in: pmProjects.map((p) => p._id),
        };
      }
    } else {
      // Member only sees their assigned tasks
      query.assignedTo = req.user._id;
    }

    // assignedToMe filter
    if (req.query.assignedToMe === "true" && req.user.role !== "member") {
      query.assignedTo = req.user._id;
    }

    const tasks = await Task.find(query)
      .populate("assignedTo", "name email")
      .populate("projectId", "title")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// GET /api/tasks/:id
// ======================================================

router.get("/:id", protect, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("assignedTo", "name email")
      .populate("projectId", "title manager");

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const accessCheck = await checkProjectAccess(
      task.projectId._id,
      req.user._id,
      req.user.role,
    );

    if (!accessCheck.authorized) {
      return res.status(403).json({
        message: accessCheck.error,
      });
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// PUT /api/tasks/:id
// Update task
// ======================================================

router.put("/:id", protect, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    // --------------------------------------------------
    // Check project access
    // --------------------------------------------------

    const accessCheck = await checkProjectAccess(
      task.projectId,
      req.user._id,
      req.user.role,
    );

    if (!accessCheck.authorized) {
      return res.status(403).json({
        message: accessCheck.error,
      });
    }

    // ==================================================
    // MEMBER
    // Members can only update task status
    // ==================================================

    if (req.user.role === "member") {
      if (task.assignedTo.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Not authorized to update this task",
        });
      }

      if (req.body.status) {
        task.status = req.body.status;
      }

      await task.save();

      // Notify PM
      const project = accessCheck.project;

      await notify({
        userId: project.manager,
        type: "task_status_updated",
        title: `Task updated: ${task.title}`,
        message: `Status changed to "${task.status}" by ${req.user.name}`,
        relatedEntityType: "task",
        relatedEntityId: task._id,
      });

      return res.json({
        success: true,
        data: task,
      });
    }

    // ==================================================
    // PM / ADMIN
    // ==================================================

    const { title, description, priority, status, deadline, assignedTo } =
      req.body;

    // --------------------------------------------------
    // IMPORTANT:
    // Save previous assignee before changing it
    // --------------------------------------------------

    const previousAssignee = task.assignedTo
      ? task.assignedTo.toString()
      : null;

    // --------------------------------------------------
    // Update normal task fields
    // --------------------------------------------------

    if (title !== undefined) {
      task.title = title;
    }

    if (description !== undefined) {
      task.description = description;
    }

    if (priority !== undefined) {
      task.priority = priority;
    }

    if (status !== undefined) {
      task.status = status;
    }

    if (deadline !== undefined) {
      task.deadline = deadline;
    }

    // ==================================================
    // REASSIGNMENT LOGIC
    // ==================================================

    if (
      assignedTo &&
      previousAssignee &&
      assignedTo.toString() !== previousAssignee
    ) {
      // -----------------------------------------------
      // Delete previous member's comments ONLY
      // -----------------------------------------------

      await Comment.deleteMany({
        taskId: task._id,
        userId: previousAssignee,
      });

      // Now assign the new member
      task.assignedTo = assignedTo;
    }

    // --------------------------------------------------
    // If assignedTo is provided but same member,
    // don't delete comments
    // --------------------------------------------------
    else if (assignedTo) {
      task.assignedTo = assignedTo;
    }

    // --------------------------------------------------
    // Save task
    // --------------------------------------------------

    await task.save();

    await task.populate("assignedTo", "name email");

    // ==================================================
    // Notify new assignee
    // ==================================================

    if (
      assignedTo &&
      previousAssignee &&
      assignedTo.toString() !== previousAssignee
    ) {
      await notify({
        userId: assignedTo,
        type: "task_assigned",
        title: `Task assigned to you: ${task.title}`,
        message: `You've been assigned this task`,
        relatedEntityType: "task",
        relatedEntityId: task._id,
      });
    }

    // --------------------------------------------------
    // Response
    // --------------------------------------------------

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// DELETE /api/tasks/:id
// PM/Admin only
// ======================================================

router.delete(
  "/:id",
  protect,
  restrictTo("admin", "project_manager"),
  async (req, res, next) => {
    try {
      const task = await Task.findById(req.params.id);

      if (!task) {
        return res.status(404).json({
          message: "Task not found",
        });
      }

      const accessCheck = await checkProjectAccess(
        task.projectId,
        req.user._id,
        req.user.role,
      );

      if (!accessCheck.authorized) {
        return res.status(403).json({
          message: accessCheck.error,
        });
      }

      // Optional but recommended:
      // Remove comments when task itself is deleted
      await Comment.deleteMany({
        taskId: task._id,
      });

      await task.deleteOne();

      res.json({
        success: true,
        message: "Task deleted",
      });
    } catch (error) {
      next(error);
    }
  },
);

// ======================================================
// GET /api/tasks/progress/by-status
// ======================================================

router.get("/progress/by-status", protect, async (req, res, next) => {
  try {
    const projectId = req.query.projectId;

    if (!projectId) {
      return res.status(400).json({
        message: "projectId query param required",
      });
    }

    const accessCheck = await checkProjectAccess(
      projectId,
      req.user._id,
      req.user.role,
    );

    if (!accessCheck.authorized) {
      return res.status(403).json({
        message: accessCheck.error,
      });
    }

    const statusCounts = await Task.aggregate([
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(projectId),
        },
      },
      {
        $group: {
          _id: "$status",
          count: {
            $sum: 1,
          },
        },
      },
    ]);

    const total = statusCounts.reduce((sum, s) => sum + s.count, 0);

    const progress = {
      total,
      byStatus: {},
      percentages: {},
    };

    statusCounts.forEach((s) => {
      progress.byStatus[s._id] = s.count;

      progress.percentages[s._id] =
        total > 0 ? Math.round((s.count / total) * 100) : 0;
    });

    res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
