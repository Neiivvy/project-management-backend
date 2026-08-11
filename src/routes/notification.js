const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const auth = require("../middleware/auth"); // your existing JWT/session middleware

// GET /api/notifications?limit=20&cursor=<id>
// Returns unread first, then read, newest first. Cursor-paginated so the
// bell can lazy-load older ones on scroll instead of one big payload.
router.get("/", auth, async (req, res) => {
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
      nextCursor: notifications.length === limit
        ? notifications[notifications.length - 1]._id
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load notifications" });
  }
});

// GET /api/notifications/unread-count — cheap poll target for the badge
router.get("/unread-count", auth, async (req, res) => {
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

// PATCH /api/notifications/:id/read
router.patch("/:id/read", auth, async (req, res) => {
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

// PATCH /api/notifications/read-all
router.patch("/read-all", auth, async (req, res) => {
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

module.exports = router;