
package com.chatapp.chatapp.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.chatapp.chatapp.entity.User;

import com.chatapp.chatapp.repository.UserRepository;
import com.chatapp.chatapp.repository.ConversationRepository;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;

    // Constructor injection
    public UserController(
            UserRepository userRepository,
            ConversationRepository conversationRepository) {

        this.userRepository = userRepository;
        this.conversationRepository = conversationRepository;
    }

    // 1. Get all conversations of logged-in user
    @GetMapping("/my-chats")
    public ResponseEntity<?> getMyConversations(
            Authentication authentication) {

        // Get logged-in user's email from JWT
        String email = authentication.getName();

        // Find logged-in user
        User currentUser = userRepository
                .findByEmail(email)
                .orElse(null);

        if (currentUser == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "User not found"));
        }

        // Get all conversations
        var conversations = conversationRepository
                .findAllUserConversations(currentUser.getId());

        // Prepare chat list
        var chatList = conversations.stream().map(chat -> {

            User otherUser;

            // Find the other user
            if (chat.getUser1().getId()
                    .equals(currentUser.getId())) {

                otherUser = chat.getUser2();

            } else {

                otherUser = chat.getUser1();
            }

            return Map.of(
                    "conversationId", chat.getId(),
                    "userId", otherUser.getId(),
                    "name", otherUser.getName(),
                    "mobileNumber", otherUser.getMobileNumber()
            );

        }).toList();

        return ResponseEntity.ok(chatList);
    }


    // 2. Search registered user by mobile number
    @GetMapping("/search")
    public ResponseEntity<?> searchUser(
            @RequestParam String mobileNumber,
            Authentication authentication) {

        // Get logged-in user email
        String loggedInEmail = authentication.getName();

        // Find logged-in user
        User loggedInUser = userRepository
                .findByEmail(loggedInEmail)
                .orElse(null);

        if (loggedInUser == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "User not found"));
        }

        // Prevent searching own number
        if (loggedInUser.getMobileNumber()
                .equals(mobileNumber)) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "message",
                            "You cannot search your own number"
                    ));
        }

        // Find receiver
        User user = userRepository
                .findByMobileNumber(mobileNumber)
                .orElse(null);

        if (user == null) {
            return ResponseEntity.status(404)
                    .body(Map.of("message", "User not found"));
        }

        // Return user details
        return ResponseEntity.ok(
                Map.of(
                        "userId", user.getId(),
                        "name", user.getName(),
                        "mobileNumber", user.getMobileNumber()
                )
        );
    }
}
