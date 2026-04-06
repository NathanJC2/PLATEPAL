const mongoose = require("mongoose");

const blockedUserSchema = new mongoose.Schema({
    blocker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    blocked: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {
    timestamps: true
});

// Ensure a user can't block the same user twice
blockedUserSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

module.exports = mongoose.model("BlockedUser", blockedUserSchema);