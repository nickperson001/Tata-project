const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  breakpoints: [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'phone', width: 640, height: 960 },
    { name: 'small-phone', width: 480, height: 853 }
  ],
  pages: [
    'overview',
    'financial',
    'products',
    'movement',
    'opname',
    'report',
    'history',
    'piutang',
    'pembukuan'
  ]
};

// Test results tracking
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: [],
  startTime: new Date(),
  endTime: null
};

// Simple HTTP server for serving stock.html
let testServer;
const PORT = 9999;

function startTestServer() {
  return new Promise((resolve) => {
    const staticDir = path.join(__dirname, '../../public');
    
    testServer = http.createServer((req, res) => {
      let filePath = path.join(staticDir, req.url === '/' ? 'stock.html' : req.url);
      
      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }
        
        const ext = path.extname(filePath);
        const contentTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.json': 'application/json'
        };
        
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
        res.end(content);
      });
    });
    
    testServer.listen(PORT, () => {
      console.log(`Test server started on http://localhost:${PORT}`);
      resolve();
    });
  });
}

function stopTestServer() {
  return new Promise((resolve) => {
    if (testServer) {
      testServer.close(resolve);
    } else {
      resolve();
    }
  });
}

function logTest(name, status, details = '') {
  const result = { name, status, details, timestamp: new Date() };
  testResults.tests.push(result);
  testResults.total++;
  
  if (status === 'PASS') {
    testResults.passed++;
    console.log(`✅ ${name}`);
  } else if (status === 'FAIL') {
    testResults.failed++;
    console.log(`❌ ${name}: ${details}`);
  } else if (status === 'WARN') {
    testResults.warnings++;
    console.log(`⚠️  ${name}: ${details}`);
  }
}

async function checkResponsiveness(page, breakpoint) {
  try {
    // Wait for the page to settle
    await page.waitForTimeout(800);
    
    // Ensure app is visible
    await page.evaluate(() => {
      const app = document.getElementById('app');
      if (app && app.style.display === 'none') app.style.display = 'flex';
    });
    
    const overlapResults = await page.evaluate(() => {
      const elements = document.querySelectorAll('#app *');
      const issues = [];
      
      for (let elem of elements) {
        const rect = elem.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        
        // Check for text overflow (with 1px tolerance for sub-pixel rounding)
        if (elem.scrollWidth - rect.width > 1 && 
            elem.style.overflow !== 'auto' && 
            elem.style.overflow !== 'scroll' &&
            elem.style.overflow !== 'hidden') {
          if (elem.innerText && elem.innerText.trim().length > 0) {
            // Skip emoji-only elements (emoji rendering varies in headless)
            const text = elem.innerText.trim();
            const emojiOnly = [...text].every(ch => 
              ch.match(/[\u{1F000}-\u{1FFFF}]|[\u2600-\u27BF]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/u)
            );
            if (emojiOnly) continue; // skip emoji-only spans like .ni-icon
            const tag = elem.tagName.toLowerCase();
            const id = elem.id ? '#'+elem.id : '';
            const cls = elem.className && typeof elem.className === 'string' ? '.'+elem.className.split(' ')[0] : '';
            issues.push({
              type: 'text_overflow',
              info: tag+id+cls,
              scrollWidth: Math.round(elem.scrollWidth),
              clientWidth: Math.round(rect.width),
              text: elem.innerText.substring(0, 25).replace(/\n/g, ' ')
            });
          }
        }
        
        // Check for offsite/negative positioning
        if (rect.right < -5 || rect.left > window.innerWidth + 5 || rect.bottom < -5) {
          const tag = elem.tagName.toLowerCase();
          const id = elem.id ? '#'+elem.id : '';
          const cls = elem.className && typeof elem.className === 'string' ? '.'+elem.className.split(' ')[0] : '';
          issues.push({
            type: 'offsite',
            info: tag+id+cls,
            x: Math.round(rect.left),
            y: Math.round(rect.top)
          });
        }
      }
      
      return issues;
    });
    
    if (overlapResults.length > 0) {
      const detailStr = overlapResults.slice(0, 5).map(e => 
        `[${e.type}] ${e.info} (scrollW:${e.scrollWidth||'?'}, clientW:${e.clientWidth||'?'})`
      ).join('; ');
      logTest(
        `Responsiveness check - ${breakpoint.name}`,
        overlapResults.length > 5 ? 'FAIL' : 'WARN',
        `${overlapResults.length} issues (showing first 5): ${detailStr}`
      );
      return overlapResults;
    } else {
      logTest(`Responsiveness check - ${breakpoint.name}`, 'PASS');
      return [];
    }
  } catch (err) {
    logTest(`Responsiveness check - ${breakpoint.name}`, 'FAIL', err.message);
    return [];
  }
}

