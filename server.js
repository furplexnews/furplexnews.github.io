const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));

// Mongoose schema a model pro články a uživatele
const articleSchema = new mongoose.Schema({
    title: String,
    content: String,
    image: String,
    author: String,
    date: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
    username: String,
    password: String
});

const Article = mongoose.model('Article', articleSchema);
const User = mongoose.model('User', userSchema);

// Konfigurace Multer pro nahrávání obrázků
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Připojení k MongoDB
mongoose.connect('mongodb://localhost:27017/herni-zpravodaj', { useNewUrlParser: true, useUnifiedTopology: true });

// Discord webhook URL (zde vložte váš vlastní URL)
const discordWebhookUrl = 'YOUR_DISCORD_WEBHOOK_URL';

// Vytvoření základního uživatele ADMIN při prvním spuštění serveru
async function createAdminUser() {
    const adminUser = await User.findOne({ username: 'ADMIN' });
    if (!adminUser) {
        const randomPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        const newUser = new User({
            username: 'ADMIN',
            password: hashedPassword
        });
        await newUser.save();

        // Odeslání hesla na Discord webhook
        await axios.post(discordWebhookUrl, {
            content: `Admin account created.\nUsername: ADMIN\nPassword: ${randomPassword}`
        });
    } else {
        console.log('Admin account already exists.');
    }
}

createAdminUser();

// Registrace/Přihlášení
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = username;
        res.send('Přihlášení úspěšné');
    } else {
        res.status(401).send('Neplatné přihlašovací údaje');
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    res.send('Odhlášení úspěšné');
});

// Vytvoření článku
app.post('/articles', upload.single('image'), (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Nepřihlášený uživatel');
    }

    const newArticle = new Article({
        title: req.body.title,
        content: req.body.content,
        image: req.file.path,
        author: req.session.user
    });

    newArticle.save((err) => {
        if (err) {
            return res.status(500).send('Chyba při ukládání článku');
        }
        res.send('Článek byl úspěšně publikován');
    });
});

// Načítání článků
app.get('/articles', (req, res) => {
    Article.find({}, (err, articles) => {
        if (err) {
            return res.status(500).send('Chyba při načítání článků');
        }
        res.json(articles);
    });
});

app.listen(3000, () => {
    console.log('Server běží na portu 3000');
});
