const Review = require("../model/reviewModel");
const OwnerResponse = require("../model/ownerResponseModel");
const User = require("../model/userModel");
const UserReport = require("../model/userReportModel");

const reviewController = {
    // Create a new review
    createReview: async function (req, res) {
        try {
            const { userId, establishmentId, title, comment, rating } = req.body;

            const newReview = new Review({
                user: userId,
                establishment: establishmentId,
                title: title || "",
                comment: comment,
                rating: rating
            });

            await newReview.save();
            res.json({ success: true, review: newReview });
        } catch (err) {
            console.log("Error saving review:", err);
            res.status(500).json({ success: false, error: "Error saving review" });
        }
    },

    // Update a review
    updateReview: async function (req, res) {
        try {
            const { title, comment, rating } = req.body;

            const review = await Review.findByIdAndUpdate(
                req.params.id,
                {
                    title: title || "",
                    comment: comment,
                    rating: rating,
                    updatedAt: Date.now()
                },
                { new: true }
            );

            if (!review) {
                return res.status(404).json({ error: "Review not found" });
            }

            res.json({ success: true, review: review });
        } catch (err) {
            console.log("Error updating review:", err);
            res.status(500).json({ success: false, error: "Error updating review" });
        }
    },

    // Toggle review feedback (helpful/unhelpful)
    toggleReviewFeedback: async function (req, res, type) {
        try {
            const { userIdentifier } = req.body;
            if (!userIdentifier) {
                return res.status(400).json({ error: "Missing userIdentifier" });
            }

            const review = await Review.findById(req.params.id);
            if (!review) {
                return res.status(404).json({ error: "Review not found" });
            }

            review.helpful = review.helpful || 0;
            review.unhelpful = review.unhelpful || 0;
            review.helpfulBy = review.helpfulBy || [];
            review.unhelpfulBy = review.unhelpfulBy || [];

            const isHelpful = review.helpfulBy.includes(userIdentifier);
            const isUnhelpful = review.unhelpfulBy.includes(userIdentifier);

            if (type === 'helpful') {
                if (isHelpful) {
                    review.helpfulBy = review.helpfulBy.filter(u => u !== userIdentifier);
                    review.helpful = Math.max(0, review.helpful - 1);
                } else {
                    review.helpfulBy.push(userIdentifier);
                    review.helpful += 1;

                    if (isUnhelpful) {
                        review.unhelpfulBy = review.unhelpfulBy.filter(u => u !== userIdentifier);
                        review.unhelpful = Math.max(0, review.unhelpful - 1);
                    }
                }
            } else {
                if (isUnhelpful) {
                    review.unhelpfulBy = review.unhelpfulBy.filter(u => u !== userIdentifier);
                    review.unhelpful = Math.max(0, review.unhelpful - 1);
                } else {
                    review.unhelpfulBy.push(userIdentifier);
                    review.unhelpful += 1;

                    if (isHelpful) {
                        review.helpfulBy = review.helpfulBy.filter(u => u !== userIdentifier);
                        review.helpful = Math.max(0, review.helpful - 1);
                    }
                }
            }

            await review.save();

            res.json({ success: true, review });
        } catch (err) {
            console.log("Error updating review feedback:", err);
            res.status(500).json({ success: false, error: "Error updating review feedback" });
        }
    },

    // Mark review as helpful
    markHelpful: function (req, res) {
        return this.toggleReviewFeedback(req, res, 'helpful');
    },

    // Mark review as unhelpful
    markUnhelpful: function (req, res) {
        return this.toggleReviewFeedback(req, res, 'unhelpful');
    },

    // Create owner response
    createOwnerResponse: async function (req, res) {
        try {
            const { username, responseText } = req.body;
            if (!username || !responseText) {
                return res.status(400).json({ error: 'Missing username or responseText' });
            }

            const user = await User.findOne({ username });
            if (!user || user.accountType !== 'owner' || !user.establishmentId) {
                return res.status(403).json({ error: 'Only owners can respond to reviews' });
            }

            const review = await Review.findById(req.params.id);
            if (!review) {
                return res.status(404).json({ error: 'Review not found' });
            }

            // Owner can only respond to reviews that belong to their establishment
            if (review.establishment.toString() !== user.establishmentId.toString()) {
                return res.status(403).json({ error: 'Not authorized to respond to this review' });
            }

            // Check if owner response already exists
            if (review.ownerResponse) {
                return res.status(400).json({ error: 'Owner response already exists for this review' });
            }

            const ownerResponse = new OwnerResponse({
                review: review._id,
                owner: user._id,
                text: responseText
            });

            await ownerResponse.save();

            review.ownerResponse = ownerResponse._id;
            await review.save();

            res.json({ success: true, review });
        } catch (err) {
            console.log('Error saving owner response:', err);
            res.status(500).json({ success: false, error: 'Error saving owner response' });
        }
    },

    // Update owner response
    updateOwnerResponse: async function (req, res) {
        try {
            const { username, responseText } = req.body;
            if (!username || !responseText) {
                return res.status(400).json({ error: 'Missing username or responseText' });
            }

            const user = await User.findOne({ username });
            if (!user || user.accountType !== 'owner' || !user.establishmentId) {
                return res.status(403).json({ error: 'Only owners can update responses' });
            }

            const review = await Review.findById(req.params.id).populate('ownerResponse');
            if (!review) {
                return res.status(404).json({ error: 'Review not found' });
            }

            // Owner can only update responses for their establishment
            if (review.establishment.toString() !== user.establishmentId.toString()) {
                return res.status(403).json({ error: 'Not authorized to update this response' });
            }

            // Check if owner response exists
            if (!review.ownerResponse) {
                return res.status(404).json({ error: 'Owner response not found' });
            }

            // Update the response
            review.ownerResponse.text = responseText;
            await review.ownerResponse.save();

            res.json({ success: true, review });
        } catch (err) {
            console.log('Error updating owner response:', err);
            res.status(500).json({ success: false, error: 'Error updating owner response' });
        }
    },

    // Delete owner response
    deleteOwnerResponse: async function (req, res) {
        try {
            const { username } = req.body;
            if (!username) {
                return res.status(400).json({ error: 'Missing username' });
            }

            const user = await User.findOne({ username });
            if (!user || user.accountType !== 'owner' || !user.establishmentId) {
                return res.status(403).json({ error: 'Only owners can delete responses' });
            }

            const review = await Review.findById(req.params.id).populate('ownerResponse');
            if (!review) {
                return res.status(404).json({ error: 'Review not found' });
            }

            // Owner can only delete responses for their establishment
            if (review.establishment.toString() !== user.establishmentId.toString()) {
                return res.status(403).json({ error: 'Not authorized to delete this response' });
            }

            // Check if owner response exists
            if (!review.ownerResponse) {
                return res.status(404).json({ error: 'Owner response not found' });
            }

            // Delete the response
            await OwnerResponse.findByIdAndDelete(review.ownerResponse._id);

            // Remove reference from review
            review.ownerResponse = null;
            await review.save();

            res.json({ success: true });
        } catch (err) {
            console.log('Error deleting owner response:', err);
            res.status(500).json({ success: false, error: 'Error deleting owner response' });
        }
    },

    // Delete a review
    deleteReview: async function (req, res) {
        try {
            const review = await Review.findByIdAndDelete(req.params.id);
            if (!review) {
                return res.status(404).json({ error: "Review not found" });
            }
            res.json({ success: true });
        } catch (err) {
            console.log("Error deleting review:", err);
            res.status(500).json({ success: false, error: "Error deleting review" });
        }
    },

    // Report a review
    reportReview: async function (req, res) {
        try {
            const { userIdentifier, reason, details } = req.body;
            const reporterUsername = typeof userIdentifier === 'string' ? userIdentifier.trim() : '';
            const safeReason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'Inappropriate or fake review';
            const safeDetails = typeof details === 'string' ? details.trim() : '';
            if (!reporterUsername) {
                return res.status(400).json({ error: 'Missing userIdentifier' });
            }

            const reporter = await User.findOne({ username: reporterUsername });
            if (!reporter) {
                return res.status(401).json({ error: 'Login required to report reviews' });
            }

            const review = await Review.findById(req.params.id);
            if (!review) {
                return res.status(404).json({ error: 'Review not found' });
            }

            const reportedUserId = review.user && review.user.toString ? review.user.toString() : '';
            if (!reportedUserId) {
                return res.status(400).json({ error: 'Review author not found' });
            }

            if (reporter._id.toString() === reportedUserId) {
                return res.status(400).json({ error: 'Cannot report your own review' });
            }

            const existingPendingReport = Array.isArray(review.reports)
                ? review.reports.find(r => r.reporter === reporterUsername && r.status === 'pending')
                : null;

            if (existingPendingReport) {
                existingPendingReport.reason = safeReason;
                existingPendingReport.details = safeDetails;
                existingPendingReport.createdAt = new Date();
            } else {
                review.reports.push({
                    reporter: reporterUsername,
                    reason: safeReason,
                    details: safeDetails
                });
            }

            await review.save();

            const updatedUserReport = await UserReport.findOneAndUpdate(
                {
                    reporter: reporter._id,
                    reportedUser: reportedUserId,
                    status: 'pending'
                },
                {
                    $set: {
                        reason: safeReason,
                        details: safeDetails,
                        lastReportedAt: new Date(),
                        status: 'pending'
                    },
                    $setOnInsert: {
                        reporter: reporter._id,
                        reportedUser: reportedUserId
                    },
                    $inc: { reportCount: 1 }
                },
                { upsert: true, new: true, setDefaultsOnInsert: false }
            );

            await User.findByIdAndUpdate(reportedUserId, {
                $inc: { warningCount: 1 },
                $set: {
                    isWarned: true,
                    lastWarningReason: safeReason,
                    lastWarningAt: new Date()
                }
            });

            res.json({
                success: true,
                review,
                routeVersion: 'review-report-v2',
                userReport: {
                    id: updatedUserReport?._id || null,
                    reportCount: updatedUserReport?.reportCount || 1,
                    status: updatedUserReport?.status || 'pending',
                    lastReportedAt: updatedUserReport?.lastReportedAt || new Date()
                }
            });
        } catch (err) {
            console.log('Error reporting review:', err);
            res.status(500).json({ success: false, error: 'Error reporting review' });
        }
    },

    // Hide or unhide a review
    toggleReviewVisibility: async function (req, res) {
        try {
            const { userIdentifier, action } = req.body;
            const viewerUsername = typeof userIdentifier === 'string' ? userIdentifier.trim() : '';
            if (!viewerUsername) {
                return res.status(400).json({ error: 'Missing userIdentifier' });
            }

            const viewer = await User.findOne({ username: viewerUsername });
            if (!viewer) {
                return res.status(401).json({ error: 'Login required to hide reviews' });
            }

            const review = await Review.findById(req.params.id);
            if (!review) {
                return res.status(404).json({ error: 'Review not found' });
            }

            review.hiddenBy = Array.isArray(review.hiddenBy) ? review.hiddenBy : [];

            if (action === 'hide') {
                if (!review.hiddenBy.includes(viewerUsername)) {
                    review.hiddenBy.push(viewerUsername);
                }
            } else if (action === 'unhide') {
                review.hiddenBy = review.hiddenBy.filter(id => id !== viewerUsername);
            } else {
                return res.status(400).json({ error: 'Invalid hide action' });
            }

            await review.save();
            res.json({ success: true, review });
        } catch (err) {
            console.log('Error updating review hide state:', err);
            res.status(500).json({ success: false, error: 'Error updating review hide state' });
        }
    }
};

module.exports = reviewController;