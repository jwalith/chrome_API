// background.js - Service Worker
console.log('Background service worker loaded');

// Listen for messages from external websites (like our localhost)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log('Received external message:', message);
  
  if (message.type === 'SAVE_RESUME') {
    // Save resume to Chrome storage
    chrome.storage.local.set({ 
      resumeText: message.data,
      resumeFileName: message.fileName,
      uploadDate: new Date().toISOString()
    }, () => {
      console.log('Resume saved in extension storage');
      sendResponse({ success: true });
    });
    return true; // Keeps message channel open for async response
  }
  
  if (message.type === 'GET_RESUME') {
    // Get resume from Chrome storage
    chrome.storage.local.get(['resumeText'], (result) => {
      sendResponse({ resumeText: result.resumeText });
    });
    return true;
  }
  
  if (message.type === 'GET_REWRITE_DATA') {
    // Get rewrite data from Chrome storage
    chrome.storage.local.get(['rewriteJobTitle', 'rewriteCompany', 'rewriteJobDescription', 'rewriteResumeText'], (result) => {
      console.log('GET_REWRITE_DATA result:', result);
      sendResponse({
        jobTitle: result.rewriteJobTitle,
        company: result.rewriteCompany,
        jobDescription: result.rewriteJobDescription,
        resumeText: result.rewriteResumeText
      });
    });
    return true; // Required to keep message channel open for async response
  }
});
