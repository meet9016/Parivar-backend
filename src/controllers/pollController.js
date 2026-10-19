const Poll = require('../models/pollModel');
const PollVote = require('../models/pollVoteModel');
const { apiResponse, fullName, memberPublicId } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');
const mongoose = require('mongoose');

const findPollById = (id) => {
  if (!id) return null;
  const isObjectId = mongoose.Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(id);
  return Poll.findOne({
    $or: [
      { _id: isObjectId ? new mongoose.Types.ObjectId(id) : null },
      { id: String(id) }
    ]
  });
};

const formatPoll = (poll, userVote = null) => {
  const totalVotes = poll.total_votes || 0;
  const options = (poll.options || []).map(opt => {
    const votes = opt.votes_count || 0;
    const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
    return {
      id: opt.id,
      text: opt.text,
      votes_count: votes,
      percentage
    };
  });

  const now = new Date();
  const isExpired = poll.end_date ? new Date(poll.end_date) < now : false;

  return {
    _id: String(poll._id),
    id: poll.id || String(poll._id),
    title: poll.title,
    description: poll.description || '',
    poll_type: poll.poll_type || 'single',
    options,
    start_date: poll.start_date,
    end_date: poll.end_date,
    status: poll.status !== undefined ? Number(poll.status) : 1,
    is_expired: isExpired,
    is_anonymous: Boolean(poll.is_anonymous),
    total_votes: totalVotes,
    created_by: poll.created_by || null,
    has_voted: Boolean(userVote),
    user_votes: userVote ? userVote.selected_options : [],
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt
  };
};

/**
 * GET /api/polls - List all polls with pagination & search
 */
