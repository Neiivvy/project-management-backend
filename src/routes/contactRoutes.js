const express = require("express");
const Contact = require("../models/Contact");
const { protect } = require("../middleware/auth");
const { restrictTo } = require("../middleware/role");

const router = express.Router();

// POST /api/contact — public route for contact form submission
router.post("/", async (req, res, next) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        message: "Name, email, and message are required",
      });
    }

    const contact = await Contact.create({
      name,
      email,
      phone,
      message,
    });

    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/contacts — get all contacts (admin only)
router.get("/", protect, restrictTo("admin"), async (req, res, next) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/contacts/:id — get single contact (admin only)
router.get("/:id", protect, restrictTo("admin"), async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.json({ success: true, data: contact });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/contacts/:id — delete contact (admin only)
router.delete("/:id", protect, restrictTo("admin"), async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    await contact.deleteOne();
    res.json({ success: true, message: "Contact deleted" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
