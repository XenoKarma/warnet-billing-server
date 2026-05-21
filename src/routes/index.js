const express = require("express");
const sessionController = require("../controllers/sessionController");
const pcController = require("../controllers/pcController");
const authController = require("../controllers/authController");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    message: "Backend Billing Warnet Aktif 🚀",
  });
});

// API Auth untuk Dashboard Operator
router.post("/api/auth/login", authController.login);
router.get("/api/auth/verify", authController.verify);
router.post("/api/auth/update", authController.updateAccount);

// API PC untuk Dashboard Operator
router.get("/api/pcs", pcController.getAllPcs);
router.post("/api/pcs", pcController.addPc);
router.post("/api/pcs/bulk", pcController.addBulkPc);
router.delete("/api/pcs/:pcNumber", pcController.deletePc);

// API Session untuk Dashboard Operator
router.post("/api/session/start", sessionController.startSession);
router.post("/api/session/stop", sessionController.stopSession);
router.post("/api/session/add-time", sessionController.addTime);

module.exports = router;