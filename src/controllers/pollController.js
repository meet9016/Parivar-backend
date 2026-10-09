const mongoose = require('mongoose');
const Poll = require('../models/pollModel');
const PollVote = require('../models/pollVoteModel');
const User = require('../models/userModels');
const { apiResponse, fullName, publicUrl } = require('../utils/apiResponse');
const { getRolePermissions } = require('../middleware/auth');

/**
 * Check if the authenticated user has Admin privileges for Polls
 */
const isAdminUser = (user = {}) => {
  if (!user) return false;
  const roleName = user.role_id?.name?.toLowerCase() || user.role_id?.roleName?.toLowerCase() || String(user.role || '').toLowerCase();
  if (
    roleName === 'admin' ||
    roleName === 'super admin' ||
    user.role === 'superadmin' ||
    user.role === 'admin' ||
    user.committee_role === 'President' ||
    user.committee_role === 'Admin' ||
    user.is_super_admin === true ||
    (user.is_committee === true && (!user.role_id || user.committee_role === 'Admin'))
  ) {
    return true;
  }

  const permissions = getRolePermissions(user);
  return (
    permissions.includes('polls.manage') ||
    permissions.includes('polls.list') ||
    permissions.includes('polls.add') ||
    permissions.includes('polls.edit') ||
    permissions.includes('polls.delete')
  );
};

/**
 * Determine dynamic effective status (considers endDate expiration)
 */
const getEffectiveStatus = (poll) => {
  if (poll.status === 'draft') return 'draft';
  if (poll.status === 'closed') return 'closed';
  if (poll.endDate && new Date() > new Date(poll.endDate)) return 'expired';
  return poll.status || 'active';
};

/**
 * Helper to calculate option vote stats for a poll
 */
const computePollStats = (poll, votes = [], currentUserId = null) => {
  const totalVotes = votes.length;
  const options = Array.isArray(poll.options) ? poll.options : [];

  // Count votes per option
  const optionCounts = {};
  options.forEach((opt) => {
    optionCounts[String(opt._id)] = 0;
  });

  let userVote = null;
  votes.forEach((vote) => {
    const memberIdStr = String(vote.memberId?._id || vote.memberId || '');
    if (currentUserId && memberIdStr === String(currentUserId)) {
      userVote = vote;
    }
    (vote.selectedOptions || []).forEach((optId) => {
      const idStr = String(optId);
      if (optionCounts[idStr] !== undefined) {
        optionCounts[idStr] += 1;
      }
    });
  });

  const formattedOptions = options.map((opt) => {
    const count = optionCounts[String(opt._id)] || 0;
    const percentage = totalVotes > 0 ? Number(((count / totalVotes) * 100).toFixed(1)) : 0;
    return {
      _id: opt._id,
      id: String(opt._id),
      text: opt.text,
      votesCount: count,
      percentage
    };
  });

  const userSelectedOptions = userVote
    ? (userVote.selectedOptions || []).map((id) => String(id))
    : [];

  return {
    totalVotes,
    options: formattedOptions,
    hasVoted: Boolean(userVote),
    userSelectedOptions,
    userVoteDate: userVote ? (userVote.updatedAt || userVote.createdAt) : null
  };
};

/**
 * Format a poll document for responses
 */
const formatPollResponse = (poll, stats, effectiveStatus) => {
  return {
    _id: String(poll._id),
    id: String(poll._id),
    question: poll.question || '',
    description: poll.description || '',
    type: poll.type || 'single',
    status: effectiveStatus,
    rawStatus: poll.status,
    startDate: poll.startDate || null,
    endDate: poll.endDate || null,
    createdBy: poll.createdBy || { name: 'Admin' },
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
    totalVotes: stats.totalVotes,
    options: stats.options,
    hasVoted: stats.hasVoted,
    userSelectedOptions: stats.userSelectedOptions,
    userVoteDate: stats.userVoteDate
  };
};

/**
 * 1. CREATE POLL (Admin Only)
 * POST /api/polls
 */
