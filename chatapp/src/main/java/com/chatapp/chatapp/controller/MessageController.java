
package com.chatapp.chatapp.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.chatapp.chatapp.entity.Conversation;
import com.chatapp.chatapp.entity.Message;
import com.chatapp.chatapp.entity.User;
import com.chatapp.chatapp.repository.ConversationRepository;
import com.chatapp.chatapp.repository.MessageRepository;
import com.chatapp.chatapp.repository.UserRepository;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;

    public MessageController(
            MessageRepository messageRepository,
            ConversationRepository conversationRepository,
            UserRepository userRepository) {

        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.userRepository = userRepository;
    }

    // Send Message
    @PostMapping("/send")
    public ResponseEntity<?> sendMessage(
            @RequestBody Map<String, String> request,
            Authentication authentication) {

        String email = authentication.getName();

        User sender = userRepository.findByEmail(email).orElse(null);

        if (sender == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "User not found"));
        }

        String conversationId = request.get("conversationId");
        String content = request.get("content");

        if (conversationId == null || content == null
                || content.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Conversation ID and message are required"));
        }

        Long id;

        try {
            id = Long.parseLong(conversationId);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Invalid conversation ID"));
        }

        Conversation conversation = conversationRepository
                .findById(id).orElse(null);

        if (conversation == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Conversation not found"));
        }

        boolean isMember =
                conversation.getUser1().getId().equals(sender.getId())
                || conversation.getUser2().getId().equals(sender.getId());

        if (!isMember) {
            return ResponseEntity.status(403)
                    .body(Map.of("message", "You are not part of this conversation"));
        }

        Message message = new Message();
        message.setConversation(conversation);
        message.setSender(sender);
        message.setContent(content.trim());

        Message savedMessage = messageRepository.save(message);

        return ResponseEntity.ok(Map.of(
                "messageId", savedMessage.getId(),
                "conversationId", id,
                "senderId", sender.getId(),
                "senderName", sender.getName(),
                "content", savedMessage.getContent(),
                "sentAt", savedMessage.getSentAt()
        ));
    }

    // Get Chat History
    @GetMapping("/{conversationId}")
    public ResponseEntity<?> getMessages(
            @PathVariable Long conversationId,
            Authentication authentication) {

        String email = authentication.getName();

        User currentUser = userRepository.findByEmail(email).orElse(null);

        if (currentUser == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "User not found"));
        }

        Conversation conversation = conversationRepository
                .findById(conversationId).orElse(null);

        if (conversation == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Conversation not found"));
        }

        boolean isMember =
                conversation.getUser1().getId().equals(currentUser.getId())
                || conversation.getUser2().getId().equals(currentUser.getId());

        if (!isMember) {
            return ResponseEntity.status(403)
                    .body(Map.of("message", "You are not part of this conversation"));
        }

        List<Message> messages = messageRepository
                .findByConversationIdOrderBySentAtAsc(conversationId);

        List<Map<String, Object>> response = messages.stream()
                .map(message -> Map.<String, Object>of(
                        "messageId", message.getId(),
                        "senderId", message.getSender().getId(),
                        "senderName", message.getSender().getName(),
                        "content", message.getContent(),
                        "sentAt", message.getSentAt()
                ))
                .toList();

        return ResponseEntity.ok(response);
    }
}
