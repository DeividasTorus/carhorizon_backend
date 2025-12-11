const pool = require('../config/db');

// Randa chatą tarp konkretaus owner + other_user dėl konkretaus car,
// IR su konkrečiu siuntėjo auto (initiator_car_id).
const findChatBetween = async (carId, ownerId, otherUserId, initiatorCarId) => {
  const result = await pool.query(
    `SELECT *
     FROM chats
     WHERE car_id = $1
       AND owner_id = $2
       AND other_user_id = $3
       AND initiator_car_id = $4
     LIMIT 1`,
    [carId, ownerId, otherUserId, initiatorCarId]
  );
  return result.rows[0];
};

// Randa chat'ą BIDIRECTIONALIAI tarp dviejų automobilių (neatsižvelgiant į kryptį)
// Tai yra: ar jau egzistuoja pokalbis tarp car1 ir car2, bet kurioje kryptyje
const findChatBidirectional = async (car1Id, car2Id) => {
  const result = await pool.query(
    `SELECT *
     FROM chats
     WHERE (car_id = $1 AND initiator_car_id = $2)
        OR (car_id = $2 AND initiator_car_id = $1)
     LIMIT 1`,
    [car1Id, car2Id]
  );
  return result.rows[0];
};

// Sukuria naują chat'ą
const createChat = async (carId, ownerId, otherUserId, initiatorCarId) => {
  const result = await pool.query(
    `INSERT INTO chats (car_id, owner_id, other_user_id, initiator_car_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [carId, ownerId, otherUserId, initiatorCarId]
  );
  return result.rows[0];
};

// Paimti chat'ą pagal id
const getChatById = async (chatId) => {
  const result = await pool.query(
    `SELECT *
     FROM chats
     WHERE id = $1`,
    [chatId]
  );
  return result.rows[0];
};

// Pažymėti, kad vartotojas perskaitė chat'ą (įrašom/atnaujinam last_read_at)
const markChatRead = async (chatId, userId) => {
  const result = await pool.query(
    `INSERT INTO chat_reads (chat_id, user_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (chat_id, user_id)
     DO UPDATE SET last_read_at = EXCLUDED.last_read_at
     RETURNING *`,
    [chatId, userId]
  );
  return result.rows[0];
};

// Inbox'ui grąžina chat'us + paskutinę žinutę + kito userio avatarą + has_unread
// IR jau paskaičiuoja display_car_plate / display_car_model pagal prisijungusį userį.
const getInboxForUser = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      c.id,
      c.car_id,
      c.initiator_car_id,
      c.owner_id,
      c.other_user_id,

      -- savininko auto (tas, kurio savininkas yra owner_id)
      owner_car.plate   AS owner_car_plate,
      owner_car.model   AS owner_car_model,

      -- siuntėjo (initiator) auto - gali būti NULL
      init_car.plate    AS initiator_car_plate,
      init_car.model    AS initiator_car_model,

      -- tai, kas turi būti rodoma konkrečiam prisijungusiam useriui (userId = $1)
      -- jei aš esu owner -> rodau SIUNTĖJO auto
      -- jei aš esu other_user -> rodau OWNER auto
      CASE
        WHEN c.owner_id = $1 THEN init_car.plate
        ELSE owner_car.plate
      END AS display_car_plate,

      CASE
        WHEN c.owner_id = $1 THEN init_car.model
        ELSE owner_car.model
      END AS display_car_model,

      CASE
        WHEN c.owner_id = $1 THEN init_car.avatar_url
        ELSE owner_car.avatar_url
      END AS display_car_avatar_url,

      m.text       AS last_text,
      m.created_at AS last_created_at,
      m.sender_id  AS last_sender_id,

      COALESCE(
        (
          m.created_at IS NOT NULL
          AND (
            cr_me.last_read_at IS NULL
            OR m.created_at > cr_me.last_read_at
          )
          AND m.sender_id <> $1
        ),
        FALSE
      ) AS has_unread

    FROM chats c
    JOIN users owner
      ON owner.id = c.owner_id
    JOIN users other_u
      ON other_u.id = c.other_user_id

    -- čia prisirišam prie konkretaus owner auto
    JOIN cars owner_car
      ON owner_car.id = c.car_id

    -- siuntėjo auto gali nebūti (jei senas chat'as be iniciatoriaus)
    LEFT JOIN cars init_car
      ON init_car.id = c.initiator_car_id

    LEFT JOIN LATERAL (
      SELECT id, text, created_at, sender_id
      FROM messages
      WHERE chat_id = c.id
      ORDER BY created_at DESC
      LIMIT 1
    ) m ON true

    LEFT JOIN chat_reads cr_me
      ON cr_me.chat_id = c.id
     AND cr_me.user_id = $1

    WHERE c.owner_id = $1
       OR c.other_user_id = $1

    ORDER BY m.created_at DESC NULLS LAST, c.id DESC
    `,
    [userId]
  );
  return result.rows;
};

const getOtherUserLastReadAt = async (chatId, userId) => {
  const result = await pool.query(
    `SELECT cr.last_read_at
     FROM chat_reads cr
     JOIN chats c ON c.id = cr.chat_id
     WHERE cr.chat_id = $1
       AND cr.user_id = CASE
         WHEN c.owner_id = $2 THEN c.other_user_id
         ELSE c.owner_id
       END
     LIMIT 1`,
    [chatId, userId]
  );
  return result.rows[0]?.last_read_at || null;
};

module.exports = {
  findChatBetween,
  findChatBidirectional,
  createChat,
  getChatById,
  getInboxForUser,
  markChatRead,
  getOtherUserLastReadAt,
};

