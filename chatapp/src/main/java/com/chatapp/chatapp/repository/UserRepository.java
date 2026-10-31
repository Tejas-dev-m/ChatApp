
package com.chatapp.chatapp.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.chatapp.chatapp.entity.User;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByMobileNumber(String mobileNumber);

    Optional<User> findByEmail(String email);

    boolean existsByMobileNumber(String mobileNumber);

    boolean existsByEmail(String email);
}
