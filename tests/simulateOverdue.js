
const db = require("../database");

const issue = db.prepare(`
    SELECT id FROM issued_books
    WHERE return_date IS NULL
    ORDER BY id DESC
    LIMIT 1
`).get();

if (!issue) {
    console.log("No active issued book found.");
    process.exit(1);
}

const today = new Date();

const issueDate = new Date(today);
issueDate.setUTCDate(issueDate.getUTCDate() - 17);

const dueDate = new Date(today);
dueDate.setUTCDate(dueDate.getUTCDate() - 3);

db.prepare(`
    UPDATE issued_books
    SET issue_date = ?, due_date = ?
    WHERE id = ?
`).run(
    issueDate.toISOString().slice(0, 10),
    dueDate.toISOString().slice(0, 10),
    issue.id
);

console.log("Overdue book test data created successfully!");
console.log("Expected fine: Rs. 15");
