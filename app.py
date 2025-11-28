from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import requests

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# Load system prompt
with open('system_prompt.txt', 'r') as f:
    SYSTEM_PROMPT = f.read()

# Store conversation history
conversations = {}

# Serve frontend
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files (CSS, JS)"""
    if filename in ['style.css', 'script.js']:
        return send_from_directory('static', filename)
    return '', 404

# Health check endpoint (GET)
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'message': 'Server is running'
    }), 200

# Chat endpoint (POST)
@app.route('/chat', methods=['POST'])
def chat():
    # Get data from request
    data = request.json
    if not data or not data.get('message'):
        return jsonify({'error': 'Message is required'}), 400
    
    conversation_id = data.get('conversation_id', 'default')
    user_message = data.get('message')
    
    # Initialize conversation if needed
    if conversation_id not in conversations:
        conversations[conversation_id] = [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'assistant', 'content': "Hello! I'm here to help you with your health concerns. To get started, may I have your first name?"}
        ]
    
    # Add user message to history
    conversations[conversation_id].append({
        'role': 'user',
        'content': user_message
    })
    
    try:
        # Get API key
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            return jsonify({'error': 'API key not configured'}), 500
        
        # Prepare messages for Anthropic API
        system_message = None
        anthropic_messages = []
        
        for msg in conversations[conversation_id]:
            if msg['role'] == 'system':
                system_message = msg['content']
            elif msg['role'] in ['user', 'assistant']:
                anthropic_messages.append({
                    'role': msg['role'],
                    'content': msg['content']
                })
        
        # Make REST API call to Anthropic
        response = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            json={
                'model': 'claude-sonnet-4-5-20250929',
                'max_tokens': 500,
                'system': system_message or SYSTEM_PROMPT,
                'messages': anthropic_messages,
                'temperature': 0.7
            },
            timeout=30
        )
        
        # Check for errors
        response.raise_for_status()
        
        # Parse response
        response_data = response.json()
        ai_message = response_data['content'][0]['text']
        
        # Add AI response to history
        conversations[conversation_id].append({
            'role': 'assistant',
            'content': ai_message
        })
        
        return jsonify({
            'message': ai_message,
            'conversation_id': conversation_id
        })
    
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code if e.response else 500
        return jsonify({
            'error': f'API request failed: HTTP {status_code}',
            'status_code': status_code
        }), 500
    
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': 'Network error: Unable to connect to API'
        }), 500
    
    except Exception as e:
        return jsonify({
            'error': f'Server error: {str(e)}'
        }), 500

# Reset conversation endpoint (POST)
@app.route('/reset', methods=['POST'])
def reset():
    data = request.json or {}
    conversation_id = data.get('conversation_id', 'default')
    
    if conversation_id in conversations:
        del conversations[conversation_id]
    
    return jsonify({'status': 'reset', 'conversation_id': conversation_id})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
