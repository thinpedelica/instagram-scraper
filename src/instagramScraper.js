import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '../instagram_data');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10');
const SCROLL_ATTEMPTS = parseInt(process.env.SCROLL_ATTEMPTS || '5');
const TIMEOUT = parseInt(process.env.TIMEOUT || '30000');
const MAX_POSTS = parseInt(process.env.MAX_POSTS || '50');
const CHROME_PORT = process.env.CHROME_REMOTE_DEBUGGING_PORT || '9222';

// Create Instagram scraper class
class InstagramScraper {
  constructor() {
    this.context = null;
    this.cachedPostLinks = [];
    this.lastFetchTimestamp = 0;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    console.log(`Output directory: ${OUTPUT_DIR}`);
  }

  async initialize() {
    try {
      console.log(`Connecting to Chrome on port ${CHROME_PORT}...`);
      const browser = await chromium.connectOverCDP(`http://localhost:${CHROME_PORT}`);
      const contexts = browser.contexts();
      
      this.context = contexts[0] || await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true
      });
      
      console.log('Connected to Chrome successfully');
      
      await this.context.route('**/*', async (route, request) => {
        await route.continue({
          headers: {
            ...request.headers(),
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty',
            'X-IG-App-ID': '936619743392459',
            'X-Requested-With': 'XMLHttpRequest',
            'X-ASBD-ID': '129477',
            'X-IG-WWW-Claim': '0'
          }
        });
      });
      
