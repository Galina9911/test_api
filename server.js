const express = require('express');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { faker } = require('@faker-js/faker');
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' })); // Увеличиваем лимит до 50MB
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Для form-data

const db = new sqlite3.Database('database.db');

db.serialize(() => {
    // Создаем таблицу cities
    db.run("CREATE TABLE IF NOT EXISTS cities (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, country TEXT NOT NULL)");

    // Создаем таблицу users (с добавлением столбца city_id)
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city_id INTEGER, phone TEXT, email TEXT, registration_date TEXT, balance INTEGER, FOREIGN KEY (city_id) REFERENCES cities(id))");

    // Создаем таблицу orders
    db.run("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, user_id INTEGER, item TEXT, amount INTEGER, date TEXT, payment_method TEXT, status TEXT, FOREIGN KEY (user_id) REFERENCES users(id))");

    // Включаем поддержку внешних ключей
    db.run("PRAGMA foreign_keys = ON;");

    // Проверяем, сколько пользователей уже есть
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (err) {
            console.error("Database error:", err);
            return;
        }

        let existingUsers = row ? row.count : 0;

        // Если пользователей меньше 20, добавляем новых
        if (existingUsers < 20) {
            let stmt = db.prepare("INSERT INTO users (name, city_id, phone, email, registration_date, balance) VALUES (?, ?, ?, ?, ?, ?)");
            for (let i = 0; i < (20 - existingUsers); i++) {
                // Для примера, добавляем случайный city_id
                const cityId = Math.floor(Math.random() * 5) + 1; // Пример для случайных городов от 1 до 5
                stmt.run(
                    faker.person.fullName(),
                    cityId,  // Используем случайный city_id
                    faker.phone.number(),
                    faker.internet.email(),
                    faker.date.past().toISOString().split('T')[0],
                    faker.number.int({ min: 1000, max: 50000 })
                );
            }
            stmt.finalize();
        }
    });
});

const SECRET_KEY = "your_secret_key";

// Middleware для проверки токена
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Access denied, token missing" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
}

// Middleware для проверки роли "admin"
function authorizeAdmin(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admins only." });
    }
    next();
}

const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API Тестового Бэкенда",
            version: "1.0.0",
            description: "Документация для API тестового бэкенда http://localhost:3000/swagger.json",
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Локальный сервер",
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
            schemas: {
                UserRole: {  // 👈 Описание ролей (admin, user)
                    type: "string",
                    enum: ["admin", "user"],
                    example: "admin"
                }
            }
        },
        security: [{ bearerAuth: [] }], // 👈 Это включит авторизацию по токену
    },
    apis: ["./server.js"],
};

// Генерация документации
const swaggerSpec = swaggerJsdoc(swaggerOptions);


// Логируем сгенерированную спецификацию Swagger
console.log(swaggerSpec);
app.get("/swagger.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
});

// Подключаем Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

console.log("Swagger доступен по адресу: http://localhost:3000/api-docs");

/**
 * @swagger
 * /auth/token:
 *   post:
 *     summary: Получить токен аутентификации
 *     description: Возвращает JWT-токен для пользователя или администратора.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, user]
 *                 example: "admin"
 *     responses:
 *       200:
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 */

// Получение токена
app.post('/auth/token', (req, res) => {
    const { role } = req.body; // Получаем роль из запроса
    if (!role || (role !== "admin" && role !== "user")) {
        return res.status(400).json({ error: "Invalid role. Use 'admin' or 'user'" });
    }

    const token = jwt.sign({ user: "test_user", role }, SECRET_KEY, { expiresIn: '30m' });
    res.json({ token });
});

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Удалить пользователя (только администратор)
 *     description: Удаляет пользователя по ID (требуется авторизация администратора).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID пользователя для удаления
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Пользователь успешно удалён
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User deleted successfully
 *       403:
 *         description: Доступ запрещён (если не администратор)
 */


