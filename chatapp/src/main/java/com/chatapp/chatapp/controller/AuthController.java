
package com.chatapp.chatapp.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

import com.chatapp.chatapp.dto.SendOtpRequest;
import com.chatapp.chatapp.dto.VerifyOtpRequest;
import com.chatapp.chatapp.dto.RegisterRequest;
import com.chatapp.chatapp.dto.LoginRequest;

import com.chatapp.chatapp.entity.User;
import com.chatapp.chatapp.repository.UserRepository;
import com.chatapp.chatapp.service.OtpService;
import com.chatapp.chatapp.service.JwtService;

import org.springframework.security.crypto.password.PasswordEncoder;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:5173")
public class AuthController {

    private final OtpService otpService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    // Constructor injection
    public AuthController(
            OtpService otpService,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService) {

        this.otpService = otpService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    // 1. SEND OTP
    @PostMapping("/send-otp")
    public ResponseEntity<?> sendOtp(
            @Valid @RequestBody SendOtpRequest request) {

        String mobileNumber = request.getMobileNumber();

        // Check existing mobile number
        if (userRepository.existsByMobileNumber(mobileNumber)) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "message",
                            "Mobile number already registered"
                    ));
        }

        // Generate OTP
        String otp = otpService.generateOtp(mobileNumber);

        // Local testing only
        System.out.println(
                "OTP for " + mobileNumber + " : " + otp
        );

        return ResponseEntity.ok(
                Map.of(
                        "message",
                        "OTP generated successfully"
                )
        );
    }

    // 2. VERIFY OTP
    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(
            @Valid @RequestBody VerifyOtpRequest request) {

        boolean verified = otpService.verifyOtp(
                request.getMobileNumber(),
                request.getOtp()
        );

        if (!verified) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "message",
                            "Invalid or expired OTP"
                    ));
        }

        return ResponseEntity.ok(
                Map.of(
                        "message",
                        "Mobile number verified successfully"
                )
        );
    }

    // 3. REGISTER USER
    @PostMapping("/register")
    public ResponseEntity<?> register(
            @Valid @RequestBody RegisterRequest request) {

        String mobileNumber = request.getMobileNumber();
        String email = request.getEmail().trim().toLowerCase();

        // Check mobile OTP verification
        if (!otpService.isVerified(mobileNumber)) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "message",
                            "Please verify your mobile number first"
                    ));
        }

        // Check duplicate mobile number
        if (userRepository.existsByMobileNumber(mobileNumber)) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "message",
                            "Mobile number already registered"
                    ));
        }

        // Check duplicate email
        if (userRepository.existsByEmail(email)) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "message",
                            "Email already registered"
                    ));
        }

        // Create user
        User user = new User();

        user.setName(request.getName().trim());
        user.setMobileNumber(mobileNumber);
        user.setEmail(email);

        // Encrypt password using BCrypt
        user.setPassword(
                passwordEncoder.encode(request.getPassword())
        );

        // Save user in PostgreSQL
        User savedUser = userRepository.save(user);

        // Remove verified OTP status
        otpService.removeVerifiedNumber(mobileNumber);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of(
                        "message", "Registration successful",
                        "userId", savedUser.getId(),
                        "name", savedUser.getName(),
                        "email", savedUser.getEmail()
                ));
    }

    // 4. LOGIN USING GMAIL AND PASSWORD
    @PostMapping("/login")
    public ResponseEntity<?> login(
            @Valid @RequestBody LoginRequest request) {

        String email = request.getEmail().trim().toLowerCase();

        // Find user by email
        User user = userRepository.findByEmail(email)
                .orElse(null);

        // Check user exists
        if (user == null) {

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            "Invalid email or password"
                    ));
        }

        // Verify password
        boolean passwordMatches = passwordEncoder.matches(
                request.getPassword(),
                user.getPassword()
        );

        if (!passwordMatches) {

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            "Invalid email or password"
                    ));
        }

        // Generate JWT token
        String token = jwtService.generateToken(user.getEmail());

        // Return login response
        return ResponseEntity.ok(
                Map.of(
                        "message", "Login successful",
                        "token", token,
                        "userId", user.getId(),
                        "name", user.getName(),
                        "email", user.getEmail()
                )
        );
    }
}
