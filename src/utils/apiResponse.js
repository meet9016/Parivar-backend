const publicUrl = (req, value) => {
  if (!value) {
    return '';
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const normalized = value.startsWith('/') ? value : `/${value}`;
  return `${req.protocol}://${req.get('host')}${normalized}`;
};

const apiResponse = (res, status, message, data = [], pagination) => {
  const payload = {
    status,
    message,
    data
  };

  if (pagination) {
    payload.pagination = pagination;
  }

  return res.status(status).json(payload);
};

const fullName = (member = {}) => {
  return [member.first_name, member.middle_name, member.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
};

const memberPublicId = (member = {}) => {
  return String(member.member_id || member.id || member._id || '');
};

const toArchiveDate = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().replace(/\.\d{3}Z$/, '.000Z');
};

module.exports = {
  apiResponse,
  fullName,
  memberPublicId,
  publicUrl,
  toArchiveDate
};
