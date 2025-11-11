# Documentación de la API - Backend

Esta documentación describe cómo consumir la API del backend desde el frontend.

## Configuración Base

### URL Base

- **Producción**: `https://tu-backend.onrender.com` (o la URL que Render te proporcionó)
- **Desarrollo**: `http://localhost:3000`

### Headers Requeridos

Todas las peticiones deben incluir:

```javascript
{
  "Content-Type": "application/json"
}
```

Para rutas protegidas, incluir el access token:

```javascript
{
  "Authorization": "Bearer <accessToken>"
}
```

### Credenciales (Cookies)

El frontend debe enviar cookies en todas las peticiones para que el refresh token funcione:

```javascript
fetch(url, {
  credentials: "include", // Importante para cookies cross-origin
});
```

## Endpoints de Autenticación

### 1. Registro de Usuario

**POST** `/api/auth/register`

**Body:**

```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "juan@example.com",
  "password": "password123",
  "descripcion": "Estudiante de ingeniería",
  "carrera": "Ingeniería en Sistemas",
  "sede": "Campus Central",
  "edad": 22,
  "intereses": ["programación", "música", "deportes"]
}
```

**Respuesta exitosa (201):**

```json
{
  "message": "Usuario registrado exitosamente",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "65f1234567890abcdef12345",
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "juan@example.com",
    "descripcion": "Estudiante de ingeniería",
    "carrera": "Ingeniería en Sistemas",
    "sede": "Campus Central",
    "edad": 22,
    "intereses": ["programación", "música", "deportes"]
  }
}
```

**Notas:**

- El `refreshToken` se envía automáticamente como cookie httpOnly
- Los intereses son opcionales, máximo 5
- La contraseña debe tener al menos 6 caracteres

---

### 2. Inicio de Sesión

**POST** `/api/auth/login`

**Body:**

```json
{
  "email": "juan@example.com",
  "password": "password123"
}
```

**Respuesta exitosa (200):**

```json
{
  "message": "Inicio de sesión exitoso",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "65f1234567890abcdef12345",
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "juan@example.com",
    "descripcion": "Estudiante de ingeniería",
    "carrera": "Ingeniería en Sistemas",
    "sede": "Campus Central",
    "edad": 22,
    "intereses": ["programación", "música", "deportes"]
  }
}
```

**Notas:**

- El `refreshToken` se envía automáticamente como cookie httpOnly
- Guarda el `accessToken` en el estado de tu aplicación o en localStorage

---

### 3. Refrescar Token

**POST** `/api/auth/refresh`

**Headers:** No requiere Authorization (usa la cookie)

**Respuesta exitosa (200):**

