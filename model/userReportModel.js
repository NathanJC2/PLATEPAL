const mongoose = require("mongoose");

const userReportSchema = new mongoose.Schema({
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    reportedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    reason: {
        type: String,
        required: true,
        default: "Inappropriate behavior"
    },
    details: {
        type: String,
        default: ""
    },
    reportCount: {
        type: Number,
        default: 1
    },
    lastReportedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ["pending", "reviewed"],
        default: "pending"
    }
}, {
    timestamps: true
});

// Prevent duplicate active reports from the same reporter for the same user.
userReportSchema.index({ reporter: 1, reportedUser: 1, status: 1 }, { unique: true });

module.exports = mongoose.model("UserReport", userReportSchema);