//Новая роль для удаления
app.delete('/users/:id', authenticateToken, authorizeAdmin, (req, res) => {
    db.run("DELETE FROM users WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User deleted successfully" });
    });
});
/**
 * @swagger
 * /cities:
 *   post:
 *     summary: Добавить новый город
 *     description: Добавляет новый город в таблицу cities.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Москва"
 *               country:
 *                 type: string
 *                 example: "Россия"
 *     responses:
 *       201:
 *         description: Город успешно добавлен
 *       400:
 *         description: Ошибка в запросе (не указаны обязательные поля)
 *       500:
 *         description: Ошибка сервера
 */
app.post('/cities', authenticateToken, (req, res) => {
    const { name, country } = req.body;

    if (!name || !country) {
        return res.status(400).json({ error: "Both 'name' and 'country' are required" });
    }

    db.run("INSERT INTO cities (name, country) VALUES (?, ?)", [name, country], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name, country });
    });
});

/**
 * @swagger
 * /users/{id}/city:
 *   put:
 *     summary: Обновить город пользователя
 *     description: Обновляет город пользователя по его ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID пользователя
 *         schema:
 *           type: integer
 *           example: 5
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               city_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Город пользователя успешно обновлен
 *       400:
 *         description: Ошибка в запросе (не указан ID города)
 *       500:
 *         description: Ошибка сервера
 */
app.put('/users/:id/city', authenticateToken, (req, res) => {
    const { city_id } = req.body;

    if (!city_id) {
        return res.status(400).json({ error: "City ID is required" });
    }

    db.run("UPDATE users SET city_id = ? WHERE id = ?", [city_id, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User city updated successfully" });
    });
});
/**
 * @swagger
 * /users:
 *   get:
 *     summary: Получить список пользователей
 *     description: Возвращает массив пользователей (требуется авторизация).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   name:
 *                     type: string
 *                     example: Иван Иванов
 *                   city:
 *                     type: string
 *                     example: Москва
 *                   phone:
 *                     type: string
 *                     example: +7 900 123 4567
 *                   email:
 *                     type: string
 *                     example: ivan@example.com
 *                   registration_date:
 *                     type: string
 *                     example: 2024-02-20
 *                   balance:
 *                     type: integer
 *                     example: 10000
 */

// Получение списка пользователей
app.get('/users', authenticateToken, (req, res) => {
    db.all("SELECT id, name, city, phone, email, registration_date, balance FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


/**
 * @swagger
 * /users/{id}/orders:
 *   get:
 *     summary: Получить заказы пользователя
 *     description: Возвращает список заказов пользователя по его ID (требуется авторизация).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID пользователя, заказы которого нужно получить
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orders:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       item:
 *                         type: string
 *                         example: "Игровой ноутбук ASUS"
 *                       amount:
 *                         type: integer
 *                         example: 120000
 *                       date:
 *                         type: string
 *                         example: "2024-02-25"
 *                       payment_method:
 *                         type: string
 *                         example: "Карта"
 *                       status:
 *                         type: string
 *                         example: "Оплачен"
 */

// Получение заказов пользователя
app.get('/users/:id/orders', authenticateToken, (req, res) => {
    db.all("SELECT id, item, amount, date, payment_method, status FROM orders WHERE user_id = ?", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ orders: rows });
    });
});

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Создать нового пользователя
 *     description: Добавляет пользователя в базу данных (требуется авторизация).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Алексей Петров
 *               city:
 *                 type: string
 *                 example: Санкт-Петербург
 *               phone:
 *                 type: string
 *                 example: +7 911 555 7777
 *               email:
 *                 type: string
 *                 example: alex@example.com
 *               registration_date:
 *                 type: string
 *                 example: 2024-02-25
 *               balance:
 *                 type: integer
 *                 example: 15000
 *     responses:
 *       200:
 *         description: Пользователь успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 21
 *                 name:
 *                   type: string
 *                   example: Алексей Петров
 */
app.post('/users', authenticateToken, (req, res) => {
    const { name, city, phone, email, registration_date, balance } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: "Поле name обязательно" });
    }

    db.run("INSERT INTO users (name, city, phone, email, registration_date, balance) VALUES (?, ?, ?, ?, ?, ?)",
        [name, city, phone, email, registration_date, balance], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name, city, phone, email, registration_date, balance });
    });
});