const createPoll = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return apiResponse(res, 403, 'Forbidden: Only admin can create polls');
    }

    const { question, description, type, options, startDate, endDate, status } = req.body;

    if (!question || !String(question).trim()) {
      return apiResponse(res, 400, 'Poll question is required');
    }

    const pollType = type === 'multiple' ? 'multiple' : 'single';

    // Parse & Validate options
    let rawOptions = options;
    if (typeof rawOptions === 'string') {
      try {
        rawOptions = JSON.parse(rawOptions);
      } catch (_) {
        rawOptions = rawOptions.split(',').map((s) => s.trim());
      }
    }

    if (!Array.isArray(rawOptions) || rawOptions.length < 2) {
      return apiResponse(res, 400, 'Minimum 2 options are required');
    }

    const cleanedOptions = [];
    const seenTexts = new Set();

    for (let i = 0; i < rawOptions.length; i++) {
      const optItem = rawOptions[i];
      const text = typeof optItem === 'object' && optItem !== null ? optItem.text : String(optItem);
      const trimmed = (text || '').trim();

      if (!trimmed) {
        return apiResponse(res, 400, `Option ${i + 1} cannot be empty`);
      }

      const lowerText = trimmed.toLowerCase();
      if (seenTexts.has(lowerText)) {
        return apiResponse(res, 400, `Duplicate option found: "${trimmed}"`);
      }
      seenTexts.add(lowerText);

      cleanedOptions.push({
        _id: new mongoose.Types.ObjectId(),
        text: trimmed
      });
    }

    // Validate dates
    let start = null;
    let end = null;
    if (startDate) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return apiResponse(res, 400, 'Invalid start date format');
      }
    }
    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return apiResponse(res, 400, 'Invalid end date format');
      }
    }
    if (start && end && end < start) {
      return apiResponse(res, 400, 'End date cannot be before start date');
    }

    const pollStatus = ['draft', 'active', 'closed'].includes(status) ? status : 'active';

    const newPoll = new Poll({
      question: String(question).trim(),
      description: (description || '').trim(),
      type: pollType,
      options: cleanedOptions,
      startDate: start,
      endDate: end,
      status: pollStatus,
      createdBy: {
        id: req.user._id || req.user.id,
        name: fullName(req.user) || 'Admin'
      }
    });

    await newPoll.save();

    const stats = computePollStats(newPoll, [], req.user._id);
    const result = formatPollResponse(newPoll, stats, getEffectiveStatus(newPoll));

    return apiResponse(res, 201, 'Poll created successfully', result);
  } catch (error) {
    console.error('Error creating poll:', error);
    return apiResponse(res, 500, error.message || 'Error creating poll');
  }
};

/**
 * 2. GET POLLS
 * GET /api/polls
 * Members receive active & closed polls (never draft).
 * Admins receive all relevant polls or by status filter.
 */
