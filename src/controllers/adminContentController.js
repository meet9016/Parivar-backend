const mongoose = require('mongoose');
const GalleryCategory = require('../models/galleryCategoryModel');
const Banner = require('../models/bannerModel');
const ContactInquiry = require('../models/contactInquiryModel');
const BusinessCategory = require('../models/businessCategoryModel');
const Country = require('../models/countryModel');
const State = require('../models/stateModel');
const City = require('../models/cityModel');
const Master = require('../models/masterModel');
const { apiResponse, publicUrl } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

const isObjectId = (id) => mongoose.isValidObjectId(id);

const nextPublicId = async (Model, prefix = '') => {
  const count = await Model.countDocuments();
  return `${prefix}${Date.now()}${count}`;
};

const findById = (Model, id, extraQuery = {}) => Model.findOne({
  ...extraQuery,
  $or: [
    { id: String(id) },
    ...(isObjectId(id) ? [{ _id: id }, { _id: new mongoose.Types.ObjectId(id) }] : [])
  ]
});

const imageFromRequest = (req, fallback = '') => {
  if (req.file) return `/uploads/${req.file.filename}`;
  if (Array.isArray(req.body.images) && req.body.images[0]) return req.body.images[0];
  return req.body.image || req.body.image_url || fallback || '';
};

const listContent = (Model, formatter, label) => async (req, res) => {
  try {
    const { data, pagination } = await queryHelper(Model, req.query, {
      searchFields: ['title', 'subtitle', 'name', 'email', 'phone', 'subject', 'message', 'category', 'year'],
      filterFields: ['status', 'category', 'year']
    });
    return apiResponse(res, 200, `${label} retrieved successfully`, data.map((row) => formatter(req, row)), pagination);
  } catch (error) {
    return apiResponse(res, 500, `Error retrieving ${label.toLowerCase()}`, { error: error.message });
  }
};

const deleteContent = (Model, label,) => async (req, res) => {
  try {
    const existing = await findById(Model, req.params.id);
    if (!existing) return apiResponse(res, 404, `${label} not found`);
    await existing.deleteOne();
    return apiResponse(res, 200, `${label} deleted successfully`);
  } catch (error) {
    return apiResponse(res, 500, `Error deleting ${label.toLowerCase()}`, { error: error.message });
  }
};





const galleryPayload = (req, existing = {}) => {
  return {
    ...req.body,

    image: imageFromRequest(req, existing.image),
    category: req.body.category || req.body.event_category || existing.category || 'General',
    year: req.body.year || existing.year || ''
  };
};

const bannerPayload = (req, existing = {}) => ({
  ...req.body,
  title: req.body.title || existing.title || '',
  subtitle: req.body.subtitle || existing.subtitle || '',
  image: imageFromRequest(req, existing.image),
  link: req.body.link || existing.link || ''
});

const saveContent = (Model, payloadBuilder, formatter, label, prefix) => async (req, res) => {
  try {
    const existing = req.params.id ? await findById(Model, req.params.id) : null;
    const payload = payloadBuilder(req, existing || {});
    if (!payload.title && ['Event', 'Festival', 'Gallery'].includes(label)) {
      return apiResponse(res, 400, `${label} title is required`);
    }
    if (!payload.description && ['Event', 'Festival'].includes(label)) {
      return apiResponse(res, 400, `${label} description is required`);
    }
    const hasGalleryImages = Array.isArray(req.body.images) && req.body.images.length > 0;
    if (!payload.image && label === 'Gallery' && !hasGalleryImages) {
      return apiResponse(res, 400, 'Gallery image is required');
    }
    if (label === 'Gallery' && !existing && hasGalleryImages) {
      const docs = await Promise.all(req.body.images.map(async (image, index) => {
        const doc = new Model();
        if (!doc.id) doc.id = await nextPublicId(Model, `${prefix}${index}_`);
        const galleryDocPayload = { ...payload, image };
        delete galleryDocPayload.images;
        doc.set(galleryDocPayload);
        doc.set('status', req.body.status !== undefined ? Number(req.body.status) : 1);
        await doc.save();
        return formatter(req, doc.toObject());
      }));
      return apiResponse(res, 201, 'Gallery saved successfully', docs);
    }
    const doc = existing || new Model();
    if (!doc.id) doc.id = await nextPublicId(Model, prefix);
    delete payload.images;
    doc.set(payload);
    if (!existing) {
      doc.set('status', req.body.status !== undefined ? Number(req.body.status) : 1);
    } else if (req.body.status !== undefined) {
      doc.set('status', Number(req.body.status));
    }
    await doc.save();
    return apiResponse(res, existing ? 200 : 201, `${label} saved successfully`, formatter(req, doc.toObject()));
  } catch (error) {
    return apiResponse(res, 500, `Error saving ${label.toLowerCase()}`, { error: error.message });
  }
};