/**
 * @swagger
 * /users/{id}/orders:
 *   post:
 *     summary: Создание заказа
 *     description: Позволяет пользователю создать новый заказ. Требуется авторизация.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID пользователя, для которого создаётся заказ
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               item:
 *                 type: string
 *                 example: "Игровой ноутбук ASUS"
 *               amount:
 *                 type: integer
 *                 example: 120000
 *               date:
 *                 type: string
 *                 example: "2024-02-25"
 *               payment_method:
 *                 type: string
 *                 example: "Карта"
 *               status:
 *                 type: string
 *                 example: "Оплачен"
 *     responses:
 *       200:
 *         description: Заказ успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Order created successfully"
 *                 order_id:
 *                   type: integer
 *                   example: 101
 *       400:
 *         description: Ошибка - некорректные данные
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Некорректные данные"
 */

// Создание заказа
app.post('/users/:id/orders', authenticateToken, (req, res) => {
    const { item, amount, date, payment_method, status } = req.body;
    db.run("INSERT INTO orders (user_id, item, amount, date, payment_method, status) VALUES (?, ?, ?, ?, ?, ?)",
        [req.params.id, item, amount, date, payment_method, status], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Order created successfully", order_id: this.lastID });
    });
});

/**
 * @swagger
 * /company-info:
 *   get:
 *     summary: Получить информацию о компании
 *     description: Возвращает основные сведения о компании, включая адрес, телефон и режим работы.
 *     security: []  # 👈 Отключаем авторизацию для этого запроса
 *     responses:
 *       200:
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: "ООО Тестовая Компания"
 *                 address:
 *                   type: string
 *                   example: "г. Москва, ул. Примерная, д. 10"
 *                 phone:
 *                   type: string
 *                   example: "+7 900 123 45 67"
 *                 working_hours:
 *                   type: string
 *                   example: "Пн-Пт 9:00 - 18:00"
 */

// Эндпоинт для получения информации о компании
app.get('/company-info', (req, res) => {
    res.json({
        name: "ООО Тестовая Компания",
        address: "г. Москва, ул. Примерная, д. 10",
        phone: "+7 900 123 45 67",
        working_hours: "Пн-Пт 9:00 - 18:00"
    });
});

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Частичное обновление информации о пользователе
 *     description: Позволяет обновить только определённые поля пользователя. Требуется авторизация.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID пользователя
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               city:
 *                 type: string
 *                 example: "Санкт-Петербург"
 *               phone:
 *                 type: string
 *                 example: "+7 911 123 45 67"
 *     responses:
 *       200:
 *         description: Данные пользователя успешно обновлены
 */
app.patch('/users/:id', authenticateToken, (req, res) => {
    const { city, phone } = req.body;
    if (!city && !phone) {
        return res.status(400).json({ error: "Необходимо передать хотя бы одно поле для обновления" });
    }
    db.run("UPDATE users SET city = COALESCE(?, city), phone = COALESCE(?, phone) WHERE id = ?",
        [city, phone, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Данные пользователя успешно обновлены" });
    });
});

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Полное обновление информации о пользователе
 *     description: Позволяет полностью заменить информацию о пользователе. Требуется авторизация.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID пользователя
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Алексей Смирнов"
 *               city:
 *                 type: string
 *                 example: "Казань"
 *               phone:
 *                 type: string
 *                 example: "+7 912 345 67 89"
 *               email:
 *                 type: string
 *                 example: "alex@example.com"
 *               registration_date:
 *                 type: string
 *                 example: "2024-01-15"
 *               balance:
 *                 type: integer
 *                 example: 15000
 *     responses:
 *       200:
 *         description: Информация о пользователе полностью обновлена
 */
app.put('/users/:id', authenticateToken, (req, res) => {
    const { name, city, phone, email, registration_date, balance } = req.body;
    if (!name || !city || !phone || !email || !registration_date || balance === undefined) {
        return res.status(400).json({ error: "Все поля должны быть заполнены" });
    }
    db.run("UPDATE users SET name = ?, city = ?, phone = ?, email = ?, registration_date = ?, balance = ? WHERE id = ?",
        [name, city, phone, email, registration_date, balance, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Информация о пользователе полностью обновлена" });
    });
});

