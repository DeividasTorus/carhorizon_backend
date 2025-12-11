-- CarHorizon database schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cars (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cars
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE cars
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

ALTER TABLE cars
  ADD COLUMN IF NOT EXISTS bio TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS cars_plate_user_unique
  ON cars(user_id, plate);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_car_per_user
  ON cars(user_id)
  WHERE is_active = TRUE;


CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  other_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE chats
ADD COLUMN IF NOT EXISTS initiator_car_id INTEGER REFERENCES cars(id);

-- 👇 Dedupliciravljimo constraints
ALTER TABLE chats
ADD COLUMN IF NOT EXISTS car_id_min INTEGER GENERATED ALWAYS AS (LEAST(car_id, COALESCE(initiator_car_id, car_id))) STORED;

ALTER TABLE chats
ADD COLUMN IF NOT EXISTS car_id_max INTEGER GENERATED ALWAYS AS (GREATEST(car_id, COALESCE(initiator_car_id, car_id))) STORED;

-- Unique constraint - neleisti two duplicate chats tarp tų pačių automobilių
CREATE UNIQUE INDEX IF NOT EXISTS unique_chat_pair 
  ON chats(car_id_min, car_id_max)
  WHERE initiator_car_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chats_initiator_car_id 
  ON chats(initiator_car_id);

CREATE INDEX IF NOT EXISTS idx_chats_other_user_id 
  ON chats(other_user_id);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_reads (
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

-- Posts system tables (CAR-BASED)

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_published BOOLEAN DEFAULT TRUE,
  post_type VARCHAR(50) DEFAULT 'car_post'
);

CREATE TABLE IF NOT EXISTS post_images (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  image_url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS car_followers (
  id SERIAL PRIMARY KEY,
  follower_car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  followed_car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_car_id, followed_car_id),
  CHECK (follower_car_id != followed_car_id)
);

-- Posts indeksai
CREATE INDEX IF NOT EXISTS idx_posts_car_id ON posts(car_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON post_images(post_id);
CREATE INDEX IF NOT EXISTS idx_car_followers_follower ON car_followers(follower_car_id);
CREATE INDEX IF NOT EXISTS idx_car_followers_followed ON car_followers(followed_car_id);
CREATE INDEX IF NOT EXISTS idx_car_followers_both ON car_followers(follower_car_id, followed_car_id);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(is_published);

-- Post likes table
CREATE TABLE IF NOT EXISTS post_likes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, car_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_car_id ON post_likes(car_id);

-- Post comments table
CREATE TABLE IF NOT EXISTS post_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add updated_at column if it doesn't exist
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_car_id ON post_comments(car_id);

-- Comment likes table
CREATE TABLE IF NOT EXISTS comment_likes (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comment_id, car_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_car_id ON comment_likes(car_id);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  recipient_car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  actor_car_id INTEGER REFERENCES cars(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  comment_id INTEGER REFERENCES post_comments(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_car_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_car_id, is_read);


