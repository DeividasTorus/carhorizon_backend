// src/controllers/chatController.js
const { getCarById } = require('../models/carModel');
const {
  findChatBetween,
  findChatBidirectional,
  createChat,
  getChatById,
  getInboxForUser,
  markChatRead,
  getOtherUserLastReadAt,
} = require('../models/chatModel');
const { createMessage, getMessagesByChat } = require('../models/messageModel');
const { emitToUser } = require('../socket');



// POST /api/chats/open
const openChat = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { carId, fromCarId } = req.body || {};

    if (!carId) {
      return res.status(400).json({ error: 'carId is required' });
    }
    if (!fromCarId) {
      return res.status(400).json({ error: 'fromCarId (initiator car) is required' });
    }

    // tas auto, dėl kurio RAŠOME (owner auto)
    const car = await getCarById(carId);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const ownerId = car.user_id;
    const otherUserId = userId;

    // mano aktyvus auto (iš kurio rašau) - turi būti mano
    const fromCar = await getCarById(fromCarId);
    if (!fromCar || fromCar.user_id !== userId) {
      return res.status(403).json({ error: 'fromCarId does not belong to current user' });
    }

    const initiatorCarId = fromCar.id;

    // 🔍 PATIKRA: Ar jau egzistuoja pokalbis tarp tų dviejų automobilių (ANY DIRECTION)?
    let chat = await findChatBidirectional(carId, initiatorCarId);
    
    if (chat) {
      // ✅ Pokalbis jau egzistuoja - grąžink jį
      console.log('Chat already exists, returning existing:', chat.id);
      return res.json({ 
        chatId: chat.id, 
        id: chat.id,
        isExisting: true 
      });
    }

    // ❌ Pokalbis neegzistuoja - kurii naują
    console.log('Creating new chat between car', carId, 'and', initiatorCarId);
    
    // dabar chat'as unikalus pagal:
    // - car_id (owner auto)
    // - owner_id
    // - other_user_id
    // - initiator_car_id (mano auto, iš kurio rašau)
    chat = await createChat(carId, ownerId, otherUserId, initiatorCarId);

    return res.json({ 
      chatId: chat.id,
      id: chat.id,
      isExisting: false 
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/chats/inbox
const inbox = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const threads = await getInboxForUser(userId);
    
    // Formatuojame atsakymą su other_user objektu
    const formattedThreads = threads.map(thread => {
      // Nustatome kuris yra "kitas" vartotojas
      const otherUserId = thread.owner_id === userId ? thread.other_user_id : thread.owner_id;
      
      return {
        id: thread.id,
        chat_id: thread.id,
        car_id: thread.car_id,
        initiator_car_id: thread.initiator_car_id,
        owner_id: thread.owner_id,
        other_user_id: thread.other_user_id,
        display_car_plate: thread.display_car_plate,
        display_car_model: thread.display_car_model,
        display_car_avatar_url: thread.display_car_avatar_url,
        last_text: thread.last_text,
        last_created_at: thread.last_created_at,
        last_sender_id: thread.last_sender_id,
        has_unread: thread.has_unread,
        other_user: {
          id: otherUserId
        }
      };
    });
    
    return res.json(formattedThreads);
  } catch (err) {
    next(err);
  }
};

// GET /api/chats/:chatId/messages
const getMessages = async (req, res, next) => {
  try {
    const chatId = req.params.chatId;
    const userId = req.user.id;
    const chat = await getChatById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (chat.owner_id !== userId && chat.other_user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const messages = await getMessagesByChat(chatId);
    return res.json(messages);
  } catch (err) {
    next(err);
  }
};

// POST /api/chats/:chatId/messages
const postMessage = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { chatId } = req.params;
    const { text } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const chat = await getChatById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // ar useris dalyvauja šiame chate
    if (chat.owner_id !== userId && chat.other_user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const msg = await createMessage(chatId, userId, text.trim());

    // emitinam abiem pokalbio dalyviams
    const participants = [chat.owner_id, chat.other_user_id];

    participants.forEach((uid) => {
      emitToUser(uid, 'message', msg);
      emitToUser(uid, 'inbox_update', {
        chatId: chat.id,
        car_id: chat.car_id,
        owner_id: chat.owner_id,
        other_user_id: chat.other_user_id,
        last_text: msg.text,
        last_created_at: msg.created_at,
      });
    });

    return res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
};

// POST /api/chats/:chatId/read
const markRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    const chat = await getChatById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.owner_id !== userId && chat.other_user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const row = await markChatRead(chatId, userId);

    // 🔴 LIVE READ EVENT per socket
    const payload = {
      chatId: chat.id,
      reader_id: userId,
      last_read_at: row.last_read_at,
    };

    [chat.owner_id, chat.other_user_id].forEach((uid) => {
      emitToUser(uid, 'chat_read', payload);
    });

    return res.json({ last_read_at: row.last_read_at });
  } catch (err) {
    next(err);
  }
};

const readStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    const chat = await getChatById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // ar useris priklauso chato dalyviams
    if (chat.owner_id !== userId && chat.other_user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const otherLastReadAt = await getOtherUserLastReadAt(chatId, userId);

    return res.json({
      other_last_read_at: otherLastReadAt, // gali būt null
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  openChat,
  inbox,
  getMessages,
  postMessage,
  markRead,
  readStatus,
};