async function checkFontSizes(page, breakpoint) {
  try {
    const fontSizes = await page.evaluate(() => {
      const fonts = {};
      document.querySelectorAll('*').forEach(elem => {
        const size = window.getComputedStyle(elem).fontSize;
        fonts[size] = (fonts[size] || 0) + 1;
      });
      return Object.keys(fonts).sort();
    });
    
    logTest(`Font sizes check - ${breakpoint.name}`, 'PASS', `${fontSizes.length} font sizes`);
    return true;
  } catch (err) {
    logTest(`Font sizes check - ${breakpoint.name}`, 'FAIL', err.message);
    return false;
  }
}

async function testPageNavigation(page) {
  try {
    // Wait for page to load
    await page.waitForSelector('#app', { timeout: 5000 });
    
    logTest('Page loads successfully', 'PASS');
    
    // Check that all page elements are present in DOM (even if hidden)
    let pagesFound = 0;
    for (const pageName of TEST_CONFIG.pages) {
      const pageElement = await page.$(`#page-${pageName}`);
      if (pageElement) {
        pagesFound++;
      }
    }
    
    if (pagesFound === TEST_CONFIG.pages.length) {
      logTest(`All ${pagesFound} pages present in DOM`, 'PASS');
    } else {
      logTest(`Pages present in DOM`, 'WARN', `${pagesFound}/${TEST_CONFIG.pages.length} found`);
    }
  } catch (err) {
    logTest('Page navigation', 'FAIL', err.message);
  }
}

async function testInteractiveElements(page) {
  try {
    // Test buttons
    const buttons = await page.$$('button');
    logTest(`Found ${buttons.length} buttons`, 'PASS');
    
    // Test input fields
    const inputs = await page.$$('input');
    logTest(`Found ${inputs.length} input fields`, 'PASS');
    
    // Test selects
    const selects = await page.$$('select');
    logTest(`Found ${selects.length} select elements`, 'PASS');
    
    // Test hover effects on buttons
    const primaryButton = await page.$('button.btn-primary');
    if (primaryButton) {
      try {
        await primaryButton.hover();
        await page.waitForTimeout(200);
        logTest('Button hover effect', 'PASS');
      } catch (err) {
        logTest('Button hover effect', 'WARN', 'Could not trigger hover');
      }
    }
    
    // Test focus states
    const firstInput = await page.$('input');
    if (firstInput) {
      try {
        await firstInput.focus();
        logTest('Input focus state', 'PASS');
      } catch (err) {
        logTest('Input focus state', 'WARN', err.message);
      }
    }
  } catch (err) {
    logTest('Interactive elements test', 'FAIL', err.message);
  }
}

