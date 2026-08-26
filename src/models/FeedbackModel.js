const { createTenantProxy } = require('../utils/tenantContext');
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
    },
    status: {
        type: Number,
        default: 1
    }
}, {
    timestamps: true

})

module.exports = createTenantProxy('Feedback', feedbackSchema);