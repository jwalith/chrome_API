// popup.js - Simplified Popup
console.log('Popup loaded');

document.addEventListener('DOMContentLoaded', function() {
    const analyzePromptBtn = document.getElementById('analyzePromptBtn');
    const summarizeJDBtn = document.getElementById('summarizeJDBtn');
    const rewriteBtn = document.getElementById('rewriteBtn');
    const statusDiv = document.getElementById('status');
    
    function setStatus(html) {
        statusDiv.innerHTML = html;
    }
    function setText(text) {
        statusDiv.textContent = text;
    }

    function renderCards(result) {
        const { score, missing, strengths, recs } = result;
        setStatus(`
            <div class="section"><div class="section-title">Match Score</div>${score ?? '—'}</div>
            <div class="section"><div class="section-title">Missing Skills</div>${(missing||[]).map(s=>`<span style=\"display:inline-block;margin:2px 6px 2px 0;padding:4px 8px;border:1px solid #ddd;border-radius:12px;\">${escapeHtml(String(s))}</span>`).join(' ') || '—'}</div>
            <div class="section"><div class="section-title">Strengths</div><ul>${(strengths||[]).slice(0,5).map(s=>`<li>${escapeHtml(String(s))}</li>`).join('')}</ul></div>
            <div class="section"><div class="section-title">Recommendations</div><ul>${(recs||[]).slice(0,5).map(s=>`<li>${escapeHtml(String(s))}</li>`).join('')}</ul></div>
        `);
    }

    function escapeHtml(s){ return (s||'').replace(/[&<>]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

    function formatSummaryText(text) {
        if (!text) return '';
        const escaped = escapeHtml(text);
        
        // Split into lines
        const lines = escaped.split(/\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return '';
        
        const formatted = [];
        let currentList = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Check for numbered list (1. 2. etc.)
            const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
            if (numberedMatch) {
                currentList.push(`<li>${numberedMatch[2]}</li>`);
                continue;
            }
            
            // Check for dash/bullet list
            const bulletMatch = trimmed.match(/^[-•]\s+(.+)$/);
            if (bulletMatch) {
                currentList.push(`<li>${bulletMatch[1]}</li>`);
                continue;
            }
            
            // If we have accumulated list items, close the list
            if (currentList.length > 0) {
                formatted.push(`<ul>${currentList.join('')}</ul>`);
                currentList = [];
            }
            
            // Regular paragraph content
            formatted.push(`<p>${trimmed}</p>`);
        }
        
        // Close any remaining list
        if (currentList.length > 0) {
            formatted.push(`<ul>${currentList.join('')}</ul>`);
        }
        
        // If no formatting was applied, treat as single paragraph
        if (formatted.length === 0) {
            return `<p>${escaped.replace(/\n/g, '<br>')}</p>`;
        }
        
        return formatted.join('');
    }

    function normalizeResult(obj){
        if (!obj || typeof obj !== 'object') return null;
        const out = {
            score: typeof obj.score === 'string' ? obj.score : (typeof obj.score === 'number' ? `${Math.round(obj.score)}%` : '—'),
            missing: Array.isArray(obj.missing) ? obj.missing : (obj.missing ? String(obj.missing).split(/[,\n]+/).map(s=>s.trim()).filter(Boolean) : []),
            strengths: Array.isArray(obj.strengths) ? obj.strengths : (obj.strengths ? String(obj.strengths).split(/[,\n]+/).map(s=>s.trim()).filter(Boolean) : []),
            recs: Array.isArray(obj.recs) ? obj.recs : (obj.recs || obj.recommendations ? String(obj.recs || obj.recommendations).split(/[,\n]+/).map(s=>s.trim()).filter(Boolean) : [])
        };
        return out;
    }

    function tryParseJsonFrom(raw){
        if (raw && typeof raw !== 'string') {
            try { return normalizeResult(raw); } catch {}
        }
        const text = String(raw || '').trim();
        try { return normalizeResult(JSON.parse(text)); } catch {}
        const fenceMatch = text.match(/```[a-z]*\s*([\s\S]*?)```/i);
        if (fenceMatch && fenceMatch[1]) {
            try { return normalizeResult(JSON.parse(fenceMatch[1])); } catch {}
        }
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            const slice = text.slice(start, end + 1);
            try { return normalizeResult(JSON.parse(slice)); } catch {}
        }
        return null;
    }

    async function getActiveJobData() {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('No active tab');
        const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_JOB_DATA' });
        if (!res || !res.jobData) throw new Error('No job data found (open a LinkedIn job page)');
        return res.jobData;
    }

    analyzePromptBtn.addEventListener('click', async function() {
        try {
            setText('Checking resume...');
            const { resumeText } = await new Promise((resolve)=> chrome.storage.local.get(['resumeText'], resolve));
            if (!resumeText) { setText('No resume found. Upload on the website first.'); return; }

            setText('Getting job data...');
            const job = await getActiveJobData();

            // Try Prompt API first
            if (typeof LanguageModel !== 'undefined') {
                const avail = await LanguageModel.availability();
                if (avail !== 'unavailable') {
                    setText('Analyzing with Prompt API...');
                    const session = await LanguageModel.create();
                    const prompt = `Output ONLY a JSON object (no code fences, no markdown) with these keys: score (like '82%'), missing (array of strings), strengths (array of strings), recs (array of strings).\nJob: ${job.title} at ${job.company}\nJD: ${job.description.substring(0, 4000)}\nResume: ${resumeText.substring(0, 4000)}`;
                    const raw = await session.prompt(prompt);
                    const parsed = tryParseJsonFrom(raw);
                    if (parsed) { renderCards(parsed); return; }
                    setStatus(`<div class="section"><div class="section-title">Analysis</div>${escapeHtml(String(raw))}</div>`);
                    return;
                }
            }

            // Fallback to Summarizer
            if (typeof Summarizer === 'undefined') { setText('No AI available (Prompt/Summarizer).'); return; }
            const sAvail = await Summarizer.availability();
            if (sAvail === 'unavailable') { setText('Summarizer unavailable.'); return; }
            setText('Summarizing with fallback...');
            const s = await Summarizer.create();
            const jobSummary = await s.summarize(job.description, { maxLength: 160, focus: 'requirements, skills, qualifications' });
            const resumeSummary = await s.summarize(resumeText, { maxLength: 160, focus: 'skills, experience, education' });
            const jt = typeof jobSummary === 'string' ? jobSummary : (jobSummary?.summary || jobSummary?.text || '');
            const rt = typeof resumeSummary === 'string' ? resumeSummary : (resumeSummary?.summary || resumeSummary?.text || '');
            setStatus(`
                <div class="section"><div class="section-title">Job Summary</div>${escapeHtml(jt)}</div>
                <div class="section"><div class="section-title">Resume Summary</div>${escapeHtml(rt)}</div>
            `);
        } catch (e) {
            setText('Error: ' + e.message);
        }
    });

    summarizeJDBtn.addEventListener('click', async function() {
        try {
            setText('Getting job data...');
            const job = await getActiveJobData();

            // Check if Summarizer API is available
            if (typeof Summarizer === 'undefined') {
                setText('Summarizer API not available in this browser.');
                return;
            }

            const availability = await Summarizer.availability();
            if (availability === 'unavailable') {
                setText('Summarizer unavailable. You need Chrome with AI features enabled.');
                return;
            }

            setText('Summarizing job description...');
            const session = await Summarizer.create();
            
            // Summarize with focus on requirements, skills, and qualifications
            const summary = await session.summarize(job.description, {
                maxLength: 200,
                focus: 'requirements, skills, qualifications, responsibilities'
            });

            const summaryText = typeof summary === 'string' 
                ? summary 
                : (summary?.summary || summary?.text || 'Summary not available');

            setStatus(`
                <div class="section">
                    <div class="section-title" style="font-size: 13px; margin-bottom: 10px; color: #16a34a;">
                        📋 ${escapeHtml(job.title)} at ${escapeHtml(job.company)}
                    </div>
                    <div style="margin-top: 8px; color: #374151; font-size: 12px;">
                        ${formatSummaryText(summaryText)}
                    </div>
                </div>
            `);
        } catch (e) {
            setText('Error: ' + e.message);
        }
    });

    rewriteBtn.addEventListener('click', async function() {
        try {
            setText('Preparing website...');
            const resume = await new Promise((resolve) => chrome.storage.local.get(['resumeText'], resolve));
            if (!resume?.resumeText) { setText('No resume found. Upload on the website first.'); return; }

            const job = await getActiveJobData();

            // Store rewrite data in extension storage
            await new Promise((resolve) => chrome.storage.local.set({
                rewriteJobTitle: job.title || '',
                rewriteCompany: job.company || '',
                rewriteJobDescription: (job.description || '').substring(0, 20000),
                rewriteResumeText: resume.resumeText
            }, resolve));

            // Open website with extId and lightweight job params as fallback for rendering
            const extId = chrome.runtime?.id || '';
            const params = new URLSearchParams({
                src: 'ext',
                extId,
                jobTitle: job.title || '',
                company: job.company || '',
                jobDescription: (job.description || '').substring(0, 20000)
            });
            const url = `http://127.0.0.1:5500/Ext_plus_site/website/index.html?${params.toString()}`;
            chrome.tabs.create({ url });
            setText('Opening website...');
        } catch (e) {
            setText('Error: ' + e.message);
        }
    });
});