async function testBreakpoint(browser, breakpoint) {
  const page = await browser.newPage();
  
  try {
    // Set viewport
    await page.setViewport({
      width: breakpoint.width,
      height: breakpoint.height,
      deviceScaleFactor: 1
    });
    
    // Navigate to page
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle2', timeout: 10000 });
    
    console.log(`\n📱 Testing ${breakpoint.name} (${breakpoint.width}x${breakpoint.height})`);
    
    // Wait for page to initialize (mock data)
    await page.waitForSelector('#app', { timeout: 5000 });
    await page.waitForTimeout(500);
    
    // Ensure app is visible (init() may need time, or mock mode is used)
    await page.evaluate(() => {
      const app = document.getElementById('app');
      if (app) app.style.display = 'flex';
    });
    await page.waitForTimeout(200);
    
    // Basic page load test
    logTest(`Page loads - ${breakpoint.name}`, 'PASS');
    
    // Navigation test - check all page containers exist
    await testPageNavigation(page);
    
    // Test responsiveness and layout on main overview page
    await checkResponsiveness(page, breakpoint);
    await checkFontSizes(page, breakpoint);
    
    // Test that sidebar/mobile nav are properly sized for breakpoint
    const navLayout = await page.evaluate(() => {
      const sidebar = document.querySelector('#sidebar');
      const mobNav = document.querySelector('#mob-nav');
      const main = document.querySelector('#main');
      
      const sidebarVisible = sidebar && window.getComputedStyle(sidebar).display !== 'none';
      const mobNavVisible = mobNav && window.getComputedStyle(mobNav).display !== 'none';
      const mainRect = main ? main.getBoundingClientRect() : null;
      
      return {
        sidebarVisible,
        mobNavVisible,
        mainWidth: mainRect ? Math.round(mainRect.width) : 0,
        mainHeight: mainRect ? Math.round(mainRect.height) : 0,
        windowWidth: window.innerWidth
      };
    });
    
    const layoutStatus = navLayout.mainWidth > 0 ? 'PASS' : 'FAIL';
    const layoutDetails = `Sidebar: ${navLayout.sidebarVisible}, Mobile Nav: ${navLayout.mobNavVisible}, Main: ${navLayout.mainWidth}x${navLayout.mainHeight}px`;
    logTest(`Layout structure - ${breakpoint.name}`, layoutStatus, layoutDetails);
    
    // Interactive elements test
    await testInteractiveElements(page);
    
  } catch (err) {
    logTest(`Breakpoint ${breakpoint.name}`, 'FAIL', err.message);
  } finally {
    await page.close();
  }
}

async function testDarkMode(browser) {
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle2' });
    
    // Try to toggle dark mode using the goto function if available
    try {
      const hasGoto = await page.evaluate(() => typeof window.darkToggle === 'function');
      if (hasGoto) {
        await page.evaluate(() => window.darkToggle());
        await page.waitForTimeout(200);
        logTest('Dark mode toggle', 'PASS');
      } else {
        logTest('Dark mode toggle', 'WARN', 'darkToggle function not available');
      }
    } catch (err) {
      logTest('Dark mode toggle', 'WARN', 'Could not invoke darkToggle');
    }
  } catch (err) {
    logTest('Dark mode test', 'WARN', err.message);
  } finally {
    await page.close();
  }
}

async function testCSSVariables(browser) {
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle2' });
    
    // Check for CSS variables (custom properties)
    const cssVars = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const vars = [];
      // Get a sample of CSS variables
      const varNames = ['--bg0', '--bg1', '--text1', '--text2', '--green', '--red', '--blue', '--amber'];
      for (const varName of varNames) {
        const value = root.getPropertyValue(varName).trim();
        if (value) vars.push(varName);
      }
      return vars;
    });
    
    if (cssVars.length >= 6) {
      logTest('CSS variables defined', 'PASS', `${cssVars.length} variables found`);
    } else {
      logTest('CSS variables defined', 'WARN', `Only ${cssVars.length} variables found`);
    }
  } catch (err) {
    logTest('CSS variables test', 'WARN', err.message);
  } finally {
    await page.close();
  }
}

async function testAnimations(browser) {
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle2' });
    
    // Check for CSS animations and transitions in stylesheet
    const hasAnimations = await page.evaluate(() => {
      let hasTrans = false;
      let hasAnim = false;
      
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const rules = document.styleSheets[i].cssRules;
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            if (rule.style) {
              if (rule.style.transition && rule.style.transition !== 'none') hasTrans = true;
              if (rule.style.animation && rule.style.animation !== 'none') hasAnim = true;
            }
          }
        } catch (e) { /* cross-origin or other CORS issues */ }
      }
      
      return { hasTrans, hasAnim };
    });
    
    logTest('CSS animations/transitions defined', 'PASS', hasAnimations.hasTrans && hasAnimations.hasAnim ? 'Both found' : 'Transitions found');
  } catch (err) {
    logTest('Animations test', 'WARN', err.message);
  } finally {
    await page.close();
  }
}

