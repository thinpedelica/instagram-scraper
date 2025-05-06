#!/usr/bin/env node
import { InstagramScraper } from './instagramScraper.js';
import readline from 'readline';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Main function
async function main() {
  console.log('===== Instagram Scraper Tool =====');
  console.log('This tool will scrape Instagram profiles and save data to local directory');
  
  const scraper = new InstagramScraper();
  
  try {
    // Initialize the scraper
    console.log('Initializing scraper...');
    const initialized = await scraper.initialize();
    
    if (!initialized) {
      console.error('Failed to initialize scraper. Make sure Chrome is running with remote debugging enabled (port 9222).');
      process.exit(1);
    }
    
    // Ask for the username
    rl.question('Enter Instagram username to scrape: ', async (username) => {
      if (!username) {
        console.error('Username is required');
        rl.close();
        await scraper.close();
        return;
      }
      
      // Ask for the limit
      rl.question('How many posts to scrape? (default: 10): ', async (limitStr) => {
        const limit = limitStr ? parseInt(limitStr) : 10;
        
        if (isNaN(limit) || limit <= 0) {
          console.error('Invalid limit, must be a positive number');
          rl.close();
          await scraper.close();
          return;
        }
        
        console.log(`Starting to scrape ${username} for ${limit} posts...`);
        
        try {
          // Start scraping
          const result = await scraper.scrapeProfile(username, limit);
          
          console.log('\n===== Scraping Complete =====');
          console.log(`Successfully scraped ${result.postsCount} posts for ${username}`);
          console.log(`Data saved to: ${result.sessionDir}`);
          console.log('\nYou can now analyze this data with Claude Desktop by uploading the JSON files.');
        } catch (error) {
          console.error('Error during scraping:', error);
        } finally {
          // Close resources
          await scraper.close();
          rl.close();
        }
      });
    });
  } catch (error) {
    console.error('Fatal error:', error);
    rl.close();
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\nScraping interrupted. Cleaning up...');
  rl.close();
  process.exit(0);
});

// Run the main function
main().catch(console.error);