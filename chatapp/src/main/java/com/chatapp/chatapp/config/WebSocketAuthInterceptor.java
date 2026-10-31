
package com.chatapp.chatapp.config;

import java.security.Principal;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import com.chatapp.chatapp.entity.Conversation;
import com.chatapp.chatapp.entity.User;
import com.chatapp.chatapp.repository.ConversationRepository;
import com.chatapp.chatapp.repository.UserRepository;
import com.chatapp.chatapp.service.JwtService;

@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;

    public WebSocketAuthInterceptor(
            JwtService jwtService,
            UserRepository userRepository,
            ConversationRepository conversationRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.conversationRepository = conversationRepository;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {

        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(
                        message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {

            String token = accessor.getFirstNativeHeader("Authorization");

            if (token == null || !token.startsWith("Bearer ")) {
                throw new IllegalArgumentException("Missing JWT token");
            }

            token = token.substring(7);

            String email = jwtService.extractEmail(token);

            if (email == null || !jwtService.isTokenValid(token, email)) {
                throw new IllegalArgumentException("Invalid JWT token");
            }

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                            email, null, java.util.Collections.emptyList());

            accessor.setUser(authentication);
        }

        if (accessor != null && StompCommand.SEND.equals(accessor.getCommand())) {
            if (accessor.getUser() == null) {
                throw new AccessDeniedException("Authentication is required to send messages");
            }
            if (!"/app/chat.send".equals(accessor.getDestination())) {
                throw new AccessDeniedException("Sending to this destination is not allowed");
            }
        }

        if (accessor != null && StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            authorizeConversationSubscription(
                    accessor.getUser(),
                    accessor.getDestination()
            );
        }

        return message;
    }

    private void authorizeConversationSubscription(
            Principal principal,
            String destination) {

        if (principal == null || destination == null
                || !destination.matches("^/topic/conversation/[0-9]+$")) {
            throw new AccessDeniedException("Subscription destination is not allowed");
        }

        long id;
        try {
            id = Long.parseLong(destination.substring(
                    "/topic/conversation/".length()
            ));
        } catch (NumberFormatException exception) {
            throw new AccessDeniedException("Conversation not found", exception);
        }

        Conversation conversation = conversationRepository
                .findById(id)
                .orElseThrow(() ->
                        new AccessDeniedException("Conversation not found"));
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() ->
                        new AccessDeniedException("Authenticated user not found"));

        boolean isMember =
                conversation.getUser1().getId().equals(user.getId())
                || conversation.getUser2().getId().equals(user.getId());

        if (!isMember) {
            throw new AccessDeniedException(
                    "You are not allowed to subscribe to this conversation");
        }
    }
}
