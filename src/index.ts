import puppeteer from "puppeteer";
import { google } from "googleapis";
import fs from "fs/promises";
import dotenv from "dotenv";

//add dotenv to load environment variables from .env file
dotenv.config();

// Path to your Google service account credentials
const CREDENTIALS_PATH = "./credentials.json";

// Spreadsheet details
const SPREADSHEET_ID = process.env.SPREADSHEET_ID!; // Your spreadsheet ID
const SHEET_NAME = "testing"; // Sheet name

// Authorize with Google Sheets API
// This function uses a service account to authenticate with the Google Sheets API
// Make sure to share the spreadsheet with the service account email
// found in the credentials.json file
async function authorize() {
  const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH, "utf-8"));
  const { client_email, private_key } = credentials;

  const auth = new google.auth.JWT(client_email, undefined, private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);

  return auth;
}

// Function to get links from Google Sheets
// This function reads the links from column C of the specified sheet
async function getLinks(auth: any) {
  const sheets = google.sheets({ version: "v4", auth });

  // Read data from the specified range
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!C:C`, // letak dlm c column
  });

  return response.data.values?.flat() || []; // flatten rows aku
}

// Function to write titles and prices dynamically
// This function updates the Google Sheets with the scraped titles and prices
// It finds the corresponding rows based on the URLs and updates the title in column B and price in column D
async function writeTitlesPrices(
  auth: any,
  titles: string[],
  prices: string[],
  urls: string[]
) {
  const sheets = google.sheets({ version: "v4", auth });

  //  Read current sheet data
  const sheetData = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
  });

  const rows = sheetData.data.values || [];

  const updates: any[] = [];

  urls.forEach((url, index) => {
    const rowIndex = rows.findIndex((row) => row[2] === url); // Find row index based on the link in column C
    if (rowIndex !== -1) {
      updates.push({
        range: `${SHEET_NAME}!B${rowIndex + 1}`,
        values: [[titles[index]]],
      });
      updates.push({
        range: `${SHEET_NAME}!D${rowIndex + 1}`,
        values: [[prices[index]]],
      });
    }
  });

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        data: updates,
        valueInputOption: "RAW",
      },
    });
    console.log("Titles and prices have been written dynamically.");
  } else {
    console.log("No matching rows found for updates.");
  }
  return rows;
}

// Function to scrape Mercari
// This function scrapes the title and price from a Mercari product page
async function scrapeMercari(
  url: string
): Promise<{ title: string; price: string }> {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle2" });

    const title = await page.$eval(
      "h1.heading__a7d91561.page__a7d91561",
      (element) => element.textContent?.trim() || "unknown titles"
    );

    // Extract the price
    await page.waitForSelector('div[data-testid="price"]', { timeout: 5000 }); // Wait for the price container
    const price = await page.$eval(
      'div[data-testid="price"] span:not([class])', // Target a <span> with no class inside the price div
      (element) => element.textContent?.trim() || "Unknown Price"
    );
    await browser.close();
    return { title, price };
  } catch (error) {
    console.log(`Error scraping title for URL: ${url}`, error);
    return { title: "unknown titles", price: "unknown price" };
  }
}

// Function to scrape NetMall
// This function scrapes the model name and price from a NetMall product page
async function scrapeNetMall(
  url: string
): Promise<{ modelName: string; price: string }> {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle2" });

    // Extract the content of the <p> tag with class "product-detail-num"
    const modelText = await page.$eval(
      "p.product-detail-num",
      (element) => element.textContent?.trim() || ""
    );
    // Find the word after "型番"
    const modelName = modelText.includes("型番：")
      ? modelText.split("型番：")[1].trim() // Split by "型番" and take the part after it
      : "Unknown Model";

    // finding price starting here
    await page.waitForSelector("span.product-detail-price__main", {
      timeout: 5000,
    });
    const price = await page.$eval(
      "span.product-detail-price__main", // Select the span with the price
      (element) => element.textContent?.trim() || "Unknown Price"
    );
    await browser.close();
    return { modelName, price };
  } catch (error) {
    console.log(`error occured here ${url}`, error);
    return { modelName: "title error", price: "price error" };
  }
}

// Function to scrape NetMall
// This function scrapes the model name and price from a NetMall product page
async function scrapeTrefac(
  url: string
): Promise<{ modelName: string; price: string }> {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle2" });

    const modelName = await page.$eval(
      "p.gdname.p-typo_head3_a", // Selector for the title element
      (element) => element.textContent?.trim() || "Unknown Title"
    );

    // Extract the price
    await page.waitForSelector("p.gdprice_main.p-price1_a", { timeout: 5000 });
    const price = await page.$eval("p.gdprice_main.p-price1_a", (element) => {
      const textContent = element.textContent?.trim() || "";
      return textContent.replace(/[^0-9,]/g, "").trim();
    });

    await browser.close();
    return { modelName, price };
  } catch (error) {
    console.log(`error occured here ${url}`, error);
    return { modelName: "title error", price: "price error" };
  }
}

// Function to scrape Yahoo Auctions
// This function scrapes the title from a Yahoo Auctions product page
async function scrapeYahoo(url: string): Promise<string> {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle2" });

    // Extract the title from the h1 element with the specified class
    const title = await page.$eval(
      "h1.ProductTitle__text",
      (element) => element.textContent?.trim() || "Unknown Title"
    );

    console.log("Extracted Title:", title);
    await browser.close();
    return title;
  } catch (error) {
    console.log(`error occured here ${url}`, error);
    return "title is not found";
  }
}

// Function to scrape Buyee
// This function scrapes the title and price from a Buyee product page
async function scrapeBuyee(
  url: string
): Promise<{ modelName: string; price: string }> {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Wait for the container that holds the product details (to ensure page fully loads)
    await page.waitForSelector("div.mercari__attrContainer", { timeout: 8000 });

    // Extract the product title (h1 within that container)
    const modelName = await page.$eval(
      "h1.m-goodsName",
      (element) => element.textContent?.trim() || "Unknown Title"
    );

    // Extract the price
    await page.waitForSelector("div.m-goodsDetail__price", { timeout: 5000 });
    const price = await page.$eval("div.m-goodsDetail__price", (element) => {
      const textContent = element.textContent?.trim() || "";
      return textContent.replace(/[^0-9,]/g, "").trim(); // Keep only numbers
    });

    await browser.close();
    return { modelName, price };
  } catch (error) {
    console.log(`Error occurred here ${url}`, error);
    return { modelName: "title error", price: "price error" };
  }
}

// Function to process links
// This function processes each link, scrapes the title and price, and writes them to Google Sheets
async function processLinks(links: string[], auth: any, rows: any[]) {
  const validWebsites = [
    "netmall.hardoff",
    "mercari.com",
    "trefac.jp",
    "auctions.yahoo.co.jp",
    "2ndstreet.jp",
    "buyee.jp",
  ];
  const validUrls: string[] = [];
  const titles: string[] = [];
  const prices: string[] = [];

  const browser = await puppeteer.launch(); // Launch a shared browser instance

  for (const url of links) {
    if (!validWebsites.some((pattern) => url.includes(pattern))) {
      console.log(`Skipping URL: ${url} - Not a valid link`);
      continue;
    }
    // Find the row index for the current URL
    const rowIndex = rows.findIndex((row) => row[2]?.trim() === url.trim());

    // Skip if the URL already has a title in column B
    if (rowIndex !== -1) {
      const titleInColumnB = rows[rowIndex][1]?.trim(); // Column B (title)
      const urlInColumnC = rows[rowIndex][2]?.trim(); // Column C (URL)

      if (urlInColumnC && titleInColumnB) {
        console.log(`Skipping already processed URL: ${url}`);
        continue;
      }
    } else {
      console.log(`URL not found in rows: ${url}`);
      continue;
    }
    try {
      const page = await browser.newPage(); // Open a new page for each URL
      let title = "Unknown Title";
      let price = "Unknown Price";

      // Handle different sources based on the URL
      if (url.includes("netmall.hardoff")) {
        const { modelName, price: netmallPrice } = await scrapeNetMall(url);
        title = modelName;
        price = netmallPrice;
      } else if (url.includes("mercari.com")) {
        const { title: mercariTitle, price: mercariPrice } =
          await scrapeMercari(url);
        title = mercariTitle;
        price = mercariPrice;
      } else if (url.includes("trefac.jp")) {
        const { modelName, price: trefacPrice } = await scrapeTrefac(url);
        title = modelName;
        price = trefacPrice;
      } else if (url.includes("buyee.jp")) {
        const { modelName, price: buyeePrice } = await scrapeBuyee(url);
        title = modelName;
        price = buyeePrice;
      } else if (url.includes("auctions.yahoo.co.jp")) {
        title = await scrapeYahoo(url);
      } else if (url.includes("2ndstreet.jp")) {
        console.log(`Skipping URL: ${url} - Untitled`);
        title = "Untitled";
        price = "No Price";
      }

      titles.push(title);
      prices.push(price);
      validUrls.push(url);

      console.log(`Extracted title for ${url}: ${title} - ${price}`);

      await page.close(); // Close the page to free resources
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
      titles.push("Error");
      prices.push("Error");
    }
  }

  await browser.close(); // Close the shared browser instance
  await writeTitlesPrices(auth, titles, prices, validUrls); // Write data dynamically
}

// Main function
(async () => {
  try {
    const totalStartTime = performance.now();

    const auth = await authorize();
    const links = await getLinks(auth);
    const rows = await writeTitlesPrices(auth, [], [], []);

    console.log("Links from Google Sheets:", links);

    // Process each link
    await processLinks(links, auth, rows);

    const totalEndTime = performance.now(); // End measuring total time
    const totalTimeTaken = totalEndTime - totalStartTime;

    console.log(
      `Total execution time: ${(totalTimeTaken / (1000 * 60)).toFixed(
        3
      )} minutes`
    );
  } catch (error) {
    console.error("Error:", error);
  }
})();