/**
 * @swagger
 * /error:
 *   get:
 *     summary: Искусственно вызвать ошибку 500
 *     description: Эндпоинт, который всегда возвращает 500 ошибку (для тестирования).
 *     responses:
 *       500:
 *         description: Ошибка сервера (тестовая)
 */
app.get('/error', (req, res) => {
    throw new Error("Тестовая ошибка сервера!");
});

/**
 * @swagger
 * /secure-endpoint:
 *   get:
 *     summary: Запрос с обязательным хэдером
 *     description: Требует заголовок `X-Custom-Header`, иначе возвращает 400 Bad Request.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Custom-Header
 *         required: true
 *         schema:
 *           type: string
 *         description: Обязательный заголовок для выполнения запроса
 *     responses:
 *       200:
 *         description: Успешный запрос
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Запрос выполнен успешно"
 *       400:
 *         description: Ошибка - отсутствует заголовок X-Custom-Header
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing required header: X-Custom-Header"
 */
app.get('/secure-endpoint', authenticateToken, (req, res) => {
    const customHeader = req.headers['x-custom-header'];
    if (!customHeader) {
        return res.status(400).json({ error: "Missing required header: X-Custom-Header" });
    }
    res.json({ message: "Запрос выполнен успешно" });
});

const multer = require('multer');
const path = require('path');

// Настройка хранения файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Папка для загрузки
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Уникальное имя файла
    }
});

// Фильтр: разрешаем только изображения
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Разрешены только изображения!'), false);
    }
};

// Настройки `multer`
const upload = multer({ storage: storage, fileFilter: fileFilter });

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Загрузка изображения
 *     description: Позволяет загрузить изображение (jpeg, png, gif). Требует авторизации.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Файл успешно загружен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Файл успешно загружен"
 *                 filename:
 *                   type: string
 *                   example: "1701234567890.png"
 *       400:
 *         description: Ошибка - неправильный формат файла
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Разрешены только изображения!"
 */
app.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Файл не загружен или неверный формат!" });
    }
    res.json({ message: "Файл успешно загружен", filename: req.file.filename });
});


const fs = require('fs');


/**
 * @swagger
 * /upload-base64:
 *   post:
 *     summary: Загрузка изображения в Base64
 *     description: Принимает изображение в формате Base64 и сохраняет его в файл.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               image_base64:
 *                 type: string
 *                 example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *     responses:
 *       200:
 *         description: Файл успешно загружен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Файл успешно загружен"
 *                 filename:
 *                   type: string
 *                   example: "1701234567890.png"
 *       400:
 *         description: Ошибка - некорректный формат данных
 */
app.post('/upload-base64', authenticateToken, (req, res) => {
    console.log("Полученные данные:", req.body); // 📌 Логируем входные данные

    const { image_base64 } = req.body;
    if (!image_base64) {
        return res.status(400).json({ error: "Отсутствует поле image_base64" });
    }

    const matches = image_base64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
        return res.status(400).json({ error: "Некорректный формат Base64" });
    }

    const ext = matches[1]; 
    const base64Data = matches[2];
    const filename = `${Date.now()}.${ext}`;
    const filepath = path.join('uploads', filename);

    console.log(`Сохраняем файл: ${filepath}`); // 📌 Логируем путь файла

    if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads');
    }

    fs.writeFile(filepath, base64Data, 'base64', (err) => {
        if (err) {
            console.error("Ошибка записи файла:", err);
            return res.status(500).json({ error: "Ошибка сохранения файла" });
        }
        res.json({ message: "Файл успешно загружен", filename });
    });
});


/**
 * @swagger
 * /uploads/{filename}:
 *   get:
 *     summary: Скачать изображение по имени файла
 *     description: Возвращает загруженное изображение по имени файла.
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Имя файла изображения
 *     responses:
 *       200:
 *         description: Успешный ответ (изображение)
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Файл не найден
 */
app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, 'uploads', filename); // ⬅️ Используем uploads

    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: "Файл не найден" });
    }

    res.sendFile(filepath);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});