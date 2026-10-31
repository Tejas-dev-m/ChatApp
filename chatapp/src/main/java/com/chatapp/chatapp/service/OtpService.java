
package com.chatapp.chatapp.service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

@Service
public class OtpService {

    private final SecureRandom random = new SecureRandom();

    private final ConcurrentHashMap<String, OtpData> otpStore =
            new ConcurrentHashMap<>();

    private final ConcurrentHashMap<String, Boolean> verifiedNumbers =
            new ConcurrentHashMap<>();

    public String generateOtp(String mobileNumber) {

        String otp = String.format("%06d", random.nextInt(1000000));

        LocalDateTime expiry = LocalDateTime.now().plusMinutes(5);

        otpStore.put(mobileNumber, new OtpData(otp, expiry));

        return otp;
    }

    public boolean verifyOtp(String mobileNumber, String otp) {

        OtpData data = otpStore.get(mobileNumber);

        if (data == null) {
            return false;
        }

        if (LocalDateTime.now().isAfter(data.expiry)) {
            otpStore.remove(mobileNumber);
            return false;
        }

        if (!data.otp.equals(otp)) {
            return false;
        }

        otpStore.remove(mobileNumber);
        verifiedNumbers.put(mobileNumber, true);

        return true;
    }

    public boolean isVerified(String mobileNumber) {
        return verifiedNumbers.containsKey(mobileNumber);
    }

    public void removeVerifiedNumber(String mobileNumber) {
        verifiedNumbers.remove(mobileNumber);
    }

    private static class OtpData {

        private final String otp;
        private final LocalDateTime expiry;

        public OtpData(String otp, LocalDateTime expiry) {
            this.otp = otp;
            this.expiry = expiry;
        }
    }
}
    