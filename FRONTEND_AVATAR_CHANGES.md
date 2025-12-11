# Frontend Changes Required - Car Avatar System

## Overview
Backend dabar naudoja tik **automobilių avatarus**. Visi vartotojų avatarų funkcionalumai pašalinti.

---

## 1. API Response Changes

### **Users** (Pašalinta)
```javascript
// SENAI (NEBEVEIKIA):
user: {
  id: 1,
  email: "user@example.com",
  profile_image_url: "/uploads/avatars/..." // ❌ PAŠALINTA
}

// DABAR:
user: {
  id: 1,
  email: "user@example.com"
  // profile_image_url NEBEEGZISTUOJA
}
```

### **Cars** (Nauja)
```javascript
// DABAR CARS turi avatar_url:
car: {
  id: 1,
  plate: "ABC123",
  model: "BMW M3",
  year: 2020,
  avatar_url: "/uploads/cars/car-1733757890123.jpg" // ✅ NAUJAS laukas
}
```

---

## 2. Endpoints That Changed

### **Auth Endpoints**
- `POST /api/auth/register` - response **NETURI** `profile_image_url`
- `POST /api/auth/login` - response **NETURI** `profile_image_url`
- `GET /api/users/me` - response **NETURI** `profile_image_url`

### **Car Endpoints**
- `GET /api/cars` - kiekvienas car objektas **TURI** `avatar_url`
- `GET /api/cars/:carId` - response **TURI** `avatar_url`
- `POST /api/cars/create` - response **TURI** `avatar_url`
- `PUT /api/cars/:carId/active` - response **TURI** `avatar_url`

### **Post Endpoints**
```javascript
// GET /api/posts/feed
// GET /api/cars/:carId/posts
{
  posts: [
    {
      author: {
        id: 1,
        email: "user@example.com"
        // profile_image_url PAŠALINTA ❌
      },
      car: {
        id: 1,
        plate: "ABC123",
        model: "BMW M3",
        // avatar_url YRA čia jei reikia ✅
      }
    }
  ]
}
```

### **Chat Endpoints**
```javascript
// GET /api/chats/inbox
{
  threads: [
    {
      other_user: {
        id: 2
        // avatar_url PAŠALINTA ❌
      },
      display_car_plate: "XYZ789",
      display_car_model: "Audi RS6"
    }
  ]
}
```

---

## 3. New Endpoint - Car Avatar Upload

### **PUT /api/cars/:carId/avatar**
- **Authentication**: Required (Bearer token)
- **Content-Type**: `multipart/form-data`
- **Body**: Form data su `avatar` field (file)
- **Validation**:
  - Max size: 5MB
  - Allowed types: JPEG, PNG, WebP
  - User must own the car

**Request Example:**
```javascript
const formData = new FormData();
formData.append('avatar', fileInput.files[0]);

fetch(`/api/cars/${carId}/avatar`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Response:**
```json
{
  "success": true,
  "message": "Car avatar uploaded successfully",
  "car": {
    "id": 1,
    "plate": "ABC123",
    "model": "BMW M3",
    "year": 2020,
    "avatar_url": "/uploads/cars/car-1733757890123.jpg",
    "user_id": 1,
    "is_active": true
  }
}
```

---

## 4. Removed Endpoints

### **User Avatar Upload (PAŠALINTA)**
- ~~`PUT /api/users/avatar`~~ ❌ **NEBEVEIKIA**

---

## 5. Frontend Tasks

### **Reikia pakeisti:**

1. **User Profile Components**
   - Pašalinti visus `user.profile_image_url` naudojimus
   - Pašalinti user avatar upload formas/buttons
   - Jei rodote user avatar - naudokite placeholder arba visai pašalinkite

2. **Car Components**
   - Pridėti `car.avatar_url` rodymo logiką
   - Sukurti car avatar upload komponentą
   - Naudoti `/uploads/cars/...` kaip image source
   - Default placeholder jei `avatar_url` yra `null`

3. **Post Feed**
   - Post author **NEBETURI** `profile_image_url`
   - Jei norite rodyti avatarą prie posto - naudokite `post.car.avatar_url`
   - Arba rodykite tik author email be avataro

4. **Chat Inbox**
   - `other_user` objektas **NEBETURI** `avatar_url`
   - Naudokite `display_car_plate` ir `display_car_model` vietoj vartotojo avataro
   - Arba pridėkite car avatar fetch logiką pagal car_id

5. **API Calls**
   - Patikrinti visas vietas kur tikimasi `profile_image_url` response
   - Pašalinti arba pakeisti į `car.avatar_url`
   - Pridėti car avatar upload funkcionalumą

---

## 6. Example Implementations

### **Car Avatar Display Component**
```jsx
// React example
function CarAvatar({ car, size = 50 }) {
  const avatarUrl = car?.avatar_url 
    ? `${API_BASE_URL}${car.avatar_url}` 
    : '/placeholder-car.png';
  
  return (
    <img 
      src={avatarUrl} 
      alt={car?.plate || 'Car'}
      width={size}
      height={size}
      style={{ borderRadius: '8px', objectFit: 'cover' }}
    />
  );
}
```

### **Car Avatar Upload Component**
```jsx
function CarAvatarUpload({ carId, onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large (max 5MB)');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploading(true);
    try {
      const response = await fetch(`/api/cars/${carId}/avatar`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        },
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        onUploadSuccess(data.car);
        alert('Avatar uploaded!');
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
    </div>
  );
}
```

### **Post Author Display (No Avatar)**
```jsx
function PostAuthor({ post }) {
  return (
    <div className="post-author">
      <span>{post.author.email}</span>
      {/* profile_image_url NEBEEGZISTUOJA */}
      
      {/* JEIGU norite rodyti car avatar: */}
      {post.car && <CarAvatar car={post.car} size={30} />}
    </div>
  );
}
```

---

## 7. Migration Checklist

- [ ] Pašalinti visus `user.profile_image_url` naudojimus
- [ ] Pašalinti user avatar upload UI
- [ ] Pridėti `car.avatar_url` rodymo logiką
- [ ] Sukurti car avatar upload komponentą
- [ ] Atnaujinti API response type definitions (TypeScript)
- [ ] Patikrinti post feed - author neturi avataro
- [ ] Patikrinti chat inbox - other_user neturi avataro
- [ ] Pridėti placeholder images car avatars
- [ ] Testuoti car avatar upload

---

## 8. Important Notes

- **Visi failai dabar kraunasi į `/uploads/cars/`** (ne `/uploads/avatars/`)
- **Backend automatiškai validuoja ownership** - negalite įkelti avataro automobiliui kurio nesate savininkas
- **Max file size: 5MB**
- **Allowed formats: JPEG, PNG, WebP**
- **Avatar URL formatas**: `/uploads/cars/car-{timestamp}-{random}.{ext}`

---

## 9. Testing Endpoints

```bash
# Get user info (NO profile_image_url)
GET /api/users/me
Authorization: Bearer <token>

# Get cars (WITH avatar_url)
GET /api/cars
Authorization: Bearer <token>

# Upload car avatar
PUT /api/cars/1/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: avatar=<file>

# Get car stats
GET /api/cars/1/stats

# Get car followers (includes avatar_url)
GET /api/cars/1/followers

# Get car following (includes avatar_url)
GET /api/cars/1/following
```

---

**Jei turite klausimų - klauskite!** 🚗
