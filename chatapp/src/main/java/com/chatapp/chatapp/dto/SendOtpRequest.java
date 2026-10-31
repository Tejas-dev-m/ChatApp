
package com.chatapp.chatapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class SendOtpRequest {

    @NotBlank(message = "Mobile number is required")
    @Pattern(
        regexp = "^\\+?[1-9][0-9]{7,14}$",
        message = "Enter a valid mobile number"
    )
    private String mobileNumber;

    public String getMobileNumber() {
        return mobileNumber;
    }

    public void setMobileNumber(String mobileNumber) {
        this.mobileNumber = mobileNumber;
    }
}