const getPolls = async (req, res) => {
  try {
    const isAdmin = isAdminUser(req.user);
    const query = {};

    if (!isAdmin) {
      // Normal members should never see draft polls
      query.status = { $ne: 'draft' };
    } else if (req.query.status) {
      if (req.query.status === 'expired') {
        query.endDate = { $lt: new Date() };
        query.status = { $ne: 'draft' };
      } else {
        query.status = req.query.status;
      }
    }

    if (req.query.search) {
      query.question = { $regex: req.query.search.trim(), $options: 'i' };
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const totalCount = await Poll.countDocuments(query);
    const polls = await Poll.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const pollIds = polls.map((p) => p._id);
    const allVotes = await PollVote.find({ pollId: { $in: pollIds } });

    // Group votes by pollId
    const votesByPoll = {};
    pollIds.forEach((id) => {
      votesByPoll[String(id)] = [];
    });
    allVotes.forEach((v) => {
      const pid = String(v.pollId);
      if (votesByPoll[pid]) {
        votesByPoll[pid].push(v);
      }
    });

    const currentUserId = req.user ? (req.user._id || req.user.id) : null;

    const formattedList = polls.map((poll) => {
      const pollVotes = votesByPoll[String(poll._id)] || [];
      const effectiveStatus = getEffectiveStatus(poll);
      const stats = computePollStats(poll, pollVotes, currentUserId);
      return formatPollResponse(poll, stats, effectiveStatus);
    });

    const pagination = {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1
    };

    return apiResponse(res, 200, 'Polls fetched successfully', formattedList, pagination);
  } catch (error) {
    console.error('Error fetching polls:', error);
    return apiResponse(res, 500, error.message || 'Error fetching polls');
  }
};

/**
 * 3. GET POLL DETAILS
 * GET /api/polls/:id
 */
const getPollById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return apiResponse(res, 400, 'Invalid poll ID');
    }

    const poll = await Poll.findById(id);
    if (!poll) {
      return apiResponse(res, 404, 'Poll not found');
    }

    const isAdmin = isAdminUser(req.user);
    if (!isAdmin && poll.status === 'draft') {
      return apiResponse(res, 403, 'Forbidden: This poll is not available');
    }

    const votes = await PollVote.find({ pollId: poll._id });
    const currentUserId = req.user ? (req.user._id || req.user.id) : null;
    const stats = computePollStats(poll, votes, currentUserId);
    const effectiveStatus = getEffectiveStatus(poll);

    const result = formatPollResponse(poll, stats, effectiveStatus);
    return apiResponse(res, 200, 'Poll details fetched successfully', result);
  } catch (error) {
    console.error('Error fetching poll details:', error);
    return apiResponse(res, 500, error.message || 'Error fetching poll details');
  }
};

/**
 * 4. UPDATE POLL (Admin Only)
 * PUT /api/polls/:id
 */
const updatePoll = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return apiResponse(res, 403, 'Forbidden: Only admin can update polls');
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return apiResponse(res, 400, 'Invalid poll ID');
    }

    const poll = await Poll.findById(id);
    if (!poll) {
      return apiResponse(res, 404, 'Poll not found');
    }

    const { question, description, type, options, startDate, endDate, status } = req.body;

    if (question !== undefined) {
      if (!String(question).trim()) {
        return apiResponse(res, 400, 'Poll question cannot be empty');
      }
      poll.question = String(question).trim();
    }

    if (description !== undefined) {
      poll.description = String(description).trim();
    }

    if (type !== undefined) {
      poll.type = type === 'multiple' ? 'multiple' : 'single';
    }

    if (options !== undefined) {
      let rawOptions = options;
      if (typeof rawOptions === 'string') {
        try {
          rawOptions = JSON.parse(rawOptions);
        } catch (_) {
          rawOptions = rawOptions.split(',').map((s) => s.trim());
        }
      }

      if (!Array.isArray(rawOptions) || rawOptions.length < 2) {
        return apiResponse(res, 400, 'Minimum 2 options are required');
      }

      const existingOptionsMap = new Map();
      (poll.options || []).forEach((o) => {
        existingOptionsMap.set(String(o._id), o._id);
      });

      const cleanedOptions = [];
      const seenTexts = new Set();

      for (let i = 0; i < rawOptions.length; i++) {
        const optItem = rawOptions[i];
        const text = typeof optItem === 'object' && optItem !== null ? optItem.text : String(optItem);
        const optId = typeof optItem === 'object' && optItem !== null && optItem._id ? optItem._id : null;
        const trimmed = (text || '').trim();

        if (!trimmed) {
          return apiResponse(res, 400, `Option ${i + 1} cannot be empty`);
        }

        const lowerText = trimmed.toLowerCase();
        if (seenTexts.has(lowerText)) {
          return apiResponse(res, 400, `Duplicate option found: "${trimmed}"`);
        }
        seenTexts.add(lowerText);

        cleanedOptions.push({
          _id: optId && existingOptionsMap.has(String(optId)) ? optId : new mongoose.Types.ObjectId(),
          text: trimmed
        });
      }

      poll.options = cleanedOptions;
    }

    if (startDate !== undefined) {
      if (startDate) {
        const d = new Date(startDate);
        if (isNaN(d.getTime())) return apiResponse(res, 400, 'Invalid start date');
        poll.startDate = d;
      } else {
        poll.startDate = null;
      }
    }

    if (endDate !== undefined) {
      if (endDate) {
        const d = new Date(endDate);
        if (isNaN(d.getTime())) return apiResponse(res, 400, 'Invalid end date');
        poll.endDate = d;
      } else {
        poll.endDate = null;
      }
    }

    if (poll.startDate && poll.endDate && poll.endDate < poll.startDate) {
      return apiResponse(res, 400, 'End date cannot be before start date');
    }

    if (status !== undefined) {
      if (!['draft', 'active', 'closed'].includes(status)) {
        return apiResponse(res, 400, 'Invalid status value');
      }
      poll.status = status;
    }

    await poll.save();

    const votes = await PollVote.find({ pollId: poll._id });
    const stats = computePollStats(poll, votes, req.user._id);
    const result = formatPollResponse(poll, stats, getEffectiveStatus(poll));

    return apiResponse(res, 200, 'Poll updated successfully', result);
  } catch (error) {
    console.error('Error updating poll:', error);
    return apiResponse(res, 500, error.message || 'Error updating poll');
  }
};

