const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./model/userModel");
const Establishment = require("./model/establishmentModel");
const Review = require("./model/reviewModel");
const OwnerResponse = require("./model/ownerResponseModel");
const BlockedUser = require("./model/blockedUserModel");

async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

mongoose.connect("mongodb://127.0.0.1:27017/PlatePalDB")
.then(async function () {
    console.log("Connected to MongoDB for seeding");

    await User.deleteMany({});
    await Establishment.deleteMany({});
    await Review.deleteMany({});
    await OwnerResponse.deleteMany({});
    await BlockedUser.deleteMany({});

    // Hash passwords before inserting
    const hashedPassword = await hashPassword("1234");

    const users = await User.insertMany([
        {
            username: "chelsea",
            email: "chelsea@example.com",
            password: hashedPassword,
            bio: "Food lover",
            profilePic: "/images/default-profile.png"
        },
        {
            username: "alex",
            email: "alex@example.com",
            password: hashedPassword,
            bio: "Always looking for new cafes",
            profilePic: "/images/default-profile.png"
        },
        {
            username: "jamie",
            email: "jamie@example.com",
            password: hashedPassword,
            bio: "I love ramen",
            profilePic: "/images/default-profile.png"
        },
        {
            username: "mika",
            email: "mika@example.com",
            password: hashedPassword,
            bio: "Dessert enthusiast",
            profilePic: "/images/default-profile.png"
        },
        {
            username: "ryan",
            email: "ryan@example.com",
            password: hashedPassword,
            bio: "Trying every restaurant in town",
            profilePic: "/images/default-profile.png"
        },
        {
            username: "sakura_owner",
            email: "sakura@example.com",
            password: hashedPassword,
            bio: "Owner of Sakura Ramen House",
            profilePic: "/images/default-profile.png",
            accountType: "owner"
        },
        {
            username: "seoul_owner",
            email: "seoul@example.com",
            password: hashedPassword,
            bio: "Owner of Seoul Garden Grill",
            profilePic: "/images/default-profile.png",
            accountType: "owner"
        }
    ]);

    const establishments = await Establishment.insertMany([
        {
            name: "Sakura Ramen House",
            cuisine: "Japanese",
            location: "Manila",
            latitude: 14.5995,
            longitude: 120.9842,
            rating: 4.5,
            reviewCount: 5,
            description: "Authentic ramen and rice bowls.",
            image: "/images/sakura-ramen.jpg"
        },
        {
            name: "Seoul Garden Grill",
            cuisine: "Korean",
            location: "Quezon City",
            latitude: 14.6760,
            longitude: 121.0437,
            rating: 4.3,
            reviewCount: 5,
            description: "Korean barbecue and side dishes.",
            image: "/images/seoul-garden.jpg"
        },
        {
            name: "La Piazza Bistro",
            cuisine: "Italian",
            location: "Makati",
            latitude: 14.5547,
            longitude: 121.0244,
            rating: 4.6,
            reviewCount: 5,
            description: "Pasta, pizza, and desserts.",
            image: "/images/la-piazza.jpg"
        },
        {
            name: "Burger Hub",
            cuisine: "American",
            location: "Pasig",
            latitude: 14.5764,
            longitude: 121.0851,
            rating: 4.1,
            reviewCount: 5,
            description: "Burgers, fries, and milkshakes.",
            image: "/images/burger-hub.jpg"
        },
        {
            name: "Cafe Bloom",
            cuisine: "Cafe",
            location: "Taguig",
            latitude: 14.5176,
            longitude: 121.0437,
            rating: 4.7,
            reviewCount: 5,
            description: "Coffee, pastries, and brunch meals.",
            image: "/images/cafe-bloom.jpg"
        }
    ]);

    // Link owners to establishments
    await User.findOneAndUpdate({username: "sakura_owner"}, {establishmentId: establishments[0]._id});
    await User.findOneAndUpdate({username: "seoul_owner"}, {establishmentId: establishments[1]._id});

    const reviews = await Review.insertMany([
        {
            user: users[0]._id,
            establishment: establishments[0]._id,
            title: "Great ramen",
            comment: "The broth was rich and flavorful.",
            rating: 5
        },
        {
            user: users[1]._id,
            establishment: establishments[0]._id,
            title: "Perfect noodles",
            comment: "Noodles had the right chew and the pork was tender.",
            rating: 5
        },
        {
            user: users[2]._id,
            establishment: establishments[0]._id,
            title: "Cozy ramen spot",
            comment: "Loved the atmosphere and quick service.",
            rating: 4
        },
        {
            user: users[3]._id,
            establishment: establishments[0]._id,
            title: "Delicious bowl",
            comment: "The gyoza on the side was a great addition.",
            rating: 5
        },
        {
            user: users[4]._id,
            establishment: establishments[0]._id,
            title: "Ramen heaven",
            comment: "A strong favorite for true ramen lovers.",
            rating: 5
        },
        {
            user: users[0]._id,
            establishment: establishments[1]._id,
            title: "Nice grill place",
            comment: "The meat quality was good and the service was fast.",
            rating: 4
        },
        {
            user: users[1]._id,
            establishment: establishments[1]._id,
            title: "Great Korean food",
            comment: "The bibimbap was flavorful and the sides were plentiful.",
            rating: 5
        },
        {
            user: users[2]._id,
            establishment: establishments[1]._id,
            title: "Good value",
            comment: "Loved the barbecue set and the portions were generous.",
            rating: 4
        },
        {
            user: users[3]._id,
            establishment: establishments[1]._id,
            title: "Friendly servers",
            comment: "Staff were attentive and the food came out hot.",
            rating: 4
        },
        {
            user: users[4]._id,
            establishment: establishments[1]._id,
            title: "Flavorful kimchi",
            comment: "The kimchi was spicy and homemade-tasting.",
            rating: 5
        },
        {
            user: users[0]._id,
            establishment: establishments[2]._id,
            title: "Loved the pasta",
            comment: "The pasta was fresh and well-seasoned.",
            rating: 5
        },
        {
            user: users[1]._id,
            establishment: establishments[2]._id,
            title: "Cozy Italian vibe",
            comment: "A nice place for a relaxed dinner with friends.",
            rating: 4
        },
        {
            user: users[2]._id,
            establishment: establishments[2]._id,
            title: "Fantastic pizza",
            comment: "The pizza crust was crisp and the toppings were generous.",
            rating: 5
        },
        {
            user: users[3]._id,
            establishment: establishments[2]._id,
            title: "Elegant desserts",
            comment: "The tiramisu was rich and creamy.",
            rating: 5
        },
        {
            user: users[4]._id,
            establishment: establishments[2]._id,
            title: "Great service",
            comment: "Waitstaff were helpful and the ambiance was lovely.",
            rating: 5
        },
        {
            user: users[0]._id,
            establishment: establishments[3]._id,
            title: "Good burgers",
            comment: "The burger was juicy and filling.",
            rating: 4
        },
        {
            user: users[1]._id,
            establishment: establishments[3]._id,
            title: "Tasty fries",
            comment: "Fries were crispy and perfectly salted.",
            rating: 4
        },
        {
            user: users[2]._id,
            establishment: establishments[3]._id,
            title: "Chill hangout",
            comment: "A great spot for burgers and shakes.",
            rating: 4
        },
        {
            user: users[3]._id,
            establishment: establishments[3]._id,
            title: "Satisfying meal",
            comment: "Loved the variety of burger toppings.",
            rating: 5
        },
        {
            user: users[4]._id,
            establishment: establishments[3]._id,
            title: "Classic diner feel",
            comment: "The milkshake was thick and creamy.",
            rating: 5
        },
        {
            user: users[0]._id,
            establishment: establishments[4]._id,
            title: "Amazing cafe",
            comment: "The coffee and pastries were both excellent.",
            rating: 5
        },
        {
            user: users[1]._id,
            establishment: establishments[4]._id,
            title: "Lovely brunch",
            comment: "The avocado toast was fresh and delicious.",
            rating: 5
        },
        {
            user: users[2]._id,
            establishment: establishments[4]._id,
            title: "Cozy spot",
            comment: "Great place to relax with a latte and cake.",
            rating: 5
        },
        {
            user: users[3]._id,
            establishment: establishments[4]._id,
            title: "Fresh pastries",
            comment: "The croissant was buttery and flaky.",
            rating: 5
        },
        {
            user: users[4]._id,
            establishment: establishments[4]._id,
            title: "Friendly baristas",
            comment: "Service was warm and the drinks were well-crafted.",
            rating: 5
        }
    ]);

    // Create owner responses
    const sakuraOwner = await User.findOne({username: "sakura_owner"});
    const seoulOwner = await User.findOne({username: "seoul_owner"});

    const ownerResponses = await OwnerResponse.insertMany([
        {
            review: reviews[0]._id, // First review on Sakura
            owner: sakuraOwner._id,
            text: "Thank you for your kind words! We're glad you enjoyed the ramen."
        },
        {
            review: reviews[1]._id, // Review on Seoul
            owner: seoulOwner._id,
            text: "We appreciate your feedback on our meat quality and service."
        }
    ]);

    // Update reviews with owner responses
    await Review.findByIdAndUpdate(reviews[0]._id, { ownerResponse: ownerResponses[0]._id });
    await Review.findByIdAndUpdate(reviews[1]._id, { ownerResponse: ownerResponses[1]._id });

    console.log("Seeding complete");
    mongoose.connection.close();
})
.catch(function (err) {
    console.log("Seeding error:", err);
    mongoose.connection.close();
});