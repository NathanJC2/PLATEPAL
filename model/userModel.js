const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    bio: {
        type: String,
        default: ""
    },
    profilePic: {
        type: String,
        default: ""
    },
    accountType: {
        type: String,
        default: "user"
    },
    warningCount: {
        type: Number,
        default: 0
    },
    isWarned: {
        type: Boolean,
        default: false
    },
    lastWarningReason: {
        type: String,
        default: ""
    },
    lastWarningAt: {
        type: Date,
        default: null
    },
    // If this user is an owner, this links them to their establishment
    establishmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Establishment",
        default: null
    }
});

// Hash password before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);