/**
 * 5. DELETE POLL (Admin Only)
 * DELETE /api/polls/:id
 */
const deletePoll = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return apiResponse(res, 403, 'Forbidden: Only admin can delete polls');
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return apiResponse(res, 400, 'Invalid poll ID');
    }

    const poll = await Poll.findById(id);
    if (!poll) {
      return apiResponse(res, 404, 'Poll not found');
    }

    await Poll.findByIdAndDelete(id);
    // Clean up all votes belonging to this poll
    await PollVote.deleteMany({ pollId: id });

    return apiResponse(res, 200, 'Poll and its votes deleted successfully', { id });
  } catch (error) {
    console.error('Error deleting poll:', error);
    return apiResponse(res, 500, error.message || 'Error deleting poll');
  }
};

/**
 * 6. SUBMIT / UPDATE VOTE
 * POST /api/polls/:id/vote
 * PUT  /api/polls/:id/vote
 */
const submitVote = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return apiResponse(res, 400, 'Invalid poll ID');
    }

    const memberId = req.user?._id || req.user?.id;
    if (!memberId) {
      return apiResponse(res, 401, 'Unauthorized: User authentication required');
    }

    const poll = await Poll.findById(id);
    if (!poll) {
      return apiResponse(res, 404, 'Poll not found');
    }

    // Check poll status
    const effectiveStatus = getEffectiveStatus(poll);
    if (poll.status === 'draft') {
      return apiResponse(res, 400, 'Voting is not allowed on draft polls');
    }
    if (poll.status === 'closed') {
      return apiResponse(res, 400, 'This poll is closed for voting');
    }
    if (effectiveStatus === 'expired') {
      return apiResponse(res, 400, 'This poll has expired. Voting is closed.');
    }

    // Extract selectedOptions from body
    let rawOptions = req.body.selectedOptions || req.body.options || req.body.selectedOption;
    if (typeof rawOptions === 'string') {
      try {
        rawOptions = JSON.parse(rawOptions);
      } catch (_) {
        rawOptions = rawOptions.split(',').map((s) => s.trim());
      }
    }
    if (!Array.isArray(rawOptions)) {
      rawOptions = rawOptions ? [rawOptions] : [];
    }

    // Filter valid option IDs
    const selectedOptionIds = rawOptions
      .map((item) => (typeof item === 'object' && item !== null ? (item._id || item.id) : item))
      .filter(Boolean)
      .map(String);

    // Validation: Single vs Multiple
    if (poll.type === 'single') {
      if (selectedOptionIds.length !== 1) {
        return apiResponse(res, 400, 'Single-choice poll requires selecting exactly one option');
      }
    } else {
      if (selectedOptionIds.length < 1) {
        return apiResponse(res, 400, 'Multiple-choice poll requires selecting at least one option');
      }
    }

    // Verify all selected options exist in the poll
    const pollOptionIds = (poll.options || []).map((o) => String(o._id));
    for (const optId of selectedOptionIds) {
      if (!pollOptionIds.includes(optId)) {
        return apiResponse(res, 400, `Selected option does not exist in this poll`);
      }
    }

    const objectIdList = selectedOptionIds.map((idStr) => new mongoose.Types.ObjectId(idStr));

    // Upsert vote: update existing vote or insert new record (No duplicate vote record!)
    const savedVote = await PollVote.findOneAndUpdate(
      { pollId: poll._id, memberId: new mongoose.Types.ObjectId(String(memberId)) },
      {
        selectedOptions: objectIdList,
        updatedAt: new Date()
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    // Fetch updated stats
    const allVotes = await PollVote.find({ pollId: poll._id });
    const stats = computePollStats(poll, allVotes, memberId);
    const result = formatPollResponse(poll, stats, effectiveStatus);

    return apiResponse(res, 200, 'Vote recorded successfully', result);
  } catch (error) {
    console.error('Error submitting vote:', error);
    return apiResponse(res, 500, error.message || 'Error submitting vote');
  }
};

