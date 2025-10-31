// LinkedIn Job Extractor - Content Script
console.log('LinkedIn Job Extractor loaded');

// Function to extract job title
function extractJobTitle() {
  const titleSelectors = [
    '.job-details-jobs-unified-top-card__job-title ',
    '.job-details-jobs-unified-top-card__job-title a',
    'h1[data-test-id="job-title"]'
  ];
  
  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.textContent.trim();
    }
  }
  return 'Title not found';
}

// Function to extract company name
function extractCompanyName() {
  const companySelectors = [
    '.job-details-jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name'
  ];
  
  for (const selector of companySelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.textContent.trim();
    }
  }
  return 'Company not found';
}

// Function to extract job description
function extractJobDescription() {
  const descriptionSelectors = [
    '.jobs-box__html-content',
    '.jobs-description-content__text--stretch',
    '#job-details'
  ];
  
  for (const selector of descriptionSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.textContent.trim();
    }
  }
  return 'Description not found';
}

// Check if we're on a LinkedIn job page
function isJobPage() {
  return window.location.href.includes('/jobs/');
}

// Main function to extract and display job data
function extractJobData() {
  if (!isJobPage()) {
    console.log('Not on a LinkedIn job page');
    return;
  }
  
  console.log('Extracting job data...');
  const jobTitle = extractJobTitle();
  const companyName = extractCompanyName();
  const jobDescription = extractJobDescription();
  
  console.log('Job Title:', jobTitle);
  console.log('Company:', companyName);
  console.log('Description Length:', jobDescription.length, 'characters');
  console.log('Description Preview:', jobDescription.substring(0, 200) + '...');
}

// Run extraction when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(extractJobData, 2000); // Wait 2 seconds for content to load
  });
} else {
  setTimeout(extractJobData, 2000); // Wait 2 seconds for content to load
}

// Resilient job data getter with backoff + MutationObserver
async function getJobDataResilient(timeoutMs = 6000) {
    const start = Date.now();
    function current() {
        return {
            title: extractJobTitle(),
            company: extractCompanyName(),
            description: extractJobDescription()
        };
    }
    function complete(d){ return d && d.title && d.title !== 'Title not found' && d.description && d.description !== 'Description not found'; }
    let data = current();
    if (complete(data)) return data;
    // Quick retries
    for (let i = 0; i < 3 && !complete(data); i++) {
        await new Promise(r=> setTimeout(r, 400));
        data = current();
        if (complete(data)) return data;
        if (Date.now() - start > timeoutMs) break;
    }
    // Observe DOM for changes until timeout
    data = current();
    if (complete(data)) return data;
    const found = await new Promise((resolve) => {
        const obs = new MutationObserver(() => {
            const d = current();
            if (complete(d)) { obs.disconnect(); resolve(d); }
        });
        obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
        setTimeout(() => { obs.disconnect(); resolve(null); }, Math.max(0, timeoutMs - (Date.now() - start)));
    });
    return found || current();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script: Received message:', request.type);
    
    if (request.type === 'GET_JOB_DATA') {
        console.log('Popup requested job data');
        (async () => {
            try {
                const jobData = await getJobDataResilient();
                sendResponse({ jobData });
            } catch (e) {
                sendResponse({ error: e.message || 'Failed to get job data' });
            }
        })();
        return true; // Keep message channel open
    }
    
    if (request.type === 'ANALYZE_WITH_RESUME') {
        console.log('Content script: Received ANALYZE_WITH_RESUME message');
        console.log('Content script: Resume text length:', request.resumeText?.length);
        analyzeJobWithResume(request.resumeText, sendResponse);
        return true; // Keep message channel open
    }
    
    console.log('Content script: Unknown message type:', request.type);
});

// Function to analyze job with resume using Prompt API
async function analyzeJobWithResume(resumeText, sendResponse) {
    try {
        console.log('Content script: Starting analysis...');
        
        const jobTitle = extractJobTitle();
        const companyName = extractCompanyName();
        const jobDescription = extractJobDescription();
        
        console.log('Content script: Extracted job data:', { jobTitle, companyName, jobDescriptionLength: jobDescription.length });
        
        // Check if LanguageModel API is available in content script
        if (typeof LanguageModel === 'undefined') {
            console.log('Content script: LanguageModel not available');
            sendResponse({ 
                error: 'LanguageModel API not available in content script context' 
            });
            return;
        }
        
        console.log('Content script: LanguageModel available, checking availability...');
        
        // Check availability
        const availability = await LanguageModel.availability();
        console.log('Content script: LanguageModel availability:', availability);
        
        if (availability === 'unavailable') {
            sendResponse({ 
                error: 'LanguageModel not available (unavailable)' 
            });
            return;
        }
        
        console.log('Content script: Creating LanguageModel session...');
        const session = await LanguageModel.create();
        
        // First, summarize job and resume
        console.log('Content script: Summarizing job description...');
        const jobSummary = await session.prompt(`Summarize this job description focusing on requirements, skills, and qualifications: ${jobDescription}`);
        
        console.log('Content script: Summarizing resume...');
        const resumeSummary = await session.prompt(`Summarize this resume focusing on skills, experience, and education: ${resumeText}`);
        
        // Then analyze match
        console.log('Content script: Analyzing match...');
        const analysisPrompt = `Analyze this job vs resume match:
        
Job: ${jobTitle} at ${companyName}
Job Requirements: ${jobSummary}
Resume Summary: ${resumeSummary}

Provide:
1. Match score (0-100%)
2. Missing skills
3. Strengths
4. Recommendations

Format as structured analysis.`;
        
        const analysis = await session.prompt(analysisPrompt);
        
        console.log('Content script: Analysis complete, sending response...');
        sendResponse({
            success: true,
            analysis: analysis,
            jobSummary: jobSummary,
            resumeSummary: resumeSummary
        });
        
    } catch (error) {
        console.error('Content script: Analysis error:', error);
        sendResponse({ 
            error: `Analysis failed: ${error.message}` 
        });
    }
}
