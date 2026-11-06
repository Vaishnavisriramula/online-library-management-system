
const $ = id => document.getElementById(id);

let books = [];
let students = [];
let issuedBooks = [];

function showMessage(text, isError = false) {
    $("message").textContent = text;
    $("message").style.color = isError ? "red" : "green";
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
    }

    return data;
}

async function perform(action, successMessage) {
    try {
        await action();
        if (successMessage) showMessage(successMessage);
    } catch (error) {
        showMessage(error.message, true);
    }
}

function showSection(role) {
    $("authSection").classList.toggle("hidden", !!role);
    $("adminDashboard").classList.toggle("hidden", role !== "admin");
    $("studentDashboard").classList.toggle("hidden", role !== "student");
}

function showLoginForm(formId) {
    ["adminLoginForm", "studentLoginForm", "studentRegisterForm"]
        .forEach(id => {
            $(id).classList.toggle("hidden", id !== formId);
        });

    showMessage("");
}

$("showAdminLogin").onclick = () => showLoginForm("adminLoginForm");
$("showStudentLogin").onclick = () => showLoginForm("studentLoginForm");
$("showRegister").onclick = () => showLoginForm("studentRegisterForm");

// Admin login
$("adminLoginForm").addEventListener("submit", event => {
    event.preventDefault();

    perform(async () => {
        await api("/api/admin/login", {
            method: "POST",
            body: JSON.stringify({
                username: $("adminUsername").value,
                password: $("adminPassword").value
            })
        });

        showSection("admin");
        await loadAdminData();
        $("adminLoginForm").reset();
    }, "Admin Login Successful!");
});

// Student registration
$("studentRegisterForm").addEventListener("submit", event => {
    event.preventDefault();

    perform(async () => {
        const email = $("registerEmail").value;

        await api("/api/students/register", {
            method: "POST",
            body: JSON.stringify({
                name: $("registerName").value,
                email: email,
                password: $("registerPassword").value
            })
        });

        $("studentRegisterForm").reset();
        showLoginForm("studentLoginForm");
        $("studentEmail").value = email;
    }, "Student registered successfully! Please login.");
});

// Student login
$("studentLoginForm").addEventListener("submit", event => {
    event.preventDefault();

    perform(async () => {
        await api("/api/students/login", {
            method: "POST",
            body: JSON.stringify({
                email: $("studentEmail").value,
                password: $("studentPassword").value
            })
        });

        showSection("student");
        await loadStudentData();
        $("studentLoginForm").reset();
    }, "Student Login Successful!");
});

// Logout
async function logout() {
    await perform(async () => {
        await api("/api/logout", { method: "POST" });
        showSection(null);
        showLoginForm("adminLoginForm");
    }, "Logged out successfully");
}

$("adminLogout").onclick = logout;
$("studentLogout").onclick = logout;

// Helper to add safe text into a table
function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value == null || value === "" ? "-" : value;
    row.appendChild(cell);
    return cell;
}

function addButton(parent, label, callback) {
    const button = document.createElement("button");
    button.textContent = label;
    button.type = "button";
    button.onclick = callback;
    parent.appendChild(button);
}

function emptyTable(tbody, columns, message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columns;
    cell.textContent = message;
    row.appendChild(cell);
    tbody.appendChild(row);
}

// Load all admin information
async function loadAdminData() {
    [books, students, issuedBooks] = await Promise.all([
        api("/api/books"),
        api("/api/students"),
        api("/api/issues")
    ]);

    displayBooks();
    displayStudents();
    displayIssuedBooks();
    updateDropdowns();
}

// Display and search books
function displayBooks() {
    const tbody = $("booksTableBody");
    tbody.replaceChildren();

    const search = $("bookSearch").value.trim().toLowerCase();

    const filtered = books.filter(book =>
        book.title.toLowerCase().includes(search) ||
        book.author.toLowerCase().includes(search)
    );

    if (filtered.length === 0) {
        emptyTable(tbody, 5, "No matching books found");
        return;
    }

    filtered.forEach(book => {
        const row = document.createElement("tr");

        addCell(row, book.id);
        addCell(row, book.title);
        addCell(row, book.author);
        addCell(row, book.quantity);

        const actions = document.createElement("td");

        addButton(actions, "Edit", () => editBook(book));
        addButton(actions, "Delete", () => deleteBook(book.id));

        row.appendChild(actions);
        tbody.appendChild(row);
    });
}

$("searchBooksButton").onclick = displayBooks;

$("showAllBooksButton").onclick = () => {
    $("bookSearch").value = "";
    displayBooks();
};

// Add and update books
$("bookForm").addEventListener("submit", event => {
    event.preventDefault();

    perform(async () => {
        const id = $("editingBookId").value;

        const book = {
            title: $("bookTitle").value,
            author: $("bookAuthor").value,
            quantity: Number($("bookQuantity").value)
        };

        await api(id ? `/api/books/${id}` : "/api/books", {
            method: id ? "PUT" : "POST",
            body: JSON.stringify(book)
        });

        resetBookForm();
        await loadAdminData();
    }, "Book saved successfully!");
});