/**
 * 7. POLL RESULTS
 * GET /api/polls/:id/results
 */
const getPollResults = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return apiResponse(res, 400, 'Invalid poll ID');
    }

    const poll = await Poll.findById(id);
    if (!poll) {
      return apiResponse(res, 404, 'Poll not found');
    }

    const isAdmin = isAdminUser(req.user);
    if (!isAdmin && poll.status === 'draft') {
      return apiResponse(res, 403, 'Forbidden: This poll is not available');
    }

    const votes = await PollVote.find({ pollId: poll._id });
    const totalMembers = await User.countDocuments({ status: { $ne: 0 } });
    const totalParticipants = votes.length;
    const totalNotParticipated = Math.max(0, totalMembers - totalParticipants);

    const stats = computePollStats(poll, votes, req.user?._id);

    return apiResponse(res, 200, 'Poll results fetched successfully', {
      pollId: String(poll._id),
      question: poll.question,
      description: poll.description,
      type: poll.type,
      status: getEffectiveStatus(poll),
      totalMembers,
      totalParticipants,
      totalNotParticipated,
      totalVotes: stats.totalVotes,
      options: stats.options
    });
  } catch (error) {
    console.error('Error fetching poll results:', error);
    return apiResponse(res, 500, error.message || 'Error fetching poll results');
  }
};

/**
 * 8. MEMBER-WISE RESPONSES (Admin Only)
 * GET /api/polls/:id/responses
 *
 * Query options:
 * - status: 'all' | 'participated' | 'not_participated'
 * - optionId: Filter by specific option ID
 * - search: Search by member name
 * - page, limit: Pagination
 */