      return true;
    } catch (error) {
      console.error('Error initializing scraper:', error);
      return false;
    }
  }
  
  async scrapeProfile(username, limit = MAX_POSTS) {
    console.log(`Scraping profile: ${username}, limit: ${limit}`);
    
    try {
      if (!this.context) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize browser');
        }
      }
      
      const page = await this.context.newPage();
      
      try {
        // Create output directory for this user
        const userDir = path.join(OUTPUT_DIR, username);
        await fs.mkdir(userDir, { recursive: true });
        
        // Create directory with timestamp for this scraping session
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 10);
        const sessionDir = path.join(userDir, timestamp);
        await fs.mkdir(sessionDir, { recursive: true });
        
        console.log(`Output directory for session: ${sessionDir}`);
        
        // Navigate to profile
        await this.humanNavigate(page, `https://www.instagram.com/${username}/`);
        console.log('Profile page loaded');
        
        // Get basic profile info
        const profileInfo = await this.extractProfileInfo(page);
        await fs.writeFile(
          path.join(sessionDir, 'profile.json'),
          JSON.stringify(profileInfo, null, 2),
          'utf8'
        );
        console.log('Profile info saved');
        
        // Get post links
        console.log('Getting post links...');
        const postLinks = await this.getPostLinks(page, limit);
        console.log(`Found ${postLinks.length} posts`);
        
        // Save list of post links
        await fs.writeFile(
          path.join(sessionDir, 'post_links.json'),
          JSON.stringify(postLinks, null, 2),
          'utf8'
        );
        
        // Scrape each post
        const allPosts = [];
        for (let i = 0; i < Math.min(postLinks.length, limit); i++) {
          const postUrl = postLinks[i];
          console.log(`Processing post ${i+1}/${Math.min(postLinks.length, limit)}: ${postUrl}`);
          
          try {
            // Human-like navigation to post
            await this.humanNavigate(page, postUrl);
            
            // Extract post data
            const postData = await this.extractPostData(page);
            if (!postData) {
              console.log('Failed to extract post data, skipping');
              continue;
            }
            
            // Generate post ID from URL
            const postId = this.getPostIdFromUrl(postUrl);
            const postDir = path.join(sessionDir, postId);
            await fs.mkdir(postDir, { recursive: true });
            
            // Download media
            let localMediaPath = null;
            if (postData.mediaUrl) {
              // For both images and video posters
              localMediaPath = path.join(postDir, 'media.jpg');
              await this.downloadMedia(postData.mediaUrl, localMediaPath);
              console.log(`Media downloaded to ${localMediaPath}`);
            }
            
            // Create post object
            const post = {
              id: postId,
              type: postData.type,
              mediaUrl: postData.mediaUrl,
              localMediaPath,
              alt: postData.alt,
              caption: postData.caption,
              timestamp: postData.timestamp,
              postUrl,
              // Extract hashtags from caption
              hashtags: this.extractHashtags(postData.caption)
            };
            
            // Save post data
            await fs.writeFile(
              path.join(postDir, 'post.json'),
              JSON.stringify(post, null, 2),
              'utf8'
            );
            
            allPosts.push(post);
            await this.randomDelay(2000, 5000); // Random delay between posts
          } catch (error) {
            console.error(`Error processing post ${postUrl}:`, error);
          }
        }
        
        // Save all posts data in one file
        await fs.writeFile(
          path.join(sessionDir, 'all_posts.json'),
          JSON.stringify(allPosts, null, 2),
          'utf8'
        );
        
        console.log(`Scraping completed. ${allPosts.length} posts saved to ${sessionDir}`);
        return { sessionDir, postsCount: allPosts.length };
      } finally {
        await page.close();
      }
    } catch (error) {
      console.error('Error scraping profile:', error);
      throw error;
    }
  }
  
  async humanNavigate(page, url) {
    // Random delay before navigation
    await this.randomDelay(1000, 3000);
    
    // Navigate with human-like behavior
    console.log(`Navigating to ${url}`);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT
    });

    // Random scroll after load
    await this.humanScroll(page, 300);
  }

  async humanScroll(page, baseDistance) {
    const variance = 0.3; // 30% variance in scroll distance
    const steps = 5 + Math.floor(Math.random() * 3); // 5-7 scroll steps
    
    for (let i = 0; i < steps; i++) {
      const scrollAmount = baseDistance * (1 + (Math.random() * variance - variance/2));
      await page.evaluate((amount) => {
        window.scrollBy(0, amount);
      }, scrollAmount);
      await this.randomDelay(500, 1500); // Random delay between scrolls
    }
  }

  async extractProfileInfo(page) {
    try {
      return await page.evaluate(() => {
        const username = document.querySelector('h2')?.textContent || '';
        const bio = Array.from(document.querySelectorAll('span'))
          .find(span => span.textContent?.length > 20)?.textContent || '';
        
        const metaSpans = Array.from(document.querySelectorAll('span'))
          .filter(span => span.textContent?.match(/\\d+ (posts|following|followers)/i));
        
        const meta = {};
        metaSpans.forEach(span => {
          const text = span.textContent || '';
          if (text.includes('posts')) meta.postsCount = text.replace(/[^0-9]/g, '');
          if (text.includes('followers')) meta.followersCount = text.replace(/[^0-9]/g, '');
          if (text.includes('following')) meta.followingCount = text.replace(/[^0-9]/g, '');
        });
        
        return {
          username,
          bio,
          meta,
          timestamp: new Date().toISOString()
        };
      });
    } catch (error) {
      console.error('Error extracting profile info:', error);
      return {
        username: '',
        bio: '',
        meta: {},
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  async getPostLinks(page, targetCount) {
    let previousHeight = 0;
    let attempts = 0;
    let links = [];

    while (attempts < SCROLL_ATTEMPTS && links.length < targetCount) {
      previousHeight = await page.evaluate(() => document.body.scrollHeight);
      
      // Human-like scroll
      await this.humanScroll(page, 500);
      
      links = await page.evaluate(() => {
        const links = new Set();
        document.querySelectorAll('a').forEach(anchor => {
          const href = anchor.href;
          if (href && (href.includes('/p/') || href.includes('/reel/'))) {
            if (anchor.querySelector('img')) links.add(href);
          }
        });
        return Array.from(links);
      });

      console.log(`Found ${links.length} posts after scroll attempt ${attempts + 1}`);
      
      if (links.length >= targetCount) break;

      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight <= previousHeight) {
        attempts++;
        await this.randomDelay(1000, 3000);
      }
    }

    return links.slice(0, targetCount);
  }

  async extractPostData(page) {
    try {
      return await page.evaluate(() => {
        const img = document.querySelector('img:not([src*="150x150"]):not([src*="profile"])');
        const video = document.querySelector('video');
        const textElements = Array.from(document.querySelectorAll('*'));
        let caption = '';

        for (const element of textElements) {
          const text = element.textContent?.trim() || '';
          if (text.includes('#') || text.length > 30) {
            caption = text;
            break;
          }
        }

        const mediaUrl = video ? 
          video.getAttribute('poster') || video.getAttribute('src') : 
          img?.getAttribute('src');

        if (!mediaUrl) return null;

        const timeElement = document.querySelector('time');
        const timestamp = timeElement?.getAttribute('datetime') || new Date().toISOString();

        return {
          type: video ? 'video' : 'image',
          mediaUrl,
          alt: (img?.getAttribute('alt') || video?.getAttribute('alt') || '').substring(0, 100),
          caption,
          timestamp,
          postUrl: window.location.href
        };
      });
    } catch (error) {
      console.error('Extract post data error:', error);
      return null;
    }
  }

  extractHashtags(text) {
    if (!text) return [];
    const hashtags = [];
    const matches = text.match(/#[\\w\\u0590-\\u05ff\\u00c0-\\u00ff\\d-_]+/g);
    if (matches) {
      matches.forEach(tag => {
        hashtags.push(tag.substring(1)); // Remove the # symbol
      });
    }
    return hashtags;
  }

  async downloadMedia(url, filePath) {
    try {
      if (!this.context) {
        throw new Error('Browser context not initialized');
      }
      
      const page = await this.context.newPage();
      try {
        // Use fetch from browser context to maintain cookies and headers
        const response = await page.goto(url, { timeout: TIMEOUT });
        if (!response) {
          throw new Error('Failed to fetch media');
        }
        
        const buffer = await response.body();
        await fs.writeFile(filePath, buffer);
      } finally {
        await page.close();
      }
    } catch (error) {
      console.error(`Error downloading media from ${url}:`, error);
      throw error;
    }
  }

  getPostIdFromUrl(url) {
    const parts = url.split('/');
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'p' || parts[i] === 'reel') {
        return parts[i + 1].toLowerCase();
      }
    }
    
    // Fallback: use last part or random ID
    return parts[parts.length - 2] || `post_${Date.now()}`;
  }

  async randomDelay(min, max) {
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
      console.log('Browser context closed');
    }
  }
}

export { InstagramScraper };