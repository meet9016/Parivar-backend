const News = require('../models/newsModel');
const { apiResponse, fullName, publicUrl } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');
const { createAndBroadcast } = require('./notificationController');


const imageFromRequest = (req, fallback = '') => {
    if (req.file) return `/uploads/${req.file.filename}`;
    if (req.body.remove_image === 'true') return '';
    return req.body.image || fallback || '';
};

const isObjectId = (id) => require('mongoose').isValidObjectId(id);

const findNews = (req, id) => News.findOne({
    $or: [
        { id: String(id) },
        ...(isObjectId(id) ? [{ _id: id }] : [])
    ]
});

const formatNews = (req, item = {}) => {
    const image = item.image || item.image_url || '';

    return {
        _id: String(item._id),
        title: item.title || '',
        description: item.description || item.content || '',
        content: item.content || item.description || '',
        date: item.date || item.createdAt || '',
        cdate: item.cdate || (item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : ''),
        status: Number(item.status ?? 1),
        send_notification: item.send_notification !== false,
        target_type: item.target_type || 'all',
        target_users: Array.isArray(item.target_users) ? item.target_users.map(String) : [],
        reminder_sent: !!item.reminder_sent,
        image: publicUrl(req, image),
        reporter_name: item.reporter_name || '',
        location: item.location || ''
    };
};

const newsPayload = (req, existing = {}) => {
    const title = req.body.title || existing.title || '';
    const description = req.body.description || existing.description || req.body.content || existing.content || '';

    let target_users = req.body.target_user_ids || req.body.target_users;
    if (typeof target_users === 'string') {
        try {
            target_users = JSON.parse(target_users);
        } catch (_) {
            target_users = target_users.split(',').map(s => s.trim()).filter(Boolean);
        }
    }
    if (!Array.isArray(target_users)) {
        target_users = existing.target_users || [];
    }

    const send_notification = req.body.send_notification !== undefined
        ? (req.body.send_notification === true || req.body.send_notification === 'true')
        : (existing.send_notification !== undefined ? existing.send_notification : true);

    const target_type = req.body.target_type || req.body.target_audience || existing.target_type || 'all';

    const data = { ...req.body };
    delete data.image;

    return {
        ...data,
        id: existing.id || (existing._id ? String(existing._id) : undefined),
        title,
        description,
        content: req.body.content || description,
        date: req.body.date ? new Date(req.body.date) : (existing.date || new Date()),
        reporter_name: req.body.reporter_name || existing.reporter_name || fullName(req.user) || req.user?.email || 'Admin',
        location: req.body.location || existing.location || 'Admin',
        category: req.body.category || existing.category || '',
        status: req.body.status !== undefined ? Number(req.body.status) : (existing.status !== undefined ? Number(existing.status) : 1),
        send_notification,
        target_type,
        target_users,
        reminder_sent: req.body.reminder_sent !== undefined ? Boolean(req.body.reminder_sent) : (existing.reminder_sent || false),
        image: imageFromRequest(req, existing.image || (typeof existing.image === 'string' ? existing.image : '')),
        cdate: existing.cdate || new Date().toISOString().slice(0, 10)
    };
};

const getNewsList = async (req, res) => {
    try {
        const { data, pagination } = await queryHelper(News, req.query, {
            searchFields: ['title', 'description', 'content', 'category', 'reporter_name', 'location'],
            filterFields: ['category', 'reporter_name', 'location', 'status']
        });
        return apiResponse(res, 200, 'News retrieved successfully', data.map((item) => formatNews(req, item)), pagination);
    } catch (error) {
        return apiResponse(res, 500, 'Error retrieving news', { error: error.message });
    }
};

const getNewsById = async (req, res) => {
    try {
        const news = await findNews(req, req.params.id).lean();
        if (!news) {
            return apiResponse(res, 404, 'News not found');
        }
        return apiResponse(res, 200, 'News retrieved successfully', formatNews(req, news));
    } catch (error) {
        return apiResponse(res, 500, 'Error retrieving news', { error: error.message });
    }
};

const addNews = async (req, res) => {
    try {
        const data = newsPayload(req);

        const news = new News({
            ...data
        });
        await news.save();

        // Send notification if requested
        if (req.body.send_notification !== 'false' && req.body.send_notification !== false) {
            const imageUrl = news.image ? publicUrl(req, news.image) : '';
            const newsDate = news.date || news.cdate || news.createdAt || '';
            const target_type = req.body.target_type || req.body.target_audience || 'all';
            const target_users = req.body.target_user_ids || req.body.target_users || [];

            createAndBroadcast({
                title: news.title,
                body: news.description?.slice(0, 150) || '',
                image: imageUrl,
                type: 'news',
                ref_id: String(news._id),
                date: newsDate,
                target_type,
                target_users
            });
        }

        return apiResponse(res, 201, 'News saved successfully', formatNews(req, news.toObject()));
    } catch (error) {
        return apiResponse(res, 400, error.message || 'Error saving news');
    }
};


const updateNews = async (req, res) => {
    try {
        const news = await findNews(req, req.params.id);
        if (!news) {
            return apiResponse(res, 404, 'News not found');
        }

        news.set(newsPayload(req, news));
        await news.save();

        return apiResponse(res, 200, 'News saved successfully', formatNews(req, news.toObject()));
    } catch (error) {
        return apiResponse(res, 400, error.message || 'Error saving news');
    }
};

const deleteNews = async (req, res) => {
    try {
        const news = await findNews(req, req.params.id);
        if (!news) {
            return apiResponse(res, 404, 'News not found');
        }
        await news.deleteOne();
        return apiResponse(res, 200, 'News deleted successfully');
    } catch (error) {
        return apiResponse(res, 500, 'Error deleting news', { error: error.message });
    }
};

module.exports = {
    getNewsList,
    getNewsById,
    addNews,
    updateNews,
    deleteNews
};