const getPollResponses = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return apiResponse(res, 403, 'Forbidden: Only admin can view member responses');
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return apiResponse(res, 400, 'Invalid poll ID');
    }

    const poll = await Poll.findById(id);
    if (!poll) {
      return apiResponse(res, 404, 'Poll not found');
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filterStatus = req.query.status || 'all'; // 'all' | 'participated' | 'not_participated'
    const filterOptionId = req.query.optionId || req.query.option_id || '';
    const searchQuery = (req.query.search || '').trim();

    // 1. Get total active community members
    const totalMembers = await User.countDocuments({ status: { $ne: 0 } });

    // 2. Fetch all votes for this poll
    const allVotes = await PollVote.find({ pollId: poll._id });
    const votedMemberIdSet = new Set(allVotes.map((v) => String(v.memberId)));
    const totalParticipants = votedMemberIdSet.size;
    const totalNotParticipated = Math.max(0, totalMembers - totalParticipants);

    // Create options map for quick lookup
    const optionMap = {};
    (poll.options || []).forEach((opt) => {
      optionMap[String(opt._id)] = opt.text;
    });

    let responses = [];
    let totalFiltered = 0;

    if (filterStatus === 'not_participated') {
      // Members who have NOT voted
      const votedMemberObjectIds = Array.from(votedMemberIdSet)
        .filter((idStr) => mongoose.isValidObjectId(idStr))
        .map((idStr) => new mongoose.Types.ObjectId(idStr));

      const userQuery = {
        _id: { $nin: votedMemberObjectIds },
        status: { $ne: 0 }
      };

      if (searchQuery) {
        userQuery.$or = [
          { first_name: { $regex: searchQuery, $options: 'i' } },
          { middle_name: { $regex: searchQuery, $options: 'i' } },
          { last_name: { $regex: searchQuery, $options: 'i' } },
          { number: { $regex: searchQuery, $options: 'i' } }
        ];
      }

      totalFiltered = await User.countDocuments(userQuery);
      const nonVotingUsers = await User.find(userQuery)
        .select('first_name middle_name last_name number member_id profile_image email')
        .sort({ first_name: 1, last_name: 1 })
        .skip(skip)
        .limit(limit);

      responses = nonVotingUsers.map((user) => ({
        member: {
          id: String(user._id),
          member_id: user.member_id || '',
          name: fullName(user) || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown',
          profileImage: publicUrl(req, user.profile_image),
          number: user.number || '',
          email: user.email || ''
        },
        participated: false,
        selectedOptions: [],
        submittedAt: null
      }));
    } else {
      // 'participated' or 'all'
      // Query votes populated with User
      let filteredVotes = allVotes;

      if (filterOptionId && mongoose.isValidObjectId(filterOptionId)) {
        filteredVotes = filteredVotes.filter((v) =>
          (v.selectedOptions || []).some((optId) => String(optId) === String(filterOptionId))
        );
      }

      const voteMemberIds = filteredVotes.map((v) => v.memberId);
      const userQuery = { _id: { $in: voteMemberIds } };

      if (searchQuery) {
        userQuery.$or = [
          { first_name: { $regex: searchQuery, $options: 'i' } },
          { middle_name: { $regex: searchQuery, $options: 'i' } },
          { last_name: { $regex: searchQuery, $options: 'i' } },
          { number: { $regex: searchQuery, $options: 'i' } }
        ];
      }

      const matchingUsers = await User.find(userQuery)
        .select('first_name middle_name last_name number member_id profile_image email');

      const userMap = {};
      matchingUsers.forEach((u) => {
        userMap[String(u._id)] = u;
      });

      // Filter votes matching found users
      const validVoteRecords = filteredVotes
        .filter((v) => userMap[String(v.memberId)])
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

      totalFiltered = validVoteRecords.length;
      const paginatedVotes = validVoteRecords.slice(skip, skip + limit);

      responses = paginatedVotes.map((vote) => {
        const user = userMap[String(vote.memberId)] || {};
        const selectedOptions = (vote.selectedOptions || []).map((optId) => ({
          id: String(optId),
          text: optionMap[String(optId)] || 'Unknown'
        }));

        return {
          member: {
            id: String(user._id || vote.memberId),
            member_id: user.member_id || '',
            name: fullName(user) || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Member',
            profileImage: publicUrl(req, user.profile_image),
            number: user.number || '',
            email: user.email || ''
          },
          participated: true,
          selectedOptions,
          submittedAt: vote.updatedAt || vote.createdAt
        };
      });
    }

    const pagination = {
      page,
      limit,
      total: totalFiltered,
      totalPages: Math.ceil(totalFiltered / limit) || 1
    };

    return apiResponse(res, 200, 'Member responses fetched successfully', {
      pollId: String(poll._id),
      question: poll.question,
      totalMembers,
      totalParticipants,
      totalNotParticipated,
      responses
    }, pagination);
  } catch (error) {
    console.error('Error fetching member responses:', error);
    return apiResponse(res, 500, error.message || 'Error fetching member responses');
  }
};

module.exports = {
  createPoll,
  getPolls,
  getPollById,
  updatePoll,
  deletePoll,
  submitVote,
  getPollResults,
  getPollResponses
};
