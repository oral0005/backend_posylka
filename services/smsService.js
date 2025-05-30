const twilio = require('twilio');
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

if (!accountSid || !authToken || !verifyServiceSid) {
  console.error('Missing Twilio credentials in environment variables');
  throw new Error('Twilio configuration is incomplete');
}

const client = twilio(accountSid, authToken);

const sendVerificationCode = async (phoneNumber) => {
  try {
    console.log('Starting verification process for:', phoneNumber);
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
      throw new Error('Missing required Twilio configuration');
    }
    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({ to: phoneNumber, channel: 'sms' });
    console.log('Verification sent successfully:', {
      sid: verification.sid,
      status: verification.status,
      to: verification.to
    });
    return {
      success: true,
      sid: verification.sid,
      status: verification.status
    };
  } catch (error) {
    console.error('Error in sendVerificationCode:', {
      error: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo
    });
    throw new Error(`Failed to send verification code: ${error.message}`);
  }
};

const checkVerificationCode = async (phoneNumber, code) => {
  try {
    console.log('Checking verification code for:', phoneNumber);
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
      throw new Error('Missing required Twilio configuration');
    }
    const verificationCheck = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({ to: phoneNumber, code });
    console.log('Verification check result:', {
      sid: verificationCheck.sid,
      status: verificationCheck.status,
      valid: verificationCheck.valid
    });
    return {
      success: verificationCheck.status === 'approved',
      status: verificationCheck.status,
      valid: verificationCheck.valid
    };
  } catch (error) {
    console.error('Error in checkVerificationCode:', {
      error: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo
    });
    throw new Error(`Failed to verify code: ${error.message}`);
  }
};

module.exports = {
  sendVerificationCode,
  checkVerificationCode
};