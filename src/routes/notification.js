const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");

const { protect } = require("../middleware/auth");

// GET /api/notifications?limit=20&cursor=<id>
// Returns unread first, then read, newest first.
router.get("/", protect, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const query = { recipient: req.user._id };
    
    if (req.query.cursor) {
      query._id = { $lt: req.query.cursor };
    }

    const notifications = await Notification.find(query)
      .sort({ read: 1, createdAt: -1 })
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    });

    res.json({
      notifications,
      unreadCount,
      nextCursor:
        notifications.length === limit
          ? notifications[notifications.length - 1]._id
          : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load notifications" });
  }
});

// GET /api/notifications/unread-count — cheap poll target for the badge
router.get("/unread-count", protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Could not load unread count" });
  }
});

// PATCH /api/notifications/read-all
// Note: Placed above /:id/read so Express doesn't mistake "read-all" for an ID parameter
router.patch("/read-all", protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Could not update notifications" });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: "Not found" });
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: "Could not update notification" });
  }
});

module.exports = router;