const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
  "TASK_ASSIGNED",
  "DEADLINE_UPDATED",
  "COMMENT_ADDED",
  "PROJECT_UPDATED",
];

const NotificationSchema = new mongoose.Schema(
  {
    // who should see this notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // who triggered it (optional — system events may have none)
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    // short, ready-to-render text — built once at creation time so the
    // frontend never has to reconstruct sentences from raw ids
    message: {
      type: String,
      required: true,
    },
    // links back to the thing the notification is about
    entity: {
      kind: { type: String, enum: ["task", "project", "comment"] },
      id: { type: mongoose.Schema.Types.ObjectId },
    },
    // where clicking the notification should take the user
    link: { type: String },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// fastest path for the notification bar: unread-first, newest-first, per user
NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;