const getPolls = async (req, res) => {
  try {
    const currentMemberId = req.user ? memberPublicId(req.user) : null;
    const { data: polls, pagination } = await queryHelper(Poll, req.query, {
      baseQuery: {},
      searchFields: ['title', 'description'],
      filterFields: ['status', 'poll_type'],
      defaultSort: { createdAt: -1 }
    });

    let userVotesMap = {};
    if (currentMemberId && polls.length > 0) {
      const pollIds = polls.map(p => p._id);
      const votes = await PollVote.find({
        poll_id: { $in: pollIds },
        member_id: currentMemberId
      }).lean();
      votes.forEach(v => {
        userVotesMap[String(v.poll_id)] = v;
      });
    }

    const formatted = polls.map(p => formatPoll(p, userVotesMap[String(p._id)]));
    return apiResponse(res, 200, 'Polls retrieved successfully', formatted, pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving polls', { error: error.message });
  }
};

/**
 * GET /api/polls/:id - Single poll details
 */
const getPollById = async (req, res) => {
  try {
    const poll = await findPollById(req.params.id);
    if (!poll) return apiResponse(res, 404, 'Poll not found');

    const currentMemberId = req.user ? memberPublicId(req.user) : null;
    let userVote = null;
    if (currentMemberId) {
      userVote = await PollVote.findOne({ poll_id: poll._id, member_id: currentMemberId }).lean();
    }

    return apiResponse(res, 200, 'Poll retrieved successfully', formatPoll(poll, userVote));
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving poll', { error: error.message });
  }
};

/**
 * POST /api/polls - Create a new poll
 */
const createPoll = async (req, res) => {
  try {
    const { title, description, poll_type, options, start_date, end_date, status, is_anonymous } = req.body;

    if (!title || !String(title).trim()) {
      return apiResponse(res, 400, 'Poll title is required');
    }

    let parsedOptions = options;
    if (typeof options === 'string') {
      try {
        parsedOptions = JSON.parse(options);
      } catch (e) {
        parsedOptions = options.split('\n').map(t => t.trim()).filter(Boolean);
      }
    }

    if (!Array.isArray(parsedOptions) || parsedOptions.length < 2) {
      return apiResponse(res, 400, 'At least 2 options are required for a poll');
    }

    const formattedOptions = parsedOptions.map((opt, idx) => {
      const text = typeof opt === 'object' ? (opt.text || opt.title || '') : String(opt);
      const id = (typeof opt === 'object' && opt.id) ? opt.id : `opt_${idx + 1}_${Date.now()}`;
      return { id, text: text.trim(), votes_count: 0 };
    }).filter(opt => Boolean(opt.text));

    if (formattedOptions.length < 2) {
      return apiResponse(res, 400, 'At least 2 non-empty options are required');
    }

    const creatorId = req.user ? memberPublicId(req.user) : '';
    const creatorName = req.user ? (fullName(req.user) || req.user.name || 'Admin') : 'Admin';

    const poll = await Poll.create({
      id: `POL${Date.now()}`,
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
      poll_type: poll_type === 'multiple' ? 'multiple' : 'single',
      options: formattedOptions,
      start_date: start_date ? new Date(start_date) : new Date(),
      end_date: end_date ? new Date(end_date) : null,
      status: status !== undefined ? Number(status) : 1,
      is_anonymous: Boolean(is_anonymous),
      created_by: { id: creatorId, name: creatorName }
    });

    return apiResponse(res, 201, 'Poll created successfully', formatPoll(poll));
  } catch (error) {
    return apiResponse(res, 500, 'Error creating poll', { error: error.message });
  }
};

/**
 * PUT /api/polls/:id - Update an existing poll
 */
const updatePoll = async (req, res) => {
  try {
    const poll = await findPollById(req.params.id);
    if (!poll) return apiResponse(res, 404, 'Poll not found');

    const { title, description, poll_type, options, start_date, end_date, status, is_anonymous } = req.body;

    if (title !== undefined) poll.title = String(title).trim();
    if (description !== undefined) poll.description = String(description).trim();
    if (poll_type !== undefined) poll.poll_type = poll_type === 'multiple' ? 'multiple' : 'single';
    if (start_date !== undefined) poll.start_date = start_date ? new Date(start_date) : poll.start_date;
    if (end_date !== undefined) poll.end_date = end_date ? new Date(end_date) : null;
    if (status !== undefined) poll.status = Number(status);
    if (is_anonymous !== undefined) poll.is_anonymous = Boolean(is_anonymous);

    // If options are provided and poll has no votes yet, options can be updated
    if (options !== undefined) {
      let parsedOptions = options;
      if (typeof options === 'string') {
        try {
          parsedOptions = JSON.parse(options);
        } catch (e) {
          parsedOptions = options.split('\n').map(t => t.trim()).filter(Boolean);
        }
      }

      if (Array.isArray(parsedOptions) && parsedOptions.length >= 2) {
        // preserve existing option vote counts if option IDs match
        const existingMap = new Map((poll.options || []).map(o => [o.id, o.votes_count]));
        poll.options = parsedOptions.map((opt, idx) => {
          const text = typeof opt === 'object' ? (opt.text || opt.title || '') : String(opt);
          const id = (typeof opt === 'object' && opt.id) ? opt.id : `opt_${idx + 1}_${Date.now()}`;
          return {
            id,
            text: text.trim(),
            votes_count: existingMap.get(id) || 0
          };
        }).filter(o => Boolean(o.text));
      }
    }

    await poll.save();
    return apiResponse(res, 200, 'Poll updated successfully', formatPoll(poll));
  } catch (error) {
    return apiResponse(res, 500, 'Error updating poll', { error: error.message });
  }
};

/**
 * DELETE /api/polls/:id - Delete a poll and its votes
 */
const deletePoll = async (req, res) => {
  try {
    const poll = await findPollById(req.params.id);
    if (!poll) return apiResponse(res, 404, 'Poll not found');

    await PollVote.deleteMany({ poll_id: poll._id });
    await Poll.deleteOne({ _id: poll._id });

    return apiResponse(res, 200, 'Poll and its responses deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting poll', { error: error.message });
  }
};

/**
 * POST /api/polls/:id/vote - Cast a vote in a poll
 */
const submitVote = async (req, res) => {
  try {
    const poll = await findPollById(req.params.id);
    if (!poll) return apiResponse(res, 404, 'Poll not found');

    if (poll.status === 0) {
      return apiResponse(res, 400, 'This poll is closed or inactive');
    }

    if (poll.end_date && new Date(poll.end_date) < new Date()) {
      return apiResponse(res, 400, 'This poll has ended');
    }

    const currentMemberId = req.user ? memberPublicId(req.user) : null;
    if (!currentMemberId) {
      return apiResponse(res, 401, 'You must be logged in to vote');
    }

    const existingVote = await PollVote.findOne({ poll_id: poll._id, member_id: currentMemberId });
    if (existingVote) {
      return apiResponse(res, 400, 'You have already voted in this poll');
    }

    let rawOptions = req.body.selected_options ?? req.body.option_id ?? req.body.optionId ?? req.body.options ?? req.body.option;
    let selected_options = [];

    if (typeof rawOptions === 'string') {
      try {
        const parsed = JSON.parse(rawOptions);
        selected_options = Array.isArray(parsed) ? parsed : [String(parsed)];
      } catch (e) {
        selected_options = [rawOptions.trim()];
      }
    } else if (Array.isArray(rawOptions)) {
      selected_options = rawOptions.map(String);
    } else if (rawOptions !== undefined && rawOptions !== null) {
      selected_options = [String(rawOptions)];
    }

    if (!Array.isArray(selected_options) || selected_options.length === 0) {
      return apiResponse(res, 400, 'Please select at least one option to vote');
    }

    if (poll.poll_type === 'single' && selected_options.length > 1) {
      return apiResponse(res, 400, 'Only one option can be selected for this poll');
    }

    const resolvedOptionIds = [];
    for (const optVal of selected_options) {
      const match = poll.options.find(
        (o) => o.id === optVal || String(o.text).trim().toLowerCase() === String(optVal).trim().toLowerCase()
      );
      if (!match) {
        return apiResponse(res, 400, `Invalid option selected: ${optVal}`);
      }
      resolvedOptionIds.push(match.id);
    }

    const memberName = req.user ? (fullName(req.user) || req.user.name || 'Member') : 'Member';
    const memberMobile = req.user?.mobile || req.user?.phone || '';

    const vote = await PollVote.create({
      poll_id: poll._id,
      member_id: currentMemberId,
      member_name: memberName,
      member_mobile: memberMobile,
      selected_options: resolvedOptionIds,
      voted_at: new Date()
    });

    // Increment option votes and total
    for (const optId of resolvedOptionIds) {
      const opt = poll.options.find(o => o.id === optId);
      if (opt) opt.votes_count += 1;
    }
    poll.total_votes += 1;
    await poll.save();

    return apiResponse(res, 200, 'Vote submitted successfully', formatPoll(poll, vote));
  } catch (error) {
    if (error.code === 11000) {
      return apiResponse(res, 400, 'You have already voted in this poll');
    }
    return apiResponse(res, 500, 'Error submitting vote', { error: error.message });
  }
};

/**
 * GET /api/polls/:id/results - Detailed results of a poll
 */
const getPollResults = async (req, res) => {
  try {
    const poll = await findPollById(req.params.id);
    if (!poll) return apiResponse(res, 404, 'Poll not found');

    const totalVotes = poll.total_votes || 0;
    const formatted = formatPoll(poll);

    // Find highest voted option
    let highestVotes = -1;
    let leadingOption = null;
    (formatted.options || []).forEach(opt => {
      if (opt.votes_count > highestVotes) {
        highestVotes = opt.votes_count;
        leadingOption = opt;
      }
    });

    return apiResponse(res, 200, 'Poll results retrieved successfully', {
      ...formatted,
      leading_option: highestVotes > 0 ? leadingOption : null,
      total_voters: totalVotes
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving results', { error: error.message });
  }
};

/**
 * GET /api/polls/:id/responses - List of individual voter responses (Admin)
 */
const getPollResponses = async (req, res) => {
  try {
    const poll = await findPollById(req.params.id);
    if (!poll) return apiResponse(res, 404, 'Poll not found');

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const query = { poll_id: poll._id };
    if (req.query.search) {
      const s = String(req.query.search).trim();
      query.$or = [
        { member_name: new RegExp(s, 'i') },
        { member_mobile: new RegExp(s, 'i') }
      ];
    }

    const [votes, total] = await Promise.all([
      PollVote.find(query).sort({ voted_at: -1 }).skip(skip).limit(limit).lean(),
      PollVote.countDocuments(query)
    ]);

    const optionMap = new Map((poll.options || []).map(o => [o.id, o.text]));

    const responses = votes.map(v => ({
      _id: String(v._id),
      member_id: v.member_id,
      member_name: poll.is_anonymous ? 'Anonymous Member' : (v.member_name || 'Member'),
      member_mobile: poll.is_anonymous ? '' : (v.member_mobile || ''),
      selected_options: (v.selected_options || []).map(optId => ({
        id: optId,
        text: optionMap.get(optId) || optId
      })),
      voted_at: v.voted_at || v.createdAt
    }));

    return apiResponse(res, 200, 'Poll responses retrieved successfully', responses, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving responses', { error: error.message });
  }
};

module.exports = {
  getPolls,
  getPollById,
  createPoll,
  updatePoll,
  deletePoll,
  submitVote,
  getPollResults,
  getPollResponses
};
