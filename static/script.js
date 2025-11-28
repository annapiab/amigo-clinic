const API_URL = window.location.origin;
let conversationId = 'default_' + Date.now();
let messageCount = 0;
let collectedInfo = {};

const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const resetButton = document.getElementById('reset-button');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');
const summaryContent = document.getElementById('summary-content');
const nurseStatus = document.getElementById('nurse-status');

// Set initial time
document.getElementById('initial-time').textContent = getCurrentTime();

// Auto-resize textarea
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Check if message indicates emergency
function isEmergencyMessage(message) {
    const emergencyKeywords = [
        'chest pain', 'chest pressure', 'heart attack',
        'difficulty breathing', 'can\'t breathe', 'shortness of breath',
        'severe pain', 'excruciating', 'unbearable',
        'loss of consciousness', 'passed out', 'fainted',
        'severe bleeding', 'uncontrolled bleeding', 'vomiting blood',
        'severe allergic reaction', 'anaphylaxis'
    ];
    
    const lowerMessage = message.toLowerCase();
    return emergencyKeywords.some(keyword => lowerMessage.includes(keyword));
}

function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function updateProgress() {
    // Simple progress calculation based on message count
    // You can make this more sophisticated based on actual data collected
    const progress = Math.min(messageCount * 10, 100);
    progressBar.style.width = progress + '%';
    progressPercent.textContent = progress + '%';
}

function updateSummary(userMessage, aiResponse) {
    // Extract key information from conversation - accumulate all symptoms
    const newSymptoms = extractSymptoms(userMessage);
    
    // Merge with existing symptoms (avoid duplicates)
    if (newSymptoms.length > 0) {
        if (!collectedInfo.symptoms) {
            collectedInfo.symptoms = [];
        }
        newSymptoms.forEach(symptom => {
            if (!collectedInfo.symptoms.includes(symptom)) {
                collectedInfo.symptoms.push(symptom);
            }
        });
    }
    
    // Extract resolution from AI response (look for recommendations or next steps)
    if (aiResponse) {
        const resolution = extractResolution(aiResponse);
        if (resolution) {
            collectedInfo.resolution = resolution;
        }
    }
    
    // Update summary display
    summaryContent.innerHTML = '';
    
    if (Object.keys(collectedInfo).length === 0) {
        summaryContent.innerHTML = '<div class="text-sm text-gray-500 italic">No information collected yet. The nurse will gather details as you chat.</div>';
    } else {
        if (collectedInfo.symptoms && collectedInfo.symptoms.length > 0) {
            const symptomsDiv = document.createElement('div');
            symptomsDiv.className = 'mb-3 p-3 bg-green-50 rounded-lg border border-green-200';
            symptomsDiv.innerHTML = `
                <div class="font-semibold text-green-900 text-sm mb-1">Symptoms</div>
                <div class="text-gray-700 text-sm">${collectedInfo.symptoms.join(', ')}</div>
            `;
            summaryContent.appendChild(symptomsDiv);
        }
        
        if (collectedInfo.resolution) {
            const resolutionDiv = document.createElement('div');
            resolutionDiv.className = 'mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200';
            resolutionDiv.innerHTML = `
                <div class="font-semibold text-blue-900 text-sm mb-1">Resolution</div>
                <div class="text-gray-700 text-sm">${collectedInfo.resolution}</div>
            `;
            summaryContent.appendChild(resolutionDiv);
        }
    }
}

