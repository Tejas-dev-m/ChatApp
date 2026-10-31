
package com.chatapp.chatapp.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

import com.chatapp.chatapp.dto.StartConversationRequest;
import com.chatapp.chatapp.entity.User;
import com.chatapp.chatapp.entity.Conversation;
import com.chatapp.chatapp.repository.UserRepository;
import com.chatapp.chatapp.repository.ConversationRepository;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;

    public ConversationController(
            UserRepository userRepository,
            ConversationRepository conversationRepository) {

        this.userRepository = userRepository;
        this.conversationRepository = conversationRepository;
    }

    // Start one-to-one chat
    @PostMapping("/start")
    public ResponseEntity<?> startConversation(
            @Valid @RequestBody StartConversationRequest request,
            Authentication authentication) {

        // Get logged-in user email from JWT
        String loggedInEmail = authentication.getName();

        // Find logged-in user
        User currentUser = userRepository
                .findByEmail(loggedInEmail)
                .orElse(null);

        if (currentUser == null) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "Logged-in user not found"));
        }

        // Find receiver using mobile number
        User receiver = userRepository
                .findByMobileNumber(request.getMobileNumber())
                .orElse(null);

        if (receiver == null) {
            return ResponseEntity.status(404)
                    .body(Map.of("message", "User not registered"));
        }

        // Prevent chatting with yourself
        if (currentUser.getId().equals(receiver.getId())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "You cannot chat with yourself"));
        }

        // Check existing conversation
        Conversation conversation = conversationRepository
                .findConversation(
                        currentUser.getId(),
                        receiver.getId()
                )
                .orElse(null);

        boolean isNewConversation = false;

        // Create conversation if it doesn't exist
        if (conversation == null) {

            conversation = new Conversation();

            conversation.setUser1(currentUser);
            conversation.setUser2(receiver);

            conversation = conversationRepository.save(conversation);

            isNewConversation = true;
        }

        // Return conversation details
        return ResponseEntity.ok(
                Map.of(
                        "message", isNewConversation
                                ? "Chat started successfully"
                                : "Conversation already exists",
                        "conversationId", conversation.getId(),
                        "receiverId", receiver.getId(),
                        "receiverName", receiver.getName(),
                        "receiverMobile", receiver.getMobileNumber()
                )
        );
    }
}