const formatBanner = (req, item) => ({
  id: item.id || String(item._id),
  title: item.title || '',
  subtitle: item.subtitle || '',
  image: publicUrl(req, item.image || ''),
  link: item.link || '',
  status: Number(item.status ?? 1)
});

const formatInquiry = (req, item) => ({
  id: item.id || String(item._id),
  name: item.name || '',
  email: item.email || '',
  phone: item.phone || '',
  subject: item.subject || '',
  message: item.message || '',
  status: Number(item.status ?? 1),
  createdAt: item.createdAt || ''
});

const saveInquiry = async (req, res) => {
  try {
    const existing = req.params.id ? await findById(ContactInquiry, req.params.id) : null;
    const doc = existing || new ContactInquiry();
    if (!existing) doc.id = await nextPublicId(ContactInquiry, 'INQ');
    doc.set(req.body);
    if (!existing) {
      doc.set('status', req.body.status !== undefined ? Number(req.body.status) : 1);
    } else if (req.body.status !== undefined) {
      doc.set('status', Number(req.body.status));
    }
    await doc.save();
    return apiResponse(res, existing ? 200 : 201, 'Contact inquiry saved successfully', formatInquiry(req, doc.toObject()));
  } catch (error) {
    return apiResponse(res, 500, 'Error saving contact inquiry', { error: error.message });
  }
};

const masterConfig = {
  business: { Model: BusinessCategory, nameKeys: ['business', 'name'], parentKey: 'state_id', skipCustomId: true },
  country: { Model: Country, nameKeys: ['country', 'name'], skipCustomId: true },
  state: { Model: State, nameKeys: ['state', 'name'], parentKey: 'country_id', skipCustomId: true },
  city: { Model: City, nameKeys: ['city', 'name'], parentKey: 'state_id', skipCustomId: true },
  district: { Model: Master, type: 'district' },
  taluka: { Model: Master, type: 'taluka' },
  village: { Model: Master, type: 'village' },
  area: { Model: Master, type: 'area' },
  'blood-group': { Model: Master, type: 'blood-group' },
  'event-category': { Model: Master, type: 'event-category' },
  'gallery-category': { Model: GalleryCategory, nameKeys: ['category'], skipCustomId: true },
  'expense-category': { Model: Master, type: 'expense-category' }
};

const formatMaster = (type, item, config, parentMap = {}) => {
  const name = config.nameKeys?.map((key) => item[key]).find(Boolean) || item.name || '';
  const parentVal = String(config.parentKey ? item[config.parentKey] || '' : item.parent_id || '');
  const parentName = parentMap[parentVal] || (typeof parentVal === 'object' ? parentVal.name : '') || '';
  return {
    id: String(item._id),
    type,
    name,
    parent_id: parentVal,
    parent_name: parentName,
    status: Number(item.status ?? 1),
    image: item.image || ''
  };
};

