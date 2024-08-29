const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Database Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) throw err;
    console.log('MySQL Connected...');
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(403);
  
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };  

// Register User
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) throw err;
        db.query(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hash],
            (err, result) => {
                if (err) throw err;
                res.status(201).json({ message: 'User registered!' });
            }
        );
    });
});

// Login User
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.query(
        'SELECT * FROM users WHERE username = ?',
        [username],
        (err, result) => {
            if (err) throw err;
            if (result.length === 0)
                return res.status(404).json({ message: 'User not found' });

            const user = result[0];
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) throw err;
                if (!isMatch)
                    return res.status(401).json({ message: 'Invalid credentials' });

                const token = jwt.sign(
                    { id: user.id, username: user.username },
                    process.env.JWT_SECRET
                );
                res.json({ token });
            });
        }
    );
});

// Get Messages
app.get('/messages', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const contactId = req.query.contactId;

    db.query(
        'SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
        [userId, contactId, contactId, userId],
        (err, results) => {
            if (err) throw err;
            res.json(results);
        }
    );
});


// Save a new message
app.post('/messages', (req, res) => {
    const { senderId, receiverId, content } = req.body;
    db.query(
        'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
        [senderId, receiverId, content],
        (err, result) => {
            if (err) throw err;
            res.json({ message: 'Message sent!' });
        }
    );
});

// Get all users 
app.get('/users', (req, res) => {
    db.query('SELECT id, username, avatar FROM users', (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Mark user as favorite
app.post('/favorites', authenticateToken, (req, res) => {
    const { userId, favoriteId } = req.body;
    db.query(
        'INSERT INTO favorites (user_id, favorite_id) VALUES (?, ?)',
        [userId, favoriteId],
        (err, result) => {
            if (err) throw err;
            res.json({ message: 'User added to favorites!' });
        }
    );
});

// Get favorite users
app.get('/favorites/:userId', authenticateToken, (req, res) => {
    const { userId } = req.params;
    db.query(
        'SELECT u.id, u.username, u.avatar FROM users u JOIN favorites f ON u.id = f.favorite_id WHERE f.user_id = ?',
        [userId],
        (err, results) => {
            if (err) throw err;
            res.json(results);
        }
    );
});

// File upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ file: req.file });
});

// Real-time messaging
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('sendMessage', ({ senderId, receiverId, content }) => {
        const message = { sender_id: senderId, receiver_id: receiverId, content };

        // Store message 
        db.query('INSERT INTO messages SET ?', message, (err, result) => {
            if (err) throw err;

            io.emit('receiveMessage', { ...message, id: result.insertId, created_at: new Date() });
        });
    });

    // WebRTC 
    socket.on('offer', offer => socket.broadcast.emit('offer', offer));
    socket.on('answer', answer => socket.broadcast.emit('answer', answer));
    socket.on('ice-candidate', candidate => socket.broadcast.emit('ice-candidate', candidate));

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
