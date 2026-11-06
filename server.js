
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || "library-local-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax"
    }
}));

app.use(express.static(path.join(__dirname, "public")));

function requireAdmin(req, res, next) {
    if (req.session.user?.role !== "admin") {
        return res.status(401).json({
            message: "Admin login required"
        });
    }
    next();
}

function requireStudent(req, res, next) {
    if (req.session.user?.role !== "student") {
        return res.status(401).json({
            message: "Student login required"
        });
    }
    next();
}

// Check application
app.get("/api/health", (req, res) => {
    res.json({
        message: "Library Management System is running"
    });
});

// Admin login
app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;

    const admin = db.prepare(
        "SELECT * FROM admins WHERE username = ?"
    ).get(username);

    if (!admin || !bcrypt.compareSync(password || "", admin.password)) {
        return res.status(401).json({
            message: "Invalid admin credentials"
        });
    }

    req.session.user = {
        id: admin.id,
        role: "admin",
        name: admin.username
    };

    res.json({ message: "Admin login successful" });
});

// Student registration
app.post("/api/students/register", (req, res) => {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
        return res.status(400).json({
            message: "All fields are required"
        });
    }

    const studentEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) {
        return res.status(400).json({
            message: "Invalid email address"
        });
    }

    const existing = db.prepare(
        "SELECT id FROM students WHERE email = ?"
    ).get(studentEmail);

    if (existing) {
        return res.status(409).json({
            message: "Student already registered"
        });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.prepare(
        "INSERT INTO students (name, email, password) VALUES (?, ?, ?)"
    ).run(name.trim(), studentEmail, hashedPassword);

    res.status(201).json({
        message: "Student registered successfully"
    });
});

// Student login
app.post("/api/students/login", (req, res) => {
    const { email, password } = req.body;

    const student = db.prepare(
        "SELECT * FROM students WHERE email = ?"
    ).get((email || "").trim().toLowerCase());

    if (!student || !bcrypt.compareSync(password || "", student.password)) {
        return res.status(401).json({
            message: "Invalid student credentials"
        });
    }

    req.session.user = {
        id: student.id,
        role: "student",
        name: student.name
    };

    res.json({ message: "Student login successful" });
});

// Check current login
app.get("/api/me", (req, res) => {
    res.json({
        user: req.session.user || null
    });
});

// Logout
app.post("/api/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({
                message: "Logout failed"
            });
        }

        res.clearCookie("connect.sid");
        res.json({
            message: "Logged out successfully"
        });
    });
});

// Display and search books
app.get("/api/books", (req, res) => {
    const search = `%${req.query.search || ""}%`;

    const books = db.prepare(`
        SELECT * FROM books
        WHERE title LIKE ? OR author LIKE ?
        ORDER BY id DESC
    `).all(search, search);

    res.json(books);
});

// Add book
app.post("/api/books", requireAdmin, (req, res) => {
    const { title, author, quantity } = req.body;
    const qty = Number(quantity);

    if (!title?.trim() || !author?.trim() ||
        !Number.isInteger(qty) || qty < 0) {
        return res.status(400).json({
            message: "Enter valid book details"
        });
    }

    const result = db.prepare(
        "INSERT INTO books (title, author, quantity) VALUES (?, ?, ?)"
    ).run(title.trim(), author.trim(), qty);

    res.status(201).json({
        message: "Book added successfully",
        id: result.lastInsertRowid.toString()
    });
});

// Update book
app.put("/api/books/:id", requireAdmin, (req, res) => {
    const { title, author, quantity } = req.body;
    const qty = Number(quantity);

    if (!title?.trim() || !author?.trim() ||
        !Number.isInteger(qty) || qty < 0) {
        return res.status(400).json({
            message: "Enter valid book details"
        });
    }

    const result = db.prepare(`
        UPDATE books
        SET title = ?, author = ?, quantity = ?
        WHERE id = ?
    `).run(
        title.trim(),
        author.trim(),
        qty,
        req.params.id
    );

    if (!result.changes) {
        return res.status(404).json({
            message: "Book not found"
        });
    }

    res.json({
        message: "Book updated successfully"
    });
});