const getMasters = async (req, res) => {
  try {
    const type = req.params.type;
    const config = masterConfig[type];
    if (!config) return apiResponse(res, 404, 'Master type not found');
    const query = { ...(config.type ? { type: config.type } : {}) };
    if (req.query.parent_id && config.parentKey) query[config.parentKey] = String(req.query.parent_id);
    if (req.query.parent_id && config.type) query.parent_id = String(req.query.parent_id);
    if (req.query.status !== undefined && req.query.status !== null && req.query.status !== '') {
      const statusNum = Number(req.query.status);
      query.$or = [{ status: statusNum }, { status: String(statusNum) }];
    }

    const { data, pagination } = await queryHelper(config.Model, req.query, {
      baseQuery: query,
      searchFields: [...(config.nameKeys || ['name']), 'name']
    });

    const rawParentIds = data.map((item) => String(config.parentKey ? item[config.parentKey] || '' : item.parent_id || '')).filter(Boolean);
    const parentIds = Array.from(new Set(rawParentIds));
    const parentMap = {};
    if (parentIds.length > 0) {
      const validObjIds = parentIds.filter(id => mongoose.isValidObjectId(id));
      const queryCond = {
        $or: [
          ...(validObjIds.length > 0 ? [{ _id: { $in: validObjIds } }] : []),
          { id: { $in: parentIds } }
        ]
      };
      
      const [masterDocs, countryDocs, stateDocs, cityDocs] = await Promise.all([
        Master.find(queryCond).lean(),
        Country.find(queryCond).lean(),
        State.find(queryCond).lean(),
        City.find(queryCond).lean()
      ]);

      [...masterDocs, ...countryDocs, ...stateDocs, ...cityDocs].forEach((p) => {
        const pName = p.name || p.country || p.state || p.city || p.district || p.taluka || p.village || '';
        if (pName) {
          if (p._id) parentMap[String(p._id)] = pName;
          if (p.id) parentMap[String(p.id)] = pName;
        }
      });
    }

    return apiResponse(res, 200, 'Master data retrieved successfully', data.map((row) => formatMaster(type, row, config, parentMap)), pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving master data', { error: error.message });
  }
};

const getMasterById = async (req, res) => {
  try {
    const type = req.params.type;
    const config = masterConfig[type];
    if (!config) return apiResponse(res, 404, 'Master type not found');
    const existing = await findById(config.Model, req.params.id);
    if (!existing) return apiResponse(res, 404, 'Master data not found');
    return apiResponse(res, 200, 'Master data retrieved successfully', formatMaster(type, existing.toObject(), config));
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving master data', { error: error.message });
  }
};

const saveMaster = async (req, res) => {
  try {
    const type = req.params.type;
    const config = masterConfig[type];
    const existing = req.params.id ? await findById(config.Model, req.params.id) : null;
    const name = req.body.name || req.body[type] || req.body.business || req.body.country || req.body.state || req.body.city || (existing ? (existing.name || existing.country || existing.state || existing.city || existing.category || existing.business || (config.nameKeys?.map(k => existing[k]).find(Boolean))) : '');
    
    if (!existing && !name) return apiResponse(res, 400, 'Name is required');
    const doc = existing || new config.Model();
    if (!existing && !config.skipCustomId) doc.id = await nextPublicId(config.Model, `${type.toUpperCase()}_`);
    if (config.type) {
      doc.type = config.type;
      doc.name = name;
      doc.parent_id = req.body.parent_id || '';
    } else {
      const primaryNameKey = config.nameKeys[0];
      doc[primaryNameKey] = name;
      doc.name = name;
      if (config.parentKey) doc[config.parentKey] = req.body.parent_id || req.body[config.parentKey] || doc[config.parentKey] || '';
    }
    const image = imageFromRequest(req, existing?.image);
    if (image || req.body.remove_image) {
      doc.image = req.body.remove_image ? '' : image;
    }
    if (!existing) {
      doc.set('status', req.body.status !== undefined ? Number(req.body.status) : 1);
    } else if (req.body.status !== undefined) {
      doc.set('status', Number(req.body.status));
    }
    await doc.save();
    return apiResponse(res, existing ? 200 : 201, 'Master data saved successfully', formatMaster(type, doc.toObject(), config));
  } catch (error) {
    return apiResponse(res, 500, 'Error saving master data', { error: error.message });
  }
};

const deleteMaster = async (req, res) => {
  try {
    const type = req.params.type;
    const config = masterConfig[type];
    if (!config) return apiResponse(res, 404, 'Master type not found');
    const existing = await findById(config.Model, req.params.id);
    if (!existing) return apiResponse(res, 404, 'Master data not found');
    await existing.deleteOne();
    return apiResponse(res, 200, 'Master data deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting master data', { error: error.message });
  }
};


module.exports = {
  getBanners: listContent(Banner, formatBanner, 'Banners'),
  saveBanner: saveContent(Banner, bannerPayload, formatBanner, 'Banner', 'BAN'),
  deleteBanner: deleteContent(Banner, 'Banner'),
  getInquiries: listContent(ContactInquiry, formatInquiry, 'Contact inquiries'),
  saveInquiry,
  deleteInquiry: deleteContent(ContactInquiry, 'Contact inquiry'),
  getMasters,
  getMasterById,
  saveMaster,
  deleteMaster
};
