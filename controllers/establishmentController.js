const Establishment = require("../model/establishmentModel");
const Review = require("../model/reviewModel");
const BlockedUser = require("../model/blockedUserModel");
const User = require("../model/userModel");

const establishmentController = {
    // Render establishments page
    getEstablishmentsPage: async function (req, res) {
        try {
            const establishments = await Establishment.find().lean();
            console.log("Establishments found:", establishments);
            res.render("establishments", { establishments: establishments });
        } catch (err) {
            console.log("Error loading establishments:", err);
            res.send("Error loading establishments");
        }
    },

    // Get all establishments with review stats
    getAllEstablishments: async function (req, res) {
        try {
            const establishments = await Establishment.find().lean();

            const establishmentIds = establishments.map(e => e._id);
            const stats = await Review.aggregate([
                { $match: { establishment: { $in: establishmentIds } } },
                {
                    $group: {
                        _id: "$establishment",
                        reviewCount: { $sum: 1 },
                        averageRating: { $avg: "$rating" }
                    }
                }
            ]);

            const statsByEstablishment = new Map(
                stats.map(s => [s._id.toString(), s])
            );

            const establishmentsWithStats = establishments.map(establishment => {
                const stat = statsByEstablishment.get(establishment._id.toString());
                if (!stat) {
                    return { ...establishment, reviewCount: 0 };
                }

                return {
                    ...establishment,
                    reviewCount: stat.reviewCount,
                    rating: Number(stat.averageRating.toFixed(1))
                };
            });

            res.json(establishmentsWithStats);
        } catch (err) {
            console.log("Error loading establishments:", err);
            res.status(500).json({ error: "Error loading establishments" });
        }
    },

    // Get single establishment with stats
    getEstablishmentById: async function (req, res) {
        try {
            const establishment = await Establishment.findById(req.params.id).lean();
            if (!establishment) {
                return res.status(404).json({ error: "Establishment not found" });
            }

            const [reviewCount, ratingAgg] = await Promise.all([
                Review.countDocuments({ establishment: establishment._id }),
                Review.aggregate([
                    { $match: { establishment: establishment._id } },
                    { $group: { _id: null, averageRating: { $avg: "$rating" } } }
                ])
            ]);

            let rating = establishment.rating;
            if (ratingAgg.length > 0 && typeof ratingAgg[0].averageRating === 'number') {
                rating = Number(ratingAgg[0].averageRating.toFixed(1));
            }

            res.json({
                ...establishment,
                rating,
                reviewCount
            });
        } catch (err) {
            console.log("Error loading establishment:", err);
            res.status(500).json({ error: "Error loading establishment" });
        }
    },

    // Get reviews for an establishment
    getEstablishmentReviews: async function (req, res) {
        try {
            const currentUsername = req.query.currentUser;
            let reviews = await Review.find({ establishment: req.params.id }).populate('user', 'username profilePic').populate('ownerResponse').lean();

            // If currentUser is provided, filter out reviews from blocked users
            if (currentUsername) {
                const currentUser = await User.findOne({ username: currentUsername });
                if (currentUser) {
                    const blockedUsers = await BlockedUser.find({ blocker: currentUser._id }).select('blocked').lean();
                    const blockedIds = blockedUsers.map(b => b.blocked.toString());
                    reviews = reviews.filter(r => !blockedIds.includes(r.user._id.toString()));
                }
            }

            // If viewerId is provided, hide reviews this viewer chose to hide
            const viewerId = req.query.viewerId;
            if (viewerId) {
                reviews = reviews.filter(r => !Array.isArray(r.hiddenBy) || !r.hiddenBy.includes(viewerId));
            }

            res.json(reviews);
        } catch (err) {
            console.log("Error loading reviews:", err);
            res.status(500).json({ error: "Error loading reviews" });
        }
    }
};

module.exports = establishmentController;