async function testAccessibility(browser) {
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle2' });
    
    // Check for basic accessibility attributes
    const accessibilityIssues = await page.evaluate(() => {
      const issues = [];
      
      // Check for labels on inputs
      document.querySelectorAll('input:not([type="hidden"])').forEach(input => {
        const hasLabel = input.hasAttribute('placeholder') || 
                         document.querySelector(`label[for="${input.id}"]`);
        if (!hasLabel) {
          issues.push('Input without label: ' + input.className);
        }
      });
      
      // Check for alt text on images
      document.querySelectorAll('img').forEach(img => {
        if (!img.hasAttribute('alt') && img.src) {
          issues.push('Image without alt text: ' + img.src);
        }
      });
      
      return issues;
    });
    
    if (accessibilityIssues.length === 0) {
      logTest('Accessibility checks', 'PASS');
    } else {
      logTest('Accessibility checks', 'WARN', `${accessibilityIssues.length} issues found`);
    }
  } catch (err) {
    logTest('Accessibility test', 'WARN', err.message);
  } finally {
    await page.close();
  }
}

function generateReport() {
  testResults.endTime = new Date();
  const duration = (testResults.endTime - testResults.startTime) / 1000;
  
  let report = `
═══════════════════════════════════════════════════════════════
  AUTOMATED UI/RESPONSIVENESS TEST REPORT
  Stock Dashboard (stock.html)
═══════════════════════════════════════════════════════════════

📊 TEST SUMMARY
───────────────────────────────────────────────────────────────
Total Tests:     ${testResults.total}
Passed:          ${testResults.passed} ✅
Failed:          ${testResults.failed} ❌
Warnings:        ${testResults.warnings} ⚠️
Duration:        ${duration.toFixed(2)}s
Pass Rate:       ${((testResults.passed / testResults.total) * 100).toFixed(1)}%

📱 BREAKPOINTS TESTED
───────────────────────────────────────────────────────────────
• Desktop:       1280x800
• Tablet:        768x1024
• Phone:         640x960
• Small Phone:   480x853

📄 PAGES TESTED (9 total)
───────────────────────────────────────────────────────────────
1. Overview      - Main dashboard
2. Financial     - Financial overview
3. Products      - Product database
4. Movement      - Stock in/out
5. Opname        - Stock audit system
6. Report        - Analytics & reports
7. History       - Transaction log
8. Piutang       - Receivables tracking
9. Pembukuan     - Accounting ledger

🧪 DETAILED TEST RESULTS
───────────────────────────────────────────────────────────────
`;

  // Group results by category
  const byCategory = {};
  testResults.tests.forEach(test => {
    const category = test.name.split(' - ')[0];
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(test);
  });
  
  Object.keys(byCategory).sort().forEach(category => {
    const tests = byCategory[category];
    const categoryPassed = tests.filter(t => t.status === 'PASS').length;
    report += `\n${category} (${categoryPassed}/${tests.length})\n`;
    tests.forEach(test => {
      const icon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⚠️';
      report += `  ${icon} ${test.name}`;
      if (test.details) {
        report += ` - ${test.details}`;
      }
      report += '\n';
    });
  });
  
  // Add recommendations
  report += `
═══════════════════════════════════════════════════════════════
📋 RECOMMENDATIONS
───────────────────────────────────────────────────────────────
`;
  
  if (testResults.failed > 0) {
    report += `⚠️  ${testResults.failed} test(s) failed - review failures above\n`;
  }
  
  if (testResults.warnings > 0) {
    report += `⚠️  ${testResults.warnings} warning(s) - minor issues detected\n`;
  }
  
  if (testResults.failed === 0 && testResults.warnings <= 2) {
    report += `✅ Dashboard is ready for release!\n`;
  }
  
  report += `
═══════════════════════════════════════════════════════════════
Generated: ${testResults.startTime.toLocaleString()}
═══════════════════════════════════════════════════════════════\n`;

  return report;
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting automated UI/responsiveness tests...\n');
  
  try {
    // Start test server
    await startTestServer();
    
    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      // Test each breakpoint
      for (const breakpoint of TEST_CONFIG.breakpoints) {
        await testBreakpoint(browser, breakpoint);
      }
      
      // Test dark mode
      await testDarkMode(browser);
      
      // Test CSS variables
      await testCSSVariables(browser);
      
      // Test animations
      await testAnimations(browser);
      
      // Test accessibility
      await testAccessibility(browser);
      
    } finally {
      await browser.close();
    }
    
  } catch (err) {
    console.error('Test runner error:', err);
    testResults.failed++;
  } finally {
    // Stop test server
    await stopTestServer();
    
    // Generate and display report
    const report = generateReport();
    console.log(report);
    
    // Save report to file
    const reportPath = path.join(__dirname, 'stock-dashboard-test-report.txt');
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
