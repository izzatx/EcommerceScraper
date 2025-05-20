# 🛍️ E-Commerce Scraper

This project is designed to **scrape product data** from popular Japanese e-commerce sites such as **Mercari, Yahoo Auctions, NetMall, Trefac, and Buyee**, then update the results directly into a Google Sheet.

---

## 📌 Project Objectives

1. Scrape product information (e.g., **title**, **price**, **shipping cost**) from multiple e-commerce platforms.
2. Integrate with a **Google Sheet** to dynamically read and write data.

---

## ⚙️ Prerequisites

Before running the script, make sure the following requirements are fulfilled:

### 1. Google Cloud Service Account

- You need a **Google service account** to access Google Sheets.
- Refer to the [Google Sheets API documentation](https://developers.google.com/sheets/api/quickstart) for setup instructions.
- Once created, download the `credentials.json` file and place it in your project root directory.

### 2. Install Dependencies

Install required packages using:

```bash
npm install
```

### 3. Setup Environment Variables

#### Create a .env file in the root directory and include the following:

```
SPREADSHEET_ID=your_google_sheet_id_here
```