function extractResolution(aiResponse) {
    // Extract a concise summary of recommendations/resolution
    // Look for numbered recommendations or key action items
    const resolutionPatterns = [
        // Match numbered recommendations (1., 2., 3.)
        /(?:Here are|Here's|I recommend)[\s\S]{0,300}?(?:\d+\.\s[^0-9]+){1,3}/i,
        // Match follow-up instructions
        /(?:If this isn't improving|contact.*doctor|seek.*care)[^.]{0,100}\./i
    ];
    
    for (const pattern of resolutionPatterns) {
        const match = aiResponse.match(pattern);
        if (match && match[0]) {
            let resolution = match[0].trim();
            // Remove markdown
            resolution = resolution.replace(/\*\*/g, '').replace(/__/g, '').replace(/\*/g, '').replace(/_/g, '');
            // Clean up extra whitespace
            resolution = resolution.replace(/\s+/g, ' ');
            // Extract just the key recommendations (first 2-3 items)
            const numberedItems = resolution.match(/\d+\.\s[^0-9]+/g);
            if (numberedItems && numberedItems.length > 0) {
                // Take first 2-3 recommendations and make them concise
                const keyItems = numberedItems.slice(0, 3).map(item => {
                    // Limit each item to ~60 chars
                    let clean = item.replace(/\d+\.\s*/, '').trim();
                    if (clean.length > 60) {
                        clean = clean.substring(0, 57) + '...';
                    }
                    return clean;
                });
                resolution = keyItems.join(' • ');
            }
            // Final length check - keep it short
            if (resolution.length > 150) {
                resolution = resolution.substring(0, 147) + '...';
            }
            return resolution;
        }
    }
    
    // Fallback: extract a short summary from the response
    const summaryMatch = aiResponse.match(/(?:recommend|suggest|advise)[^.]{0,100}\./i);
    if (summaryMatch) {
        let summary = summaryMatch[0].trim();
        summary = summary.replace(/\*\*/g, '').replace(/__/g, '').replace(/\*/g, '').replace(/_/g, '');
        if (summary.length > 120) {
            summary = summary.substring(0, 117) + '...';
        }
        return summary;
    }
    
    return null;
}

function extractSymptoms(message) {
    const symptomKeywords = ['pain', 'ache', 'headache', 'fatigue', 'tired', 'nausea', 'dizziness', 'fever', 'cough'];
    const lowerMessage = message.toLowerCase();
    return symptomKeywords.filter(keyword => lowerMessage.includes(keyword));
}


function addMessage(content, isUser = false, isEmergency = false) {
    messageCount++;
    updateProgress();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = `w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-green-100' : 'bg-blue-100'
    }`;
    
    if (isUser) {
        avatarDiv.innerHTML = `
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
        `;
    } else {
        avatarDiv.innerHTML = `
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
        `;
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = `flex-1 ${isUser ? 'items-end' : ''}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = `rounded-2xl px-4 py-3 shadow-sm border ${
        isUser 
            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white rounded-tr-sm' 
            : isEmergency
            ? 'bg-red-50 border-red-200 text-red-900'
            : 'bg-white border-gray-200 text-gray-800'
    } ${isUser ? '' : 'rounded-tl-sm'}`;
    
    // Remove markdown formatting (**, __, etc.) before displaying
    const cleanContent = content.replace(/\*\*/g, '').replace(/__/g, '').replace(/\*/g, '').replace(/_/g, '');
    bubbleDiv.textContent = cleanContent;
    
    const timeDiv = document.createElement('span');
    timeDiv.className = `text-xs text-gray-500 mt-1 block ${isUser ? 'text-right' : 'ml-1'}`;
    timeDiv.textContent = getCurrentTime();
    
    contentDiv.appendChild(bubbleDiv);
    contentDiv.appendChild(timeDiv);
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    nurseStatus.textContent = 'Nurse is typing...';
    nurseStatus.className = 'text-sm text-blue-100 italic';
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'flex items-start gap-3';
    typingDiv.id = 'typing-indicator';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0';
    avatarDiv.innerHTML = `
        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
    `;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-200';
    bubbleDiv.innerHTML = `
        <div class="flex gap-1">
            <span class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
            <span class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
            <span class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
        </div>
    `;
    
    typingDiv.appendChild(avatarDiv);
    typingDiv.appendChild(bubbleDiv);
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    nurseStatus.textContent = 'Online';
    nurseStatus.className = 'text-sm text-blue-100';
    
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

async function sendMessage(messageText = null) {
    const message = messageText || userInput.value.trim();
    if (!message) return;
    
    // Disable input while processing
    userInput.disabled = true;
    sendButton.disabled = true;
    userInput.style.height = 'auto';
    
    // Clear input if not a test message
    if (!messageText) {
        userInput.value = '';
    }
    
    // Add user message
    const isEmergency = isEmergencyMessage(message);
    addMessage(message, true);
    
    // Update summary with user message
    updateSummary(message, null);
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        console.log('Sending message to:', `${API_URL}/chat`);
        
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                message: message
            }),
            mode: 'cors'
        });
        
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.message) {
            throw new Error('Invalid response: no message field');
        }
        
        hideTypingIndicator();
        
        // Update summary with AI response
        updateSummary(message, data.message);
        
        // Check if response indicates emergency
        const responseIsEmergency = isEmergencyMessage(data.message);
        addMessage(data.message, false, responseIsEmergency);
        
    } catch (error) {
        console.error('Error details:', error);
        hideTypingIndicator();
        
        let errorMessage = `I apologize, but I'm experiencing a technical issue. `;
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage += 'It seems there\'s a network connection problem. Please check your internet connection and try again.';
        } else if (error.message.includes('Connection error') || error.message.includes('Anthropic')) {
            errorMessage += 'There\'s an issue connecting to the AI service. Please verify the API configuration.';
        } else {
            errorMessage += `Error: ${error.message}`;
        }
        addMessage(errorMessage, false);
    } finally {
        // Re-enable input
        userInput.disabled = false;
        sendButton.disabled = false;
        if (!messageText) {
            userInput.focus();
        }
    }
}

// Global function for test buttons
window.sendTestMessage = sendMessage;

async function resetConversation() {
    if (!confirm('Start a new intake? This will clear the current conversation history.')) {
        return;
    }
    
    try {
        await fetch(`${API_URL}/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                conversation_id: conversationId
            })
        });
        
        // Clear chat messages except initial greeting
        chatMessages.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                </div>
                <div class="flex-1">
                    <div class="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-200">
                        <p class="text-gray-800">Hello! I'm here to help you with your health concerns. Please describe what you're experiencing, and I'll help assess your symptoms and provide appropriate guidance. What brings you in today?</p>
                    </div>
                    <span class="text-xs text-gray-500 mt-1 block ml-1">${getCurrentTime()}</span>
                </div>
            </div>
        `;
        
        // Reset counters and info
        messageCount = 0;
        collectedInfo = {};
        updateProgress();
        summaryContent.innerHTML = '<div class="text-sm text-gray-500 italic">No information collected yet. The nurse will gather details as you chat.</div>';
        
        // Generate new conversation ID
        conversationId = 'default_' + Date.now();
        
    } catch (error) {
        console.error('Error resetting conversation:', error);
    }
}

// Event listeners
sendButton.addEventListener('click', () => sendMessage());
resetButton.addEventListener('click', resetConversation);

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Focus input on load
setTimeout(() => {
    userInput.focus();
    console.log('Input focused, ready to chat');
}, 100);

// Test API connection on load
window.addEventListener('load', async () => {
    console.log('App loaded, API URL:', API_URL);
    
    // Test health endpoint
    try {
        const healthResponse = await fetch(`${API_URL}/health`);
        const healthData = await healthResponse.json();
        console.log('Health check:', healthData);
    } catch (error) {
        console.error('Health check failed:', error);
    }
});
