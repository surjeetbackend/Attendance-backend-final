
const express=require('express')
const router = express.Router();
const User=require('../model/user');
// const { protect, authorize } = require("../middleware/auth");
// READ by empId
router.get('/emp/:empId', async (req, res) => {
  try {
    const user = await User.findOne({ empId: req.params.empId });
    
    if (!user) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.put('/emp/:empId', protect,authorize('employee'),async (req, res) => {
  try {
    const updatedUser = await User.findOneAndUpdate(
      { empId: req.params.empId },
      req.body,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(updatedUser);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/emp/:empId',protect,authorize('employee'), async (req, res) => {
  try {
    const deletedUser = await User.findOneAndDelete({ empId: req.params.empId });

    if (!deletedUser) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports=router;
