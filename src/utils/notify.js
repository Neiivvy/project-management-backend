const Notification = require("../models/Notification");

/**
 * Create a notification and (if socket.io is attached to the app) push it
 * to the recipient in real time. Import this from wherever the action
 * actually happens — no need to touch existing task/project/comment code
 * beyond adding one call at the end of each handler.
 *
 * @param {import('express').Request} req  used to reach req.app.get('io')
 * @param {Object} params
 * @param {string} params.recipient  user id to notify
 * @param {string} [params.actor]    user id who triggered it
 * @param {'TASK_ASSIGNED'|'DEADLINE_UPDATED'|'COMMENT_ADDED'|'PROJECT_UPDATED'} params.type
 * @param {string} params.message    ready-to-render text
 * @param {{kind: 'task'|'project'|'comment', id: string}} [params.entity]
 * @param {string} [params.link]     frontend route to open on click
 */
async function notify(req, { recipient, actor, type, message, entity, link }) {
  // don't notify someone about their own action
  if (actor && String(actor) === String(recipient)) return null;

  const doc = await Notification.create({
    recipient,
    actor,
    type,
    message,
    entity,
    link,
  });

  const io = req.app.get("io");
  if (io) {
    io.to(`user:${recipient}`).emit("notification:new", doc);
  }

  return doc;
}

// Convenience builders so call sites stay one line and messages stay consistent.
const templates = {
  taskAssigned: (taskTitle) => `You were assigned to "${taskTitle}"`,
  deadlineUpdated: (taskTitle, dueDate) =>
    `Deadline for "${taskTitle}" moved to ${new Date(dueDate).toLocaleDateString()}`,
  commentAdded: (authorName, taskTitle) =>
    `${authorName} commented on "${taskTitle}"`,
  projectUpdated: (projectName) => `"${projectName}" was updated`,
};

module.exports = { notify, templates };