const User = require("../model/userModel");
const Review = require("../model/reviewModel");
const OwnerResponse = require("../model/ownerResponseModel");
const BlockedUser = require("../model/blockedUserModel");
const UserReport = require("../model/userReportModel");
const Establishment = require("../model/establishmentModel");

const OWNER_REGISTRATION_CODE = process.env.OWNER_REGISTRATION_CODE || "platepal-owner-2026";

const userController = {
    // Get all users with review stats
    getAllUsers: async function (req, res) {
        try {
            const q = (req.query.q || '').trim();
            const currentUsername = req.query.currentUser;

            const filter = q
                ? { $or: [
                        { username: { $regex: q, $options: 'i' } },
                        { bio: { $regex: q, $options: 'i' } }
                    ] }
                : {};

            let users = await User.find(filter).select('-password').lean();

            // Aggregate review counts and helpful counts in a single query for performance
            const userIds = users.map(u => u._id);
            const reviewStats = await Review.aggregate([
                { $match: { user: { $in: userIds } } },
                {
                    $group: {
                        _id: '$user',
                        reviewCount: { $sum: 1 },
                        helpfulCount: { $sum: '$helpful' },
                        unhelpfulCount: { $sum: '$unhelpful' }
                    }
                }
            ]);

            const statsMap = reviewStats.reduce((acc, stat) => {
                acc[stat._id.toString()] = stat;
                return acc;
            }, {});

            const usersWithCounts = users.map(user => {
                const stats = statsMap[user._id.toString()] || {};
                return {
                    ...user,
                    reviewCount: stats.reviewCount || 0,
                    helpfulCount: stats.helpfulCount || 0,
                    unhelpfulCount: stats.unhelpfulCount || 0,
                    joinDate: user._id ? user._id.getTimestamp().toISOString().split('T')[0] : null
                };
            });

            res.json(usersWithCounts);
        } catch (err) {
            console.log("Error loading users:", err);
            res.status(500).json({ error: "Error loading users" });
        }
    },

    // Get user by username
    getUserByUsername: async function (req, res) {
        try {
            const user = await User.findOne({ username: req.params.username }).select('-password').lean();
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            const currentUsername = req.query.currentUser;
            let isBlocked = false;
            if (currentUsername) {
                const currentUser = await User.findOne({ username: currentUsername });
                if (currentUser) {
                    const block = await BlockedUser.findOne({ blocker: currentUser._id, blocked: user._id });
                    isBlocked = !!block;
                }
            }

            const reportStats = await UserReport.aggregate([
                { $match: { reportedUser: user._id } },
                {
                    $group: {
                        _id: '$reportedUser',
                        totalReports: { $sum: { $ifNull: ['$reportCount', 1] } },
                        latestReportAt: { $max: '$lastReportedAt' }
                    }
                }
            ]);

            const latestReport = await UserReport.findOne({ reportedUser: user._id })
                .sort({ lastReportedAt: -1, updatedAt: -1, createdAt: -1 })
                .select('reason lastReportedAt')
                .lean();

            const warningCount = reportStats.length > 0 ? Number(reportStats[0].totalReports || 0) : 0;
            const lastWarningAt = (reportStats.length > 0 ? reportStats[0].latestReportAt : null) || null;
            const lastWarningReason = (latestReport ? latestReport.reason : '') || '';

            const isWarned = warningCount > 0;

            res.json({
                ...user,
                isBlocked,
                isWarned,
                warningCount,
                lastWarningAt,
                lastWarningReason
            });
        } catch (err) {
            console.log("Error loading user:", err);
            res.status(500).json({ error: "Error loading user" });
        }
    },

    // Get user's reviews
    getUserReviews: async function (req, res) {
        try {
            const user = await User.findOne({ username: req.params.username });
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            const currentUsername = req.query.currentUser;
            let reviews = await Review.find({ user: user._id })
                .populate('establishment', 'name')
                .populate('ownerResponse')
                .lean();

            // If currentUser is provided and has blocked this user, return empty
            if (currentUsername) {
                const currentUser = await User.findOne({ username: currentUsername });
                if (currentUser) {
                    const isBlocked = await BlockedUser.findOne({ blocker: currentUser._id, blocked: user._id });
                    if (isBlocked) {
                        reviews = [];
                    }
                }
            }

            const viewerId = req.query.viewerId;
            if (viewerId) {
                reviews = reviews.filter(r => !Array.isArray(r.hiddenBy) || !r.hiddenBy.includes(viewerId));
            }

            res.json(reviews);
        } catch (err) {
            console.log("Error loading user reviews:", err);
            res.status(500).json({ error: "Error loading user reviews" });
        }
    },

    // Get owner's responses
    getOwnerResponses: async function (req, res) {
        try {
            const user = await User.findOne({ username: req.params.username });
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
            if (user.accountType !== 'owner') {
                return res.status(403).json({ error: "User is not an owner" });
            }

            const responses = await OwnerResponse.find({ owner: user._id })
                .populate({
                    path: 'review',
                    populate: { path: 'establishment', select: 'name' }
                })
                .lean();

            res.json(responses);
        } catch (err) {
            console.log("Error loading owner responses:", err);
            res.status(500).json({ error: "Error loading owner responses" });
        }
    },

    // Login
    login: async function (req, res) {
        const { username, password } = req.body;
        try {
            const user = await User.findOne({ username });
            if (user && await user.comparePassword(password)) {
                res.json({ success: true, user });
            } else {
                res.json({ success: false, message: "Invalid username or password" });
            }
        } catch (err) {
            console.log("Login error:", err);
            res.status(500).json({ success: false, message: "Server error" });
        }
    },

    // Register
    register: async function (req, res) {
        const { username, email, password, bio, profilePic, accountType, establishmentId, ownerCode } = req.body;
        try {
            const existingUser = await User.findOne({ $or: [{ username }, { email }] });
            if (existingUser) {
                return res.json({ success: false, message: "Username or email already exists" });
            }

            // If registering as owner, require a valid establishment ID and a registration code
            let ownerEstablishmentId = null;
            if (accountType === 'owner') {
                if (!ownerCode || ownerCode !== OWNER_REGISTRATION_CODE) {
                    return res.json({ success: false, message: 'Invalid owner registration code. Contact an administrator for access.' });
                }

                if (!establishmentId) {
                    return res.json({ success: false, message: 'Please select an establishment when registering as an owner.' });
                }
                const matchingEst = await Establishment.findById(establishmentId);
                if (!matchingEst) {
                    return res.json({ success: false, message: 'Selected establishment not found.' });
                }
                ownerEstablishmentId = establishmentId;
            }

            const newUser = new User({
                username,
                email,
                password,
                bio: bio || "",
                profilePic: profilePic || "",
                accountType: accountType || "user",
                establishmentId: ownerEstablishmentId
            });
            await newUser.save();
            res.json({ success: true, user: newUser });
        } catch (err) {
            console.log("Register error:", err);
            res.status(500).json({ success: false, message: "Server error" });
        }
    },

    // Block a user
    blockUser: async function (req, res) {
        try {
            const { blockerUsername } = req.body;
            if (!blockerUsername) {
                return res.status(400).json({ error: "Missing blockerUsername" });
            }

            const blocker = await User.findOne({ username: blockerUsername });
            if (!blocker) {
                return res.status(404).json({ error: "Blocker user not found" });
            }

            const blocked = await User.findById(req.params.userId);
            if (!blocked) {
                return res.status(404).json({ error: "User to block not found" });
            }

            if (blocker._id.toString() === blocked._id.toString()) {
                return res.status(400).json({ error: "Cannot block yourself" });
            }

            // Check if already blocked
            const existingBlock = await BlockedUser.findOne({ blocker: blocker._id, blocked: blocked._id });
            if (existingBlock) {
                return res.status(400).json({ error: "User already blocked" });
            }

            const newBlock = new BlockedUser({
                blocker: blocker._id,
                blocked: blocked._id
            });

            await newBlock.save();
            res.json({ success: true, message: "User blocked successfully" });
        } catch (err) {
            console.log("Error blocking user:", err);
            res.status(500).json({ success: false, error: "Error blocking user" });
        }
    },

    // Unblock a user
    unblockUser: async function (req, res) {
        try {
            const { blockerUsername } = req.body;
            if (!blockerUsername) {
                return res.status(400).json({ error: "Missing blockerUsername" });
            }

            const blocker = await User.findOne({ username: blockerUsername });
            if (!blocker) {
                return res.status(404).json({ error: "Blocker user not found" });
            }

            const blocked = await User.findById(req.params.userId);
            if (!blocked) {
                return res.status(404).json({ error: "User to unblock not found" });
            }

            const block = await BlockedUser.findOneAndDelete({ blocker: blocker._id, blocked: blocked._id });
            if (!block) {
                return res.status(400).json({ error: "Block relationship not found" });
            }

            res.json({ success: true, message: "User unblocked successfully" });
        } catch (err) {
            console.log("Error unblocking user:", err);
            res.status(500).json({ success: false, error: "Error unblocking user" });
        }
    },

    // Get blocked users
    getBlockedUsers: async function (req, res) {
        try {
            const user = await User.findOne({ username: req.params.username });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const blocked = await BlockedUser.find({ blocker: user._id }).populate('blocked', 'username bio profilePic').lean();
            const blockedUsers = blocked.map(entry => ({
                _id: entry.blocked._id,
                username: entry.blocked.username,
                bio: entry.blocked.bio || '',
                profilePic: entry.blocked.profilePic || '',
                blockedAt: entry.createdAt
            }));

            res.json({ blockedUsers });
        } catch (err) {
            console.log('Error loading blocked users:', err);
            res.status(500).json({ error: 'Error loading blocked users' });
        }
    },

    // Get reported reviews by user
    getReportedReviews: async function (req, res) {
        try {
            const user = await User.findOne({ username: req.params.username });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const reportedReviews = await Review.find({ 'reports.reporter': req.params.username })
                .populate('establishment', 'name')
                .populate('user', 'username')
                .lean();

            res.json({ reportedReviews });
        } catch (err) {
            console.log('Error loading reported reviews:', err);
            res.status(500).json({ error: 'Error loading reported reviews' });
        }
    },

    // Get reported users by user
    getReportedUsers: async function (req, res) {
        try {
            const user = await User.findOne({ username: req.params.username });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const reportedUsers = await UserReport.find({ reporter: user._id })
                .populate('reportedUser', 'username bio profilePic')
                .sort({ createdAt: -1 })
                .lean();

            res.json({
                reportedUsers: reportedUsers.map((report) => ({
                    _id: report._id,
                    reason: report.reason || 'Inappropriate behavior',
                    details: report.details || '',
                    status: report.status || 'pending',
                    reportCount: report.reportCount || 1,
                    createdAt: report.createdAt,
                    lastReportedAt: report.lastReportedAt || report.updatedAt || report.createdAt,
                    reportedUser: report.reportedUser
                        ? {
                              _id: report.reportedUser._id,
                              username: report.reportedUser.username,
                              bio: report.reportedUser.bio || '',
                              profilePic: report.reportedUser.profilePic || ''
                          }
                        : null
                }))
            });
        } catch (err) {
            console.log('Error loading reported users:', err);
            res.status(500).json({ error: 'Error loading reported users' });
        }
    },

    // Report a user
    reportUser: async function (req, res) {
        try {
            const { reporterUsername, reason, details } = req.body;
            const trimmedReporterUsername = typeof reporterUsername === 'string' ? reporterUsername.trim() : '';
            const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
            const safeDetails = typeof details === 'string' ? details.trim() : '';

            if (!trimmedReporterUsername || !trimmedReason) {
                return res.status(400).json({ error: 'Missing reporterUsername or reason' });
            }

            if (!require('mongoose').Types.ObjectId.isValid(req.params.userId)) {
                return res.status(400).json({ error: 'Invalid userId' });
            }

            const reporter = await User.findOne({ username: trimmedReporterUsername });
            if (!reporter) {
                return res.status(404).json({ error: 'Reporting user not found' });
            }

            const reportedUser = await User.findById(req.params.userId);
            if (!reportedUser) {
                return res.status(404).json({ error: 'User to report not found' });
            }

            if (reporter._id.toString() === reportedUser._id.toString()) {
                return res.status(400).json({ error: 'Cannot report yourself' });
            }

            const updatedReport = await UserReport.findOneAndUpdate(
                {
                    reporter: reporter._id,
                    reportedUser: reportedUser._id,
                    status: 'pending'
                },
                {
                    $set: {
                        reason: trimmedReason,
                        details: safeDetails,
                        lastReportedAt: new Date(),
                        status: 'pending'
                    },
                    $setOnInsert: {
                        reporter: reporter._id,
                        reportedUser: reportedUser._id
                    },
                    $inc: { reportCount: 1 }
                },
                { upsert: true, new: true, setDefaultsOnInsert: false }
            );

            await User.findByIdAndUpdate(reportedUser._id, {
                $inc: { warningCount: 1 },
                $set: {
                    isWarned: true,
                    lastWarningReason: trimmedReason,
                    lastWarningAt: new Date()
                }
            });

            res.json({
                success: true,
                message: 'User report submitted successfully',
                routeVersion: 'user-report-v3',
                report: {
                    id: updatedReport?._id || null,
                    reportCount: updatedReport?.reportCount || 1,
                    status: updatedReport?.status || 'pending',
                    lastReportedAt: updatedReport?.lastReportedAt || new Date()
                }
            });
        } catch (err) {
            console.log('Error reporting user:', err);
            res.status(500).json({ success: false, error: 'Error reporting user' });
        }
    },

    // Change password
    changePassword: async function (req, res) {
        try {
            const { username, currentPassword, newPassword } = req.body;

            if (!username || !currentPassword || !newPassword) {
                return res.status(400).json({ success: false, message: 'All fields are required' });
            }

            const user = await User.findOne({ username });
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            // Verify current password
            const isCurrentPasswordValid = await user.comparePassword(currentPassword);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({ success: false, message: 'Current password is incorrect' });
            }

            // Update password (pre-save hook will hash it)
            user.password = newPassword;
            await user.save();

            res.json({ success: true, message: 'Password changed successfully' });
        } catch (err) {
            console.log('Error changing password:', err);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
};

module.exports = userController;