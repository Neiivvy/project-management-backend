const express = require("express");
const Notification = require("../models/Notification");
const { protect } = require("../middleware/auth");

const router = express.Router();

// GET /api/notifications
// Get notifications for logged-in user
router.get("/", protect, async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      userId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false,
    });

    res.json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notifications/:id/read
router.put("/:id/read", protect, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
      },
      {
        read: true,
      },
      {
        new: true,
      }
    );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notifications/read-all
router.put("/read-all", protect, async (req, res, next) => {
  try {
    await Notification.updateMany(
      {
        userId: req.user._id,
        read: false,
      },
      {
        read: true,
      }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notifications/:id
router.delete("/:id", protect, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;