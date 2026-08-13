const Notification = require("../models/Notification");

const notify = async ({
  userId,
  type,
  title,
  message,
  relatedEntityType,
  relatedEntityId,
}) => {
  try {
    if (!userId) return null;

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      read: false,
    });

    return notification;
  } catch (error) {
    console.error("Notification error:", error.message);
    return null;
  }
};

module.exports = notify;