
package com.chatapp.chatapp.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.chatapp.chatapp.entity.Conversation;

public interface ConversationRepository
        extends JpaRepository<Conversation, Long> {

    // Find existing conversation between two users
    @Query("""
        SELECT c FROM Conversation c
        WHERE (c.user1.id = :user1Id AND c.user2.id = :user2Id)
        OR (c.user1.id = :user2Id AND c.user2.id = :user1Id)
    """)
    Optional<Conversation> findConversation(
            @Param("user1Id") Long user1Id,
            @Param("user2Id") Long user2Id
    );

    // Get all conversations of logged-in user
    @Query("""
        SELECT c FROM Conversation c
        JOIN FETCH c.user1
        JOIN FETCH c.user2
        WHERE c.user1.id = :userId
        OR c.user2.id = :userId
        ORDER BY c.createdAt DESC
    """)
    List<Conversation> findAllUserConversations(
            @Param("userId") Long userId
    );
}
