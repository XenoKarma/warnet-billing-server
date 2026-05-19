const express = require("express");
const sessionController = require("../controllers/sessionController");
const pcController = require("../controllers/pcController");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    message: "Backend Billing Warnet Aktif 🚀",
  });
});

// API PC untuk Dashboard Operator
router.get("/api/pcs", pcController.getAllPcs);

// API Session untuk Dashboard Operator
router.post("/api/session/start", sessionController.startSession);
router.post("/api/session/stop", sessionController.stopSession);
router.post("/api/session/add-time", sessionController.addTime);

module.exports = router;