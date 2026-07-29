const axios = require('axios');

const sendSMS = async (number, otp) => {
  try {
    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER_ID;
    const templateId = process.env.SMS_TEMPLATE_ID;
    const entityId = process.env.SMS_ENTITY_ID;
    const baseUrl = process.env.SMS_BASE_URL;

    // Validate all required environment variables
    if (!baseUrl) {
      console.error("[SMS ERROR] SMS_BASE_URL is not configured");
      return { success: false, error: "SMS_BASE_URL not configured" };
    }
    if (!apiKey) {
      console.error("[SMS ERROR] SMS_API_KEY is not configured");
      return { success: false, error: "SMS_API_KEY not configured" };
    }
    if (!senderId) {
      console.error("[SMS ERROR] SMS_SENDER_ID is not configured");
      return { success: false, error: "SMS_SENDER_ID not configured" };
    }
    if (!templateId) {
      console.error("[SMS ERROR] SMS_TEMPLATE_ID is not configured");
      return { success: false, error: "SMS_TEMPLATE_ID not configured" };
    }
    if (!entityId) {
      console.error("[SMS ERROR] SMS_ENTITY_ID is not configured");
      return { success: false, error: "SMS_ENTITY_ID not configured" };
    }

    const mobile = `91${number}`;
    const message = `${otp} is your OTP to register for security reasons, do not share this OTP with anyone. Parivar SHOPNO`;

    const response = await axios.get(baseUrl, {
      params: {
        APIKey: apiKey,
        senderid: senderId,
        channel: "Trans",
        DCS: 0,
        flashsms: 0,
        number: mobile,
        text: message,
        route: 1,
        EntityId: entityId,
        dlttemplateid: templateId
      },
      timeout: 10000
    });

    if (response.data && response.data.ErrorCode === "000") {
      return { success: true, data: response.data };
    } else {
      const errorMsg = response.data ? response.data.ErrorMessage : "Unknown API Error";
      console.error(`[SMS ERROR] Failed to send OTP: ${errorMsg}`);
      console.error("[SMS ERROR] API Response:", response.data);
      return { success: false, error: errorMsg };
    }

  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
    console.error(`[SMS ERROR] Failed to send OTP: ${errorMsg}`);
    console.error(`[SMS ERROR] Full error:`, error.response?.data || error);
    return { success: false, error: errorMsg };
  }
};

module.exports = { sendSMS };