function editBook(book) {
    $("editingBookId").value = book.id;
    $("bookTitle").value = book.title;
    $("bookAuthor").value = book.author;
    $("bookQuantity").value = book.quantity;
    $("saveBookButton").textContent = "Update Book";

    $("bookForm").scrollIntoView({ behavior: "smooth" });
}

function resetBookForm() {
    $("bookForm").reset();
    $("editingBookId").value = "";
    $("saveBookButton").textContent = "Save Book";
    $("bookQuantity").value = 1;
}

$("cancelEditButton").onclick = resetBookForm;

// Delete books
function deleteBook(id) {
    if (!confirm("Are you sure you want to delete this book?")) {
        return;
    }

    perform(async () => {
        await api(`/api/books/${id}`, { method: "DELETE" });
        await loadAdminData();
    }, "Book deleted successfully!");
}

// Display students
function displayStudents() {
    const tbody = $("studentsTableBody");
    tbody.replaceChildren();

    if (students.length === 0) {
        emptyTable(tbody, 3, "No registered students");
        return;
    }

    students.forEach(student => {
        const row = document.createElement("tr");

        addCell(row, student.id);
        addCell(row, student.name);
        addCell(row, student.email);

        tbody.appendChild(row);
    });
}

// Update issue-book dropdowns
function updateDropdowns() {
    const studentSelect = $("issueStudentId");
    const bookSelect = $("issueBookId");

    studentSelect.replaceChildren(new Option("Select Student", ""));
    bookSelect.replaceChildren(new Option("Select Book", ""));

    students.forEach(student => {
        studentSelect.add(
            new Option(`${student.name} (ID: ${student.id})`, student.id)
        );
    });

    books.filter(book => book.quantity > 0).forEach(book => {
        bookSelect.add(
            new Option(`${book.title} (${book.quantity} available)`, book.id)
        );
    });
}

// Issue book
$("issueBookForm").addEventListener("submit", event => {
    event.preventDefault();

    perform(async () => {
        await api("/api/issues", {
            method: "POST",
            body: JSON.stringify({
                student_id: Number($("issueStudentId").value),
                book_id: Number($("issueBookId").value)
            })
        });

        $("issueBookForm").reset();
        await loadAdminData();
    }, "Book issued successfully!");
});

// Display issued and returned books
function displayIssuedBooks() {
    const tbody = $("issuedBooksTableBody");
    tbody.replaceChildren();

    if (issuedBooks.length === 0) {
        emptyTable(tbody, 8, "No book issue records");
        return;
    }

    issuedBooks.forEach(issue => {
        const row = document.createElement("tr");

        addCell(row, issue.id);
        addCell(row, issue.student_name);
        addCell(row, issue.book_title);
        addCell(row, issue.issue_date);
        addCell(row, issue.due_date);
        addCell(row, issue.return_date);
        addCell(row, issue.fine);

        const action = document.createElement("td");

        if (issue.return_date) {
            action.textContent = "Returned";
        } else {
            addButton(action, "Return Book", () => returnBook(issue.id));
        }

        row.appendChild(action);
        tbody.appendChild(row);
    });
}

// Return book and calculate fine
function returnBook(id) {
    if (!confirm("Confirm book return?")) return;

    perform(async () => {
        const result = await api(`/api/issues/${id}/return`, {
            method: "POST"
        });

        await loadAdminData();

        showMessage(
            `Book returned! Late days: ${result.late_days}, Fine: ₹${result.fine}`
        );
    });
}

// Load student dashboard
async function loadStudentData() {
    const [availableBooks, myIssues] = await Promise.all([
        api("/api/books"),
        api("/api/my/issues")
    ]);

    const booksBody = $("studentBooksTableBody");
    const issuesBody = $("myIssuesTableBody");

    booksBody.replaceChildren();
    issuesBody.replaceChildren();

    availableBooks.forEach(book => {
        const row = document.createElement("tr");

        addCell(row, book.id);
        addCell(row, book.title);
        addCell(row, book.author);
        addCell(row, book.quantity);

        booksBody.appendChild(row);
    });

    if (availableBooks.length === 0) {
        emptyTable(booksBody, 4, "No books available");
    }

    myIssues.forEach(issue => {
        const row = document.createElement("tr");

        addCell(row, issue.book_title);
        addCell(row, issue.issue_date);
        addCell(row, issue.due_date);
        addCell(row, issue.return_date);
        addCell(row, issue.fine);

        issuesBody.appendChild(row);
    });

    if (myIssues.length === 0) {
        emptyTable(issuesBody, 5, "No issued books");
    }
}

// Restore login after refreshing the page
async function checkSession() {
    try {
        const data = await api("/api/me");
        const role = data.user?.role || null;

        showSection(role);

        if (role === "admin") {
            await loadAdminData();
        } else if (role === "student") {
            await loadStudentData();
        }
    } catch (error) {
        showMessage(error.message, true);
    }
}

checkSession();
