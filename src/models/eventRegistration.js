const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        required: true
    },
    email: {
        type: String,
        trim: true,
        required: true
    },
    number: {
        type: String,
        trim: true
    },

    total_attendee: {
        type: Number,
        default: 1,
        min: 1
    },
    status: {
        type: String,
        enum: ['confirmed', 'cancelled', 'waitlisted'],
        default: 'confirmed'
    },
    event_name: {
        type: String,
        trim: true,
        default: ''
    },
    event_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true,
        index: true
    },
    user: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
                default: null  // ← change from implicit undefined to null

        },
        name: { type: String, default: '' }
    }
}, { timestamps: true });

eventRegistrationSchema.index({ event_id: 1, email: 1 }, { unique: true });
eventRegistrationSchema.index({ event_id: 1, number: 1 }, { unique: true, sparse: true }); 

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);