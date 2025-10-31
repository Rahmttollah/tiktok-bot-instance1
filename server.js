const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ✅ USER SPECIFIC BOT SESSIONS
const userBotSessionsFile = path.join(__dirname, 'user-bot-sessions.json');

function readUserBotSessions() {
    try {
        if (fs.existsSync(userBotSessionsFile)) {
            return JSON.parse(fs.readFileSync(userBotSessionsFile, 'utf8'));
        }
    } catch (error) {
        console.log('Error reading user bot sessions:', error);
    }
    return {};
}

function writeUserBotSessions(sessions) {
    try {
        fs.writeFileSync(userBotSessionsFile, JSON.stringify(sessions, null, 2));
        return true;
    } catch (error) {
        console.log('Error writing user bot sessions:', error);
        return false;
    }
}

// ✅ GET USER BOT SESSION
function getUserBotSession(userToken) {
    const sessions = readUserBotSessions();
    if (!sessions[userToken]) {
        sessions[userToken] = {
            running: false,
            success: 0,
            fails: 0,
            reqs: 0,
            targetViews: 0,
            aweme_id: '',
            startTime: null,
            rps: 0,
            rpm: 0,
            successRate: '0%',
            lastUpdated: new Date().toISOString()
        };
        writeUserBotSessions(sessions);
    }
    return sessions[userToken];
}

function updateUserBotSession(userToken, data) {
    const sessions = readUserBotSessions();
    if (sessions[userToken]) {
        sessions[userToken] = { ...sessions[userToken], ...data, lastUpdated: new Date().toISOString() };
        writeUserBotSessions(sessions);
    }
}

// Routes
app.get('/', (req, res) => {
    res.json({ 
        status: 'TikTok Bot Instance Running',
        message: 'Ready to receive commands from main controller',
        endpoints: ['GET /status', 'POST /start', 'POST /stop']
    });
});

// ✅ USER SPECIFIC STATUS
app.get('/status', (req, res) => {
    const userToken = req.query.userToken;
    
    if (!userToken) {
        return res.json({ success: false, message: 'User token required' });
    }

    const userSession = getUserBotSession(userToken);
    const total = userSession.reqs;
    const success = userSession.success;
    userSession.successRate = total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '0%';
    
    // ✅ Update session
    updateUserBotSession(userToken, userSession);
    
    res.json(userSession);
});

// ✅ USER SPECIFIC START
app.post('/start', (req, res) => {
    const { targetViews, videoLink, mode, userToken } = req.body;
    
    if (!userToken) {
        return res.json({ success: false, message: 'User token required' });
    }

    if (!videoLink) {
        return res.json({ success: false, message: 'Video link required' });
    }

    const idMatch = videoLink.match(/\d{18,19}/g);
    if (!idMatch) {
        return res.json({ success: false, message: 'Invalid TikTok video link' });
    }

    // ✅ Get user session
    const userSession = getUserBotSession(userToken);
    
    // Stop previous bot if running for this user
    userSession.running = false;
    
    // Reset stats for this user
    const updatedSession = {
        running: true,
        success: 0,
        fails: 0,
        reqs: 0,
        targetViews: parseInt(targetViews) || 1000,
        aweme_id: idMatch[0],
        startTime: new Date(),
        rps: 0,
        rpm: 0,
        successRate: '0%'
    };

    updateUserBotSession(userToken, updatedSession);
    
    // Start bot in background for this user
    startUserBot(userToken);
    
    res.json({ 
        success: true, 
        message: 'Bot started successfully for user!',
        target: updatedSession.targetViews,
        videoId: updatedSession.aweme_id
    });
});

// ✅ USER SPECIFIC STOP
app.post('/stop', (req, res) => {
    const { userToken } = req.body;
    
    if (!userToken) {
        return res.json({ success: false, message: 'User token required' });
    }

    const userSession = getUserBotSession(userToken);
    userSession.running = false;
    updateUserBotSession(userToken, userSession);
    
    res.json({ success: true, message: 'Bot stopped for user' });
});

// ✅ BOT FUNCTIONS - USER SPECIFIC
async function startUserBot(userToken) {
    console.log(`🚀 Starting TikTok Bot for user: ${userToken.substring(0, 10)}...`);
    
    const devices = fs.existsSync('devices.txt') ? 
        fs.readFileSync('devices.txt', 'utf-8').split('\n').filter(Boolean) : [];
    
    if (devices.length === 0) {
        console.log('❌ No devices found!');
        updateUserBotSession(userToken, { running: false });
        return;
    }

    const userSession = getUserBotSession(userToken);
    
    console.log(`📱 Loaded ${devices.length} devices for user`);
    console.log(`🎯 Target: ${userSession.targetViews} views`);
    console.log(`📹 Video ID: ${userSession.aweme_id}`);

    const concurrency = 500;
    let lastReqs = 0;

    // RPS Calculator for this user
    const statsInterval = setInterval(() => {
        const currentSession = getUserBotSession(userToken);
        currentSession.rps = ((currentSession.reqs - lastReqs) / 1).toFixed(1);
        currentSession.rpm = (currentSession.rps * 60).toFixed(1);
        lastReqs = currentSession.reqs;
        
        const total = currentSession.reqs;
        const success = currentSession.success;
        currentSession.successRate = total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '0%';
        
        updateUserBotSession(userToken, currentSession);
        
        console.log(`📊 User ${userToken.substring(0, 10)}: ${currentSession.success}/${currentSession.targetViews} | Success Rate: ${currentSession.successRate} | RPS: ${currentSession.rps}`);
        
        if (!currentSession.running) {
            clearInterval(statsInterval);
        }
    }, 1000);

    // MAIN BOT LOOP - User specific
    console.log(`🔥 Starting maximum speed requests for user: ${userToken.substring(0, 10)}...`);
    
    let userSessionCheck = getUserBotSession(userToken);
    
    while (userSessionCheck.running && userSessionCheck.success < userSessionCheck.targetViews) {
        const batchDevices = [];
        for (let i = 0; i < concurrency && i < devices.length; i++) {
            batchDevices.push(devices[Math.floor(Math.random() * devices.length)]);
        }
        
        await sendUserBatch(batchDevices, userSessionCheck.aweme_id, userToken);
        
        // Check user session status
        userSessionCheck = getUserBotSession(userToken);
        
        // MINIMAL DELAY FOR MAXIMUM SPEED
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Cleanup
    userSessionCheck.running = false;
    updateUserBotSession(userToken, userSessionCheck);
    clearInterval(statsInterval);
    
    console.log(`🛑 Bot instance stopped for user: ${userToken.substring(0, 10)}`);
    const finalSession = getUserBotSession(userToken);
    const successRate = finalSession.reqs > 0 ? ((finalSession.success / finalSession.reqs) * 100).toFixed(1) : 0;
    console.log(`📈 Final Stats for user: ${finalSession.success} success, ${finalSession.fails} fails, ${successRate}% success rate`);
}

// ✅ USER SPECIFIC REQUEST SENDING
async function sendUserBatch(batchDevices, aweme_id, userToken) {
    const promises = batchDevices.map(device => {
        const [did, iid, cdid, openudid] = device.split(':');
        return sendUserRequest(did, iid, cdid, openudid, aweme_id, userToken);
    });
    await Promise.all(promises);
}

async function sendUserRequest(did, iid, cdid, openudid, aweme_id, userToken) {
    return new Promise((resolve) => {
        const userSession = getUserBotSession(userToken);
        
        if (!userSession.running) {
            resolve();
            return;
        }

        // ... existing gorgon and request code ...

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                // ✅ Update user specific stats
                userSession.reqs++;
                try {
                    const jsonData = JSON.parse(data);
                    if (jsonData && jsonData.log_pb && jsonData.log_pb.impr_id) {
                        userSession.success++;
                    } else {
                        userSession.fails++;
                    }
                } catch (e) {
                    userSession.fails++;
                }
                updateUserBotSession(userToken, userSession);
                resolve();
            });
        });

        req.on('error', (e) => {
            userSession.fails++;
            userSession.reqs++;
            updateUserBotSession(userToken, userSession);
            resolve();
        });

        req.on('timeout', () => {
            req.destroy();
            userSession.fails++;
            userSession.reqs++;
            updateUserBotSession(userToken, userSession);
            resolve();
        });

        req.write(payload);
        req.end();
    });
}

// Initialize user bot sessions
if (!fs.existsSync(userBotSessionsFile)) {
    writeUserBotSessions({});
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TikTok Bot Instance running on port ${PORT}`);
    console.log(`✅ Multi-User Support: Enabled`);
    console.log(`🎯 Ready to handle multiple users simultaneously!`);
});
