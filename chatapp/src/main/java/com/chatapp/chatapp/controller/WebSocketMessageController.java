
package com.chatapp.chatapp.controller;

import java.security.Principal;
import java.util.Map;



import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.chatapp.chatapp.entity.Conversation;
import com.chatapp.chatapp.entity.Message;
import com.chatapp.chatapp.entity.User;
import com.chatapp.chatapp.repository.ConversationRepository;
import com.chatapp.chatapp.repository.MessageRepository;
import com.chatapp.chatapp.repository.UserRepository;

@Controller
public class WebSocketMessageController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;

    public WebSocketMessageController(
            SimpMessagingTemplate messagingTemplate,
            MessageRepository messageRepository,
            ConversationRepository conversationRepository,
            UserRepository userRepository) {

        this.messagingTemplate = messagingTemplate;
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.userRepository = userRepository;
    }

    // Receive and broadcast chat message
    @MessageMapping("/chat.send")
    public void sendMessage(
            Map<String, String> request,
            Principal principal) {

        // Get logged-in user email
        String email = principal.getName();

        User sender = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new IllegalArgumentException("User not found"));

        // Get request data
        String conversationId = request.get("conversationId");
        String content = request.get("content");

        if (conversationId == null || content == null
                || content.trim().isEmpty()) {

            throw new IllegalArgumentException(
                    "Conversation ID and message are required");
        }

        Long id = Long.parseLong(conversationId);

        // Find conversation
        Conversation conversation = conversationRepository
                .findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Conversation not found"));

        // Check conversation membership
        boolean isMember =
                conversation.getUser1().getId().equals(sender.getId())
                || conversation.getUser2().getId().equals(sender.getId());

        if (!isMember) {
            throw new IllegalArgumentException(
                    "You are not part of this conversation");
        }

        // Create message
        Message message = new Message();

        message.setConversation(conversation);
        message.setSender(sender);
        message.setContent(content.trim());

        // Save message in PostgreSQL
        Message savedMessage = messageRepository.save(message);

        // Prepare response
        Map<String, Object> response = Map.of(
                "messageId", savedMessage.getId(),
                "conversationId", id,
                "senderId", sender.getId(),
                "senderName", sender.getName(),
                "content", savedMessage.getContent(),
                "sentAt", savedMessage.getSentAt()
        );

        // Broadcast to conversation subscribers
        messagingTemplate.convertAndSend(
        "/topic/conversation/" + id,
        (Object) response
);
    }
}
