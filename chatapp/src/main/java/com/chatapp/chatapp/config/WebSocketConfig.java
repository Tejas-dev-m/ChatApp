
package com.chatapp.chatapp.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthInterceptor authInterceptor;

    public WebSocketConfig(
            WebSocketAuthInterceptor authInterceptor) {

        this.authInterceptor = authInterceptor;
    }

    // Configure message broker
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {

        // Messages delivered to subscribed clients
        config.enableSimpleBroker("/topic");

        // Messages sent from the browser client to Spring Boot
        config.setApplicationDestinationPrefixes("/app");
    }

    // Register WebSocket endpoint
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {

        registry.addEndpoint("/ws")
                .setAllowedOrigins("http://localhost:5173");
    }

    // Validate JWT during STOMP connection
    @Override
    public void configureClientInboundChannel(
            ChannelRegistration registration) {

        registration.interceptors(authInterceptor);
    }
}
