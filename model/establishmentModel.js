const mongoose = require("mongoose");

const establishmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    cuisine: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    latitude: {
        type: Number,
        default: null
    },
    longitude: {
        type: Number,
        default: null
    },
    rating: {
        type: Number,
        default: 0
    },
    reviewCount: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        default: ""
    },
    image: {
        type: String,
        default: ""
    }
});

module.exports = mongoose.model("Establishment", establishmentSchema);