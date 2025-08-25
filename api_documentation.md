# API Документация

## 1️⃣ Получение токена
**POST /auth/token**
Ответ:
```json
{
  "token": "jwt_token_string"
}
```

## 2️⃣ Получение списка пользователей
**GET /users**
Ответ:
```json
[
  { "id": 1, "name": "Alice", "balance": 1000 },
  { "id": 2, "name": "Bob", "balance": 500 }
]
```

## 3️⃣ Получение заказов пользователя
**GET /users/:id/orders**
Ответ:
```json
{ "orders": ["Order1", "Order2"] }
```

## 4️⃣ Получение баланса пользователя
**GET /users/:id/balance**
Ответ:
```json
{ "balance": 1000 }
```

## 5️⃣ Создание пользователя
**POST /users**
Тело запроса:
```json
{
  "name": "Charlie",
  "balance": 800
}
```
Ответ:
```json
{
  "id": 3,
  "name": "Charlie",
  "balance": 800
}
```

## 6️⃣ Редактирование пользователя
**PUT /users/:id**
Ответ:
```json
{
  "id": 1,
  "name": "Alice Updated",
  "balance": 1200
}
```

## 7️⃣ Удаление пользователя
**DELETE /users/:id**
Ответ:
```json
{
  "message": "User deleted"
}
```
