const Feedback = require('../models/FeedbackModel');
const { apiResponse, memberPublicId } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

const findFeedbackByRequestId = (id) =>
    Feedback.findOne({
        $or: [
            { id: String(id) },
            { _id: id.match(/^[a-f\d]{24}$/i) ? id : null }
        ]
    });

const formatFeedback = (f) => ({
    id: String(f._id),
    name: f.name || '',
    email: f.email || '',
    message: f.message || '',
    status: f.status !== undefined ? Number(f.status) : 1,
    createdAt: f.createdAt || '',
});

const getAllFeedback = async (req, res) => {
    try {
        const isAdmin = req.user?.committee_role === 'President';
        const currentMemberId = memberPublicId(req.user || {});

        const query = isAdmin ? {} : { member_id: currentMemberId };
        const { data: feedbacks, pagination } = await queryHelper(Feedback, req.query, {
            baseQuery: query,
            searchFields: ['name', 'email', 'message'],
            filterFields: ['member_id', 'status']
        });

        return apiResponse(res, 200, 'Feedbacks retrieved successfully', feedbacks.map(formatFeedback), pagination);
    } catch (error) {
        return apiResponse(res, 500, 'Error retrieving feedbacks', { error: error.message });
    }
};

const getFeedbackById = async (req, res) => {
    try {
        const feedback = await findFeedbackByRequestId(req.params.id);
        if (!feedback) return apiResponse(res, 404, 'Feedback not found');

        const isAdmin = req.user?.committee_role === 'President';
        const currentMemberId = memberPublicId(req.user || {});
        if (!isAdmin && feedback.member_id !== currentMemberId) {
            return apiResponse(res, 403, 'Unauthorized');
        }

        return apiResponse(res, 200, 'Feedback retrieved successfully', formatFeedback(feedback));
    } catch (error) {
        return apiResponse(res, 500, 'Error retrieving feedback', { error: error.message });
    }
};

const addFeedback = async (req, res) => {

    try {
        const { name, email, message, status } = req.body;

        // If this is a direct update by id (e.g. status toggle)
        if (req.params.id) {
            const feedback = await findFeedbackByRequestId(req.params.id);
            if (!feedback) return apiResponse(res, 404, 'Feedback not found');

            if (status !== undefined) feedback.status = Number(status);
            if (name) feedback.name = name;
            if (email) feedback.email = email;
            if (message) feedback.message = message;

            await feedback.save();
            return apiResponse(res, 200, 'Feedback updated successfully', formatFeedback(feedback));
        }

        if (!name || !email || !message) {
            return apiResponse(res, 400, 'Name, email, and message are required');
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const existingEmailFeedback = await Feedback.findOne({
            email: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        });

        if (existingEmailFeedback) {
            return apiResponse(res, 400, 'Feedback with this email has already been submitted');
        }

        const currentMemberId = memberPublicId(req.user || {});

        const doc = await Feedback.create({
            id: `FBK${Date.now()}`,
            member_id: currentMemberId || '',
            name,
            email,
            message,
            status: status !== undefined ? Number(status) : 1
        });

        return apiResponse(res, 201, 'Feedback submitted successfully', formatFeedback(doc));
    } catch (error) {
        return apiResponse(res, 500, 'Error saving feedback', { error: error.message });
    }
};

const deleteFeedback = async (req, res) => {
    try {
        const feedback = await findFeedbackByRequestId(req.params.id);
        if (!feedback) return apiResponse(res, 404, 'Feedback not found');

        const isAdmin = req.user?.committee_role === 'President';
        const currentMemberId = memberPublicId(req.user || {});
        if (!isAdmin && feedback.member_id !== currentMemberId) {
            return apiResponse(res, 403, 'Unauthorized - You can only delete your own feedback');
        }

        await Feedback.deleteOne({ _id: feedback._id });
        return apiResponse(res, 200, 'Feedback deleted successfully');
    } catch (error) {
        return apiResponse(res, 500, 'Error deleting feedback', { error: error.message });
    }
};

module.exports = { getAllFeedback, getFeedbackById, addFeedback, deleteFeedback };
