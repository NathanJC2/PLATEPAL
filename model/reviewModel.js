const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    establishment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Establishment",
        required: true
    },
    title: {
        type: String,
        default: ""
    },
    comment: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true
    },
    helpful: {
        type: Number,
        default: 0
    },
    helpfulBy: {
        type: [String],
        default: []
    },
    unhelpful: {
        type: Number,
        default: 0
    },
    unhelpfulBy: {
        type: [String],
        default: []
    },
    ownerResponse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "OwnerResponse",
        default: null
    },
    reports: {
        type: [
            {
                reporter: {
                    type: String,
                    required: true
                },
                reason: {
                    type: String,
                    default: "Inappropriate or fake review"
                },
                details: {
                    type: String,
                    default: ""
                },
                status: {
                    type: String,
                    enum: ["pending", "reviewed"],
                    default: "pending"
                },
                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        default: []
    },
    hiddenBy: {
        type: [String],
        default: []
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Review", reviewSchema);