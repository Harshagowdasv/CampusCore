const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const stringSimilarity = require('string-similarity');
const app = express();
const port = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.json());

// MySQL Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'harsha', // Update if needed
  database: 'signup_db'
});

db.connect(err => {
  if (err) throw err;
  console.log('MySQL Connected...');
});

// Utility to normalize text
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Serve pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/chatbot', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'chatbot.html'));
});

app.get('/notes', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'notes.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'signup.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/update-name', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'update-name.html'));
});

// Chatbot API
app.post('/ask', (req, res) => {
  const rawUserQuestion = req.body.question;
  const userQuestion = normalizeText(rawUserQuestion);

  const query = 'SELECT question, answer FROM chatbot_qa';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ answer: 'Something went wrong. Please try again later.' });
    }

    if (results.length === 0) {
      return res.json({ answer: "No questions found in database." });
    }

    const normalizedData = results.map(row => ({
      question: row.question,
      answer: row.answer,
      normalized: normalizeText(row.question)
    }));

    const questionList = normalizedData.map(item => item.normalized);
    const match = stringSimilarity.findBestMatch(userQuestion, questionList);
    const bestMatch = match.bestMatch;

    if (bestMatch.rating > 0.6) {
      const matched = normalizedData.find(item => item.normalized === bestMatch.target);
      return res.json({ answer: matched.answer });
    } else {
      return res.json({ answer: "I'm not sure about that. Please ask something else." });
    }
  });
});

// Notes API
app.get('/api/notes', (req, res) => {
  db.query('SELECT * FROM chatbot_qa', (err, results) => {
    if (err) return res.status(500).send('DB Error');
    res.json(results);
  });
});

// Add new note (with duplicate prevention)
app.post('/api/notes', (req, res) => {
  const { question, answer } = req.body;
  const normalizedQuestion = question.trim().toLowerCase();

  db.query('SELECT * FROM chatbot_qa WHERE LOWER(TRIM(question)) = ?', [normalizedQuestion], (err, results) => {
    if (err) return res.status(500).send('Database error');

    if (results.length > 0) {
      return res.status(400).json({ message: 'Question already exists.' });
    }

    db.query('INSERT INTO chatbot_qa (question, answer) VALUES (?, ?)', [question, answer], (err) => {
      if (err) return res.status(500).send('Insert error');
      res.sendStatus(200);
    });
  });
});

// Update note
app.put('/api/notes/:id', (req, res) => {
  const { question, answer } = req.body;
  const { id } = req.params;

  db.query('UPDATE chatbot_qa SET question = ?, answer = ? WHERE id = ?', [question, answer, id], (err) => {
    if (err) return res.status(500).send('DB Update Error');
    res.sendStatus(200);
  });
});

// Delete note
app.delete('/api/notes/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM chatbot_qa WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).send('DB Delete Error');
    res.sendStatus(200);
  });
});

// User Signup
app.post('/signup', (req, res) => {
  const { name, email, password } = req.body;
  const query = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';

  db.query(query, [name, email, password], (err) => {
    if (err) {
      console.error('Error signing up:', err);
      return res.send('An error occurred');
    }
    res.redirect('/chatbot');
  });
});

// User Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const query = 'SELECT * FROM users WHERE email = ? AND password = ?';

  db.query(query, [email, password], (err, results) => {
    if (err) {
      console.error('Error logging in:', err);
      return res.send('An error occurred');
    }

    if (results.length > 0) {
      res.redirect('/chatbot');
    } else {
      res.send('<h3>Invalid email or password</h3>');
    }
  });
});

// Fetch all users (Admin)
app.get('/api/users', (req, res) => {
  const query = 'SELECT * FROM users';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).send('An error occurred while fetching users');
    }
    res.json(results);
  });
});

// Update user name
app.post('/update-name', (req, res) => {
  const { email, newName } = req.body;
  const query = 'UPDATE users SET name = ? WHERE email = ?';

  db.query(query, [newName, email], (err, results) => {
    if (err) {
      console.error('Error updating name:', err);
      return res.send('An error occurred');
    }

    if (results.affectedRows > 0) {
      res.send('<h1>Name updated successfully!</h1>');
    } else {
      res.send('<h3>Email not found.</h3>');
    }
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