```json
{
  "message": "Token renovado exitosamente",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Notas:**

- Usa la cookie `refreshToken` automáticamente
- No requiere enviar el access token en el header
- Debes enviar `credentials: 'include'` en la petición

---

### 4. Cerrar Sesión

**POST** `/api/auth/logout`

**Headers:** No requiere Authorization

**Respuesta exitosa (200):**

```json
{
  "message": "Sesión cerrada exitosamente"
}
```

**Notas:**

- Limpia la cookie del refresh token
- Limpia el access token del frontend también

---

### 5. Obtener Usuario Actual

**GET** `/api/auth/me`

**Headers:**

```json
{
  "Authorization": "Bearer <accessToken>"
}
```

**Respuesta exitosa (200):**

```json
{
  "user": {
    "id": "65f1234567890abcdef12345",
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "juan@example.com",
    "descripcion": "Estudiante de ingeniería",
    "carrera": "Ingeniería en Sistemas",
    "sede": "Campus Central",
    "edad": 22,
    "intereses": ["programación", "música", "deportes"]
  }
}
```

---

### 6. Obtener Todos los Usuarios

**GET** `/api/auth/usuarios`

**Headers:**

```json
{
  "Authorization": "Bearer <accessToken>"
}
```

**Respuesta exitosa (200):**

```json
{
  "message": "Usuarios obtenidos exitosamente",
  "usuarios": [
    {
      "id": "65f1234567890abcdef12345",
      "nombre": "Juan",
      "apellido": "Pérez",
      "email": "juan@example.com",
      "descripcion": "Estudiante de ingeniería",
      "carrera": "Ingeniería en Sistemas",
      "sede": "Campus Central",
      "edad": 22,
      "intereses": ["programación", "música", "deportes"],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 1
}
```

---

## Endpoints de Descubrimiento

### 1. Obtener Siguiente Perfil

**GET** `/api/discover/next`

**Headers:**

```json
{
  "Authorization": "Bearer <accessToken>"
}
```

**Respuesta exitosa (200):**

```json
{
  "profile": {
    "id": "65f1234567890abcdef12345",
    "nombre": "María",
    "apellido": "González",
    "email": "maria@example.com",
    "descripcion": "Estudiante de diseño",
    "carrera": "Diseño Gráfico",
    "sede": "Campus Norte",
    "edad": 21,
    "intereses": ["diseño", "arte", "fotografía"]
  }
}
```

**Respuesta si no hay más perfiles (404):**

```json
{
  "message": "No hay más perfiles disponibles"
}
```

---

### 2. Hacer Swipe (Like/Dislike)

**POST** `/api/discover/swipe`

**Headers:**

```json
{
  "Authorization": "Bearer <accessToken>"
}
```

**Body:**

```json
{
  "targetUserId": "65f1234567890abcdef12345",
  "action": "like" // o "dislike"
}
```

**Respuesta exitosa (200):**

```json
{
  "message": "Swipe registrado exitosamente",
  "isMatch": true // o false
}
```

**Notas:**

- `isMatch` será `true` solo si el otro usuario también te dio like
- Si hay match, se crea automáticamente una conversación

---

### 3. Obtener Matches

**GET** `/api/discover/matches`

**Headers:**

```json
{
  "Authorization": "Bearer <accessToken>"
}
```

**Respuesta exitosa (200):**

```json
{
  "matches": [
    {
      "matchId": "65f1234567890abcdef12345",
      "user": {
        "id": "65f1234567890abcdef12345",
        "nombre": "María",
        "apellido": "González",
        "email": "maria@example.com",
        "descripcion": "Estudiante de diseño",
        "carrera": "Diseño Gráfico",
        "sede": "Campus Norte",
        "edad": 21,
        "intereses": ["diseño", "arte", "fotografía"]
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

## Endpoints de Chat

### 1. Obtener Conversaciones

**GET** `/api/chat/conversaciones`

**Headers:**

```json
{
  "Authorization": "Bearer <accessToken>"
}
```

**Respuesta exitosa (200):**

```json
{
  "conversaciones": [
    {
      "matchId": "65f1234567890abcdef12345",
      "user": {
        "id": "65f1234567890abcdef12345",
        "nombre": "María",
        "apellido": "González",
        "email": "maria@example.com"
      },
      "lastMessage": {
        "id": "65f1234567890abcdef12345",
        "content": "Hola, ¿cómo estás?",
        "senderId": "65f1234567890abcdef12345",
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      "unreadCount": 2
    }
  ]
}
```

---

### 2. Obtener Conversación

**GET** `/api/chat/conversacion/:matchId`

**Headers:**

```json
{
  "Authorization": "Bearer <accessToken>"
}
```

**Respuesta exitosa (200):**

```json
{
  "matchId": "65f1234567890abcdef12345",
  "messages": [
    {
      "id": "65f1234567890abcdef12345",
      "content": "Hola, ¿cómo estás?",
      "senderId": "65f1234567890abcdef12345",
      "receiverId": "65f1234567890abcdef12346",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "read": false
    }
  ]
}
```

---

### 3. Enviar Mensaje

**POST** `/api/chat/mensaje`

**Headers:**

```json
{
  "Authorization": "Bearer <accessToken>"
}
```

**Body:**

```json
{
  "matchId": "65f1234567890abcdef12345",
  "content": "Hola, ¿cómo estás?"
}
```

**Respuesta exitosa (201):**

```json
{
  "message": "Mensaje enviado exitosamente",
  "mensaje": {
    "id": "65f1234567890abcdef12345",
    "content": "Hola, ¿cómo estás?",
    "senderId": "65f1234567890abcdef12345",
    "receiverId": "65f1234567890abcdef12346",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "read": false
  }
}
```

---

### 4. Marcar Mensajes como Leídos

**PUT** `/api/chat/mensajes/leidos/:matchId`

**Headers:**

```json
{
  "Authorization": "Bearer <accessToken>"
}
```

**Respuesta exitosa (200):**

```json
{
  "message": "Mensajes marcados como leídos"
}
```

---

## Manejo de Errores

### Códigos de Estado HTTP

- **200**: Éxito
- **201**: Creado exitosamente
- **400**: Error de validación (datos incorrectos)
- **401**: No autenticado (token inválido o expirado)
- **404**: Recurso no encontrado
- **409**: Conflicto (email ya registrado)
- **500**: Error interno del servidor

### Formato de Error

```json
{
  "message": "Mensaje de error descriptivo"
}
```

---

## Ejemplo de Implementación en Frontend

### Configuración de Axios

```javascript
import axios from "axios";

const API_URL =
  process.env.REACT_APP_API_URL || "https://tu-backend.onrender.com";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Importante para cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para agregar el token a las peticiones
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores 401 y refrescar el token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const response = await axios.post(
          `${API_URL}/api/auth/refresh`,
          {},
          {
            withCredentials: true,
          }
        );

        const { accessToken } = response.data;
        localStorage.setItem("accessToken", accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Si el refresh falla, redirigir al login
        localStorage.removeItem("accessToken");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

### Ejemplo de Login

```javascript
import api from "./api";

const login = async (email, password) => {
  try {
    const response = await api.post("/api/auth/login", {
      email,
      password,
    });

    const { accessToken, user } = response.data;

    // Guardar el access token
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("user", JSON.stringify(user));

    return { accessToken, user };
  } catch (error) {
    console.error("Error en login:", error.response?.data?.message);
    throw error;
  }
};
```

### Ejemplo de Logout

```javascript
import api from "./api";

const logout = async () => {
  try {
    await api.post("/api/auth/logout");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
  } catch (error) {
    console.error("Error en logout:", error);
  }
};
```

---

## Configuración en Render

### Variables de Entorno Necesarias

En Render, asegúrate de configurar estas variables de entorno:

1. **MONGO_URI**: URI de conexión a MongoDB
2. **JWT_SECRET**: Secret para firmar los tokens JWT
3. **JWT_REFRESH_SECRET**: Secret para firmar los refresh tokens
4. **FRONTEND_URL**: URL del frontend en producción (ej: `https://tu-frontend.vercel.app`)
5. **NODE_ENV**: `production`
6. **PORT**: Render lo asigna automáticamente, pero puedes configurarlo

### Configuración de CORS

El backend ya está configurado para aceptar peticiones desde:

- Localhost (en desarrollo)
- La URL configurada en `FRONTEND_URL` (en producción)

**Importante**: Asegúrate de configurar `FRONTEND_URL` en Render con la URL exacta de tu frontend (con https://).

---

## Notas Importantes

1. **Cookies Cross-Origin**: En producción, las cookies funcionan entre dominios diferentes gracias a `sameSite: 'none'` y `secure: true`. Asegúrate de que tu frontend esté en HTTPS.

2. **Refresh Token**: El refresh token se maneja automáticamente mediante cookies httpOnly, por lo que no necesitas guardarlo manualmente en el frontend.

3. **Access Token**: El access token debe guardarse en el frontend (localStorage, sessionStorage, o estado de la aplicación) y enviarse en el header `Authorization` de todas las peticiones protegidas.

4. **Renovación Automática**: Implementa un interceptor en tu cliente HTTP (Axios, Fetch, etc.) para renovar automáticamente el access token cuando expire.

5. **CORS**: Si tienes problemas con CORS, verifica que:
   - `FRONTEND_URL` esté configurada correctamente en Render
   - El frontend esté haciendo peticiones con `credentials: 'include'` o `withCredentials: true`
   - El frontend esté en HTTPS si el backend está en HTTPS

---

## Testing

Puedes probar los endpoints usando herramientas como:

- Postman
- Thunder Client (VS Code)
- curl
- Tu frontend

**Ejemplo con curl:**

```bash
# Login
curl -X POST https://tu-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@example.com","password":"password123"}' \
  -c cookies.txt

# Obtener usuario actual (usando el token de la respuesta anterior)
curl -X GET https://tu-backend.onrender.com/api/auth/me \
  -H "Authorization: Bearer <accessToken>" \
  -b cookies.txt
```
