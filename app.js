const express = require("express");
const path = require("path");
const mongoose = require("mongoose");

const Establishment = require("./model/establishmentModel");
const User = require("./model/userModel");
const Review = require("./model/reviewModel");
const OwnerResponse = require("./model/ownerResponseModel");
const BlockedUser = require("./model/blockedUserModel");
const UserReport = require("./model/userReportModel");

// Import controllers
const establishmentController = require("./controllers/establishmentController");
const reviewController = require("./controllers/reviewController");
const userController = require("./controllers/userController");

const app = express();

/* ---------------- DATABASE CONNECTION ---------------- */



mongoose.connect("mongodb://127.0.0.1:27017/PlatePalDB")
.then(async () => {
    console.log("Connected to MongoDB");
})
.catch((err) => {
    console.log("MongoDB connection error:", err);
});

/* ---------------- EXPRESS SETTINGS ---------------- */

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, "public"), {
    etag: false,
    lastModified: false,
    setHeaders: function (res) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
}));

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

/* ---------------- HOME ROUTE ---------------- */

app.get("/", function (req, res) {
    res.render("PlatePal_Main");
});

/* ---------------- DATABASE ROUTE ---------------- */

app.get("/establishments", establishmentController.getEstablishmentsPage);

app.get("/establishments.html", establishmentController.getEstablishmentsPage);

/* ---------------- API ROUTES ---------------- */

console.log("defining routes");

app.get("/test", (req, res) => res.send("test"));

app.get("/api/establishments", establishmentController.getAllEstablishments);

app.get("/api/establishments/:id", establishmentController.getEstablishmentById);

app.get("/api/establishments/:id/reviews", establishmentController.getEstablishmentReviews);

app.post("/api/reviews", reviewController.createReview);

app.put("/api/reviews/:id", reviewController.updateReview);

app.post("/api/reviews/:id/helpful", reviewController.markHelpful);

app.post("/api/reviews/:id/unhelpful", reviewController.markUnhelpful);

app.post('/api/reviews/:id/owner-response', reviewController.createOwnerResponse);

// Update owner response
app.put('/api/reviews/:id/owner-response', reviewController.updateOwnerResponse);

// Delete owner response
app.delete('/api/reviews/:id/owner-response', reviewController.deleteOwnerResponse);

app.get("/api/users", userController.getAllUsers);

app.get("/api/users/username/:username", userController.getUserByUsername);

app.get("/api/users/:username/reviews", userController.getUserReviews);

app.get("/api/users/:username/owner-responses", userController.getOwnerResponses);

app.delete("/api/reviews/:id", reviewController.deleteReview);

/* ---------------- AUTH ROUTES ---------------- */

app.post("/login", userController.login);

app.post("/register", userController.register);

app.post("/change-password", userController.changePassword);

/* ---------------- BLOCK USER ROUTES ---------------- */

app.post("/api/block/:userId", userController.blockUser);

app.post("/api/unblock/:userId", userController.unblockUser);

/* ---------------- REVIEW REPORT / HIDE ROUTES ---------------- */

app.post('/api/reviews/:id/report', reviewController.reportReview);

app.post('/api/reviews/:id/hide', reviewController.toggleReviewVisibility);

app.get('/api/users/:username/blocked', userController.getBlockedUsers);

app.get('/api/users/:username/reported-reviews', userController.getReportedReviews);

app.get('/api/users/:username/reported-users', userController.getReportedUsers);

app.post('/api/users/:userId/report', userController.reportUser);

/* ---------------- STATIC PAGE ROUTES ---------------- */

const pages = {
  "/": "PlatePal_Main",
  "/PlatePal_Main.html": "PlatePal_Main",
  "/favorites": "favorites",
  "/favorites.html": "favorites",
  "/search-users": "search-users",
  "/search-users.html": "search-users",
  "/login": "login",
  "/login.html": "login",
  "/register": "register",
  "/register.html": "register",
  "/profile": "profile",
  "/profile.html": "profile",
  "/create-review": "create-review",
  "/create-review.html": "create-review",
  "/establishment-details": "establishment-details",
  "/establishment-details.html": "establishment-details",
  "/safety": "safety",
  "/safety.html": "safety",
  "/user-profile": "user-profile",
  "/user-profile.html": "user-profile",
  "/about": "about",
  "/about.html": "about"
};

Object.keys(pages).forEach((route) => {
  app.get(route, (req, res) => {
    res.render(pages[route]);
  });
});

/* ---------------- SERVER ---------------- */

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, function () {
    console.log(`Server running on http://localhost:${PORT}`);
});

server.on('error', function (err) {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the existing server or set a different PORT.`);
        return;
    }

    console.error('Server startup error:', err);
});