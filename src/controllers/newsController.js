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

const findNews = (req, id) => News.findOne(
    isObjectId(id) ? { _id: id } : null
);

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
        image: publicUrl(req, image),
        reporter_name: item.reporter_name || '',
        location: item.location || ''
    };
};

const newsPayload = (req, existing = {}) => {
    const title = req.body.title || existing.title || '';
    const description = req.body.description || existing.description || req.body.content || existing.content || '';

    const data = { ...req.body };
    delete data.image;

    return {
        ...data,
        id: existing.id || (existing._id ? String(existing._id) : undefined),
        title,
        description,
        content: req.body.content || description,
        reporter_name: req.body.reporter_name || existing.reporter_name || fullName(req.user) || req.user?.email || 'Admin',
        location: req.body.location || existing.location || 'Admin',
        category: req.body.category || existing.category || '',
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

        if (req.body.send_notification === 'true' || req.body.send_notification === true) {
            const imageUrl = news.image ? publicUrl(req, news.image) : '';
            createAndBroadcast({
                title: news.title,
                body: news.description?.slice(0, 150) || '',
                image: imageUrl,
                type: 'news',
                ref_id: String(news._id)
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