// Delete book
app.delete("/api/books/:id", requireAdmin, (req, res) => {
    const history = db.prepare(
        "SELECT id FROM issued_books WHERE book_id = ? LIMIT 1"
    ).get(req.params.id);

    if (history) {
        return res.status(409).json({
            message: "Cannot delete a book with issue history"
        });
    }

    const result = db.prepare(
        "DELETE FROM books WHERE id = ?"
    ).run(req.params.id);

    if (!result.changes) {
        return res.status(404).json({
            message: "Book not found"
        });
    }

    res.json({
        message: "Book deleted successfully"
    });
});

// View registered students
app.get("/api/students", requireAdmin, (req, res) => {
    const students = db.prepare(
        "SELECT id, name, email FROM students ORDER BY id DESC"
    ).all();

    res.json(students);
});

// Issue book
app.post("/api/issues", requireAdmin, (req, res) => {
    const { student_id, book_id } = req.body;

    const student = db.prepare(
        "SELECT id FROM students WHERE id = ?"
    ).get(student_id);

    const book = db.prepare(
        "SELECT * FROM books WHERE id = ?"
    ).get(book_id);

    if (!student || !book) {
        return res.status(404).json({
            message: "Student or book not found"
        });
    }

    if (book.quantity <= 0) {
        return res.status(400).json({
            message: "Book is unavailable"
        });
    }

    const existing = db.prepare(`
        SELECT id FROM issued_books
        WHERE student_id = ?
          AND book_id = ?
          AND return_date IS NULL
    `).get(student_id, book_id);

    if (existing) {
        return res.status(409).json({
            message: "Book already issued to this student"
        });
    }

    const today = new Date();
    const dueDate = new Date(today);

    dueDate.setUTCDate(dueDate.getUTCDate() + 14);

    const issueDate = today.toISOString().slice(0, 10);
    const due = dueDate.toISOString().slice(0, 10);

    const issueBook = db.transaction(() => {
        db.prepare(`
            INSERT INTO issued_books
            (student_id, book_id, issue_date, due_date)
            VALUES (?, ?, ?, ?)
        `).run(student_id, book_id, issueDate, due);

        db.prepare(
            "UPDATE books SET quantity = quantity - 1 WHERE id = ?"
        ).run(book_id);
    });

    issueBook();

    res.status(201).json({
        message: "Book issued successfully",
        due_date: due
    });
});

// View issued books
app.get("/api/issues", requireAdmin, (req, res) => {
    const issues = db.prepare(`
        SELECT i.*,
               s.name AS student_name,
               b.title AS book_title
        FROM issued_books i
        JOIN students s ON i.student_id = s.id
        JOIN books b ON i.book_id = b.id
        ORDER BY i.id DESC
    `).all();

    res.json(issues);
});

// View student's issued books
app.get("/api/my/issues", requireStudent, (req, res) => {
    const issues = db.prepare(`
        SELECT i.*, b.title AS book_title
        FROM issued_books i
        JOIN books b ON i.book_id = b.id
        WHERE i.student_id = ?
        ORDER BY i.id DESC
    `).all(req.session.user.id);

    res.json(issues);
});

// Return book and calculate overdue fine
app.post("/api/issues/:id/return", requireAdmin, (req, res) => {
    const issue = db.prepare(
        "SELECT * FROM issued_books WHERE id = ?"
    ).get(req.params.id);

    if (!issue) {
        return res.status(404).json({
            message: "Issue record not found"
        });
    }

    if (issue.return_date) {
        return res.status(400).json({
            message: "Book already returned"
        });
    }

    const today = new Date().toISOString().slice(0, 10);

    const lateDays = Math.max(0, Math.floor(
        (
            Date.parse(today + "T00:00:00Z") -
            Date.parse(issue.due_date + "T00:00:00Z")
        ) / 86400000
    ));

    const fine = lateDays * 5;

    const returnBook = db.transaction(() => {
        db.prepare(`
            UPDATE issued_books
            SET return_date = ?, fine = ?
            WHERE id = ?
        `).run(today, fine, req.params.id);

        db.prepare(
            "UPDATE books SET quantity = quantity + 1 WHERE id = ?"
        ).run(issue.book_id);
    });

    returnBook();

    res.json({
        message: "Book returned successfully",
        late_days: lateDays,
        fine: fine
    });
});

// Start application
app.listen(PORT, () => {
    console.log(
        `Library Management System running at http://localhost:${PORT}`
    );
});
