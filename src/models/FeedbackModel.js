const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    id: {
        type: String,
        unique: true,
        sparse: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    member_id: {
        type: String,
        required: true
    }
}, {
    timestamps: true

})

module.exports = mongoose.model('Feedback', feedbackSchema);