CREATE DATABASE IF NOT EXISTS habit_tracker_db;
USE habit_tracker_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS habits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  habit_name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  status TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_habits_user_date (user_id, date)
);

CREATE TABLE IF NOT EXISTS uploaded_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  source VARCHAR(50) NOT NULL,
  value FLOAT NOT NULL,
  date DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_uploaded_user_date (user_id, date)
);

INSERT INTO users (email, password, name)
VALUES ('demo@example.com', 'password', 'Demo User')
ON DUPLICATE KEY UPDATE name = VALUES(name);

