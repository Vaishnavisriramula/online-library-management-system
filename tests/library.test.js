
const { Builder, By, until } = require("selenium-webdriver");
const assert = require("node:assert/strict");

async function runTests() {
    let driver;

    const stamp = Date.now();
    const bookTitle = `Selenium Book ${stamp}`;
    const studentName = `Selenium Student ${stamp}`;
    const studentEmail = `selenium${stamp}@example.com`;
    const studentPassword = "Student@123";

    try {
        driver = await new Builder()
            .forBrowser("chrome")
            .build();

        await driver.manage().window().maximize();
        await driver.get("http://localhost:3000");

        // Retry when the webpage replaces an element
        async function click(locator) {
            await driver.wait(async () => {
                try {
                    const element = await driver.findElement(locator);
                    await element.click();
                    return true;
                } catch (error) {
                    if (["StaleElementReferenceError",
                         "NoSuchElementError",
                         "ElementClickInterceptedError"].includes(error.name)) {
                        return false;
                    }
                    throw error;
                }
            }, 12000, "Unable to click element");
        }

        async function fill(id, value) {
            await driver.wait(async () => {
                try {
                    const element = await driver.findElement(By.id(id));
                    await element.clear();
                    await element.sendKeys(String(value));
                    return true;
                } catch (error) {
                    if (["StaleElementReferenceError",
                         "NoSuchElementError"].includes(error.name)) {
                        return false;
                    }
                    throw error;
                }
            }, 12000, `Unable to fill ${id}`);
        }

        async function waitVisible(id) {
            await driver.wait(async () => {
                try {
                    const element = await driver.findElement(By.id(id));
                    return await element.isDisplayed();
                } catch (error) {
                    if (["StaleElementReferenceError",
                         "NoSuchElementError"].includes(error.name)) {
                        return false;
                    }
                    throw error;
                }
            }, 12000, `${id} did not appear`);
        }

        async function waitFor(condition, message) {
            await driver.wait(condition, 12000, message);
        }

        // Read current book data without keeping old elements
        async function getBook() {
            return driver.executeScript((title) => {
                const rows = document.querySelectorAll(
                    "#booksTableBody tr"
                );

                for (const row of rows) {
                    const cells = row.querySelectorAll("td");

                    if (cells.length >= 4 &&
                        cells[1].textContent.trim() === title) {
                        return {
                            id: Number(cells[0].textContent.trim()),
                            quantity: Number(cells[3].textContent.trim())
                        };
                    }
                }

                return null;
            }, bookTitle);
        }

        async function getIssue() {
            return driver.executeScript((student, title) => {
                const rows = document.querySelectorAll(
                    "#issuedBooksTableBody tr"
                );

                for (const row of rows) {
                    const cells = row.querySelectorAll("td");

                    if (cells.length === 8 &&
                        cells[1].textContent.includes(student) &&
                        cells[2].textContent.includes(title)) {
                        return {
                            fine: Number(cells[6].textContent.trim()),
                            action: cells[7].textContent.trim()
                        };
                    }
                }

                return null;
            }, studentName, bookTitle);
        }

        async function adminLogin() {
            await fill("adminUsername", "admin");
            await fill("adminPassword", "admin123");

            await click(By.css(
                "#adminLoginForm button[type='submit']"
            ));

            await waitVisible("adminDashboard");
        }

        // TC01 - Admin Login
        await adminLogin();

        console.log("TC01 PASSED: Admin Login");

        // TC02 - Add Book
        await fill("bookTitle", bookTitle);
        await fill("bookAuthor", "Test Author");
        await fill("bookQuantity", "5");

        await click(By.id("saveBookButton"));

        await waitFor(async () => {
            const book = await getBook();
            return book && book.quantity === 5;
        }, "Book was not added");

        console.log("TC02 PASSED: Add Book");

        // TC03 - Search Book
        await fill("bookSearch", bookTitle);
        await click(By.id("searchBooksButton"));

        await waitFor(async () => {
            const book = await getBook();
            return book !== null;
        }, "Book search failed");

        console.log("TC03 PASSED: Search Book");

        // TC04 - Update Book
        await click(By.xpath(
            `//tbody[@id='booksTableBody']/tr` +
            `[td[2][normalize-space()='${bookTitle}']]` +
            `//button[normalize-space()='Edit']`
        ));

        await fill("bookQuantity", "10");
        await click(By.id("saveBookButton"));

        await waitFor(async () => {
            const book = await getBook();
            return book && book.quantity === 10;
        }, "Book update failed");

        console.log("TC04 PASSED: Update Book");

        await click(By.id("showAllBooksButton"));

        // Register a student for book issue testing
        await click(By.id("adminLogout"));
        await waitVisible("authSection");

        await click(By.id("showRegister"));
        await waitVisible("studentRegisterForm");

        await fill("registerName", studentName);
        await fill("registerEmail", studentEmail);
        await fill("registerPassword", studentPassword);

        await click(By.css(
            "#studentRegisterForm button[type='submit']"
        ));

        await waitVisible("studentLoginForm");

        console.log("Student Registration PASSED");

        // Student Login
        // Clear email because registration may auto-fill it
        await fill("studentEmail", studentEmail);
        await fill("studentPassword", studentPassword);

        await click(By.css(
            "#studentLoginForm button[type='submit']"
        ));

        await waitVisible("studentDashboard");

        console.log("Student Login PASSED");

        // Login as Admin again
        await click(By.id("studentLogout"));
        await waitVisible("adminLoginForm");

        await adminLogin();

        // TC05 - Issue Book
        await waitFor(async () => {
            const options = await driver.findElements(By.xpath(
                `//select[@id='issueStudentId']/option` +
                `[contains(., '${studentName}')]`
            ));
            return options.length > 0;
        }, "Student not found in dropdown");

        await click(By.xpath(
            `//select[@id='issueStudentId']/option` +
            `[contains(., '${studentName}')]`
        ));

        await waitFor(async () => {
            const options = await driver.findElements(By.xpath(
                `//select[@id='issueBookId']/option` +
                `[contains(., '${bookTitle}')]`
            ));
            return options.length > 0;
        }, "Book not found in dropdown");

        await click(By.xpath(
            `//select[@id='issueBookId']/option` +
            `[contains(., '${bookTitle}')]`
        ));

        await click(By.css(
            "#issueBookForm button[type='submit']"
        ));

        await waitFor(async () => {
            const book = await getBook();
            const issue = await getIssue();

            return book && book.quantity === 9 &&
                   issue && issue.action.includes("Return Book");
        }, "Book issue failed");

        console.log("TC05 PASSED: Issue Book");

        // TC06 - Return Book
        await click(By.xpath(
            `//tbody[@id='issuedBooksTableBody']/tr` +
            `[td[2][contains(., '${studentName}')]` +
            ` and td[3][contains(., '${bookTitle}')]]` +
            `//button[normalize-space()='Return Book']`
        ));

        const alert = await driver.wait(
            until.alertIsPresent(), 10000
        );

        await alert.accept();

        await waitFor(async () => {
            const book = await getBook();
            const issue = await getIssue();

            return book && book.quantity === 10 &&
                   issue && issue.action === "Returned" &&
                   issue.fine === 0;
        }, "Book return failed");

        console.log("TC06 PASSED: Return Book");

        // TC07 - Search Unavailable Book
        await fill("bookSearch", `UnavailableXYZ${stamp}`);

        await click(By.id("searchBooksButton"));

        await waitFor(async () => {
            const result = await driver.executeScript(() => {
                return document.querySelector(
                    "#booksTableBody"
                ).textContent;
            });

            return result.includes("No matching books found");
        }, "Unavailable book search failed");

        console.log("TC07 PASSED: Search Unavailable Book");

        console.log("------------------------------------");
        console.log("ALL 7 SELENIUM TEST CASES PASSED!");
        console.log("------------------------------------");

    } catch (error) {
        console.error("SELENIUM TEST FAILED:", error.message);
        process.exitCode = 1;
    } finally {
        if (driver) {
            await driver.quit();
        }
    }
}

runTests();
