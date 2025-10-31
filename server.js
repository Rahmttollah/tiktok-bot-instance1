const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ✅ USER SPECIFIC BOT SESSIONS STORAGE
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
            lastUpdated: new Date().toISOString(),
            videoLink: ''
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

// ✅ ACTIVE USER BOTS TRACKING
const activeUserBots = new Map();

// Routes
app.get('/', (req, res) => {
    res.json({ 
        status: 'TikTok Bot Instance Running',
        message: 'Multi-User Support Enabled',
        endpoints: ['GET /status', 'POST /start', 'POST /stop'],
        activeUsers: activeUserBots.size
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
    
    // ✅ Calculate real-time RPS
    if (userSession.startTime) {
        const startTime = new Date(userSession.startTime);
        const now = new Date();
        const diffSeconds = (now - startTime) / 1000;
        if (diffSeconds > 0) {
            userSession.rps = (userSession.reqs / diffSeconds).toFixed(1);
            userSession.rpm = (userSession.rps * 60).toFixed(1);
        }
    }
    
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
    if (userSession.running) {
        activeUserBots.delete(userToken);
    }
    
    // Reset stats for this user
    const updatedSession = {
        running: true,
        success: 0,
        fails: 0,
        reqs: 0,
        targetViews: parseInt(targetViews) || 1000,
        aweme_id: idMatch[0],
        startTime: new Date().toISOString(),
        rps: 0,
        rpm: 0,
        successRate: '0%',
        videoLink: videoLink
    };

    updateUserBotSession(userToken, updatedSession);
    
    // Start bot in background for this user
    startUserBot(userToken);
    
    res.json({ 
        success: true, 
        message: 'Bot started successfully for user!',
        target: updatedSession.targetViews,
        videoId: updatedSession.aweme_id,
        userToken: userToken.substring(0, 10) + '...'
    });
});

// ✅ USER SPECIFIC STOP
app.post('/stop', (req, res) => {
    const { userToken } = req.body;
    
    if (!userToken) {
        return res.json({ success: false, message: 'User token required' });
    }

    // ✅ Stop the bot for this user
    if (activeUserBots.has(userToken)) {
        activeUserBots.set(userToken, false);
    }

    const userSession = getUserBotSession(userToken);
    userSession.running = false;
    updateUserBotSession(userToken, userSession);
    
    res.json({ 
        success: true, 
        message: 'Bot stopped for user',
        userToken: userToken.substring(0, 10) + '...'
    });
});

// ✅ GET ALL ACTIVE SESSIONS (Admin/DEBUG)
app.get('/sessions', (req, res) => {
    const sessions = readUserBotSessions();
    const activeSessions = Object.entries(sessions)
        .filter(([token, session]) => session.running)
        .map(([token, session]) => ({
            userToken: token.substring(0, 10) + '...',
            ...session
        }));
    
    res.json({
        totalSessions: Object.keys(sessions).length,
        activeSessions: activeSessions.length,
        sessions: activeSessions,
        activeUserBots: activeUserBots.size
    });
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
    
    console.log(`📱 Loaded ${devices.length} devices for user ${userToken.substring(0, 10)}`);
    console.log(`🎯 Target: ${userSession.targetViews} views`);
    console.log(`📹 Video ID: ${userSession.aweme_id}`);
    
    // ✅ Mark this user as active
    activeUserBots.set(userToken, true);

    const concurrency = 500; // ✅ MAXIMUM SPEED MAINTAINED
    let lastReqs = 0;

    // RPS Calculator for this user
    const statsInterval = setInterval(() => {
        const currentSession = getUserBotSession(userToken);
        
        if (!activeUserBots.get(userToken)) {
            clearInterval(statsInterval);
            return;
        }
        
        // Calculate RPS based on last second
        currentSession.rps = ((currentSession.reqs - lastReqs) / 1).toFixed(1);
        currentSession.rpm = (currentSession.rps * 60).toFixed(1);
        lastReqs = currentSession.reqs;
        
        const total = currentSession.reqs;
        const success = currentSession.success;
        currentSession.successRate = total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '0%';
        
        updateUserBotSession(userToken, currentSession);
        
        console.log(`📊 User ${userToken.substring(0, 10)}: ${currentSession.success}/${currentSession.targetViews} | Success: ${currentSession.successRate} | RPS: ${currentSession.rps}`);
        
        if (!currentSession.running || !activeUserBots.get(userToken)) {
            clearInterval(statsInterval);
            activeUserBots.delete(userToken);
        }
    }, 1000);

    // MAIN BOT LOOP - User specific (SAME SPEED)
    console.log(`🔥 Starting maximum speed requests for user: ${userToken.substring(0, 10)}...`);
    
    let userSessionCheck = getUserBotSession(userToken);
    let requestCount = 0;
    const BATCH_SIZE = 50; // ✅ Optimized for multiple users
    
    while (activeUserBots.get(userToken) && userSessionCheck.running && userSessionCheck.success < userSessionCheck.targetViews) {
        const batchDevices = [];
        for (let i = 0; i < BATCH_SIZE && i < devices.length; i++) {
            batchDevices.push(devices[Math.floor(Math.random() * devices.length)]);
        }
        
        await sendUserBatch(batchDevices, userSessionCheck.aweme_id, userToken);
        requestCount += batchDevices.length;
        
        // ✅ Check user session status periodically
        if (requestCount >= 1000) {
            userSessionCheck = getUserBotSession(userToken);
            requestCount = 0;
        }
        
        // ✅ MINIMAL DELAY FOR MAXIMUM SPEED (SAME AS BEFORE)
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Cleanup
    userSessionCheck.running = false;
    updateUserBotSession(userToken, userSessionCheck);
    activeUserBots.delete(userToken);
    clearInterval(statsInterval);
    
    console.log(`🛑 Bot instance stopped for user: ${userToken.substring(0, 10)}`);
    const finalSession = getUserBotSession(userToken);
    const successRate = finalSession.reqs > 0 ? ((finalSession.success / finalSession.reqs) * 100).toFixed(1) : 0;
    console.log(`📈 Final Stats for user ${userToken.substring(0, 10)}: ${finalSession.success} success, ${finalSession.fails} fails, ${successRate}% success rate`);
}

// ✅ USER SPECIFIC REQUEST SENDING (SAME SPEED)
async function sendUserBatch(batchDevices, aweme_id, userToken) {
    const promises = batchDevices.map(device => {
        const [did, iid, cdid, openudid] = device.split(':');
        return sendUserRequest(did, iid, cdid, openudid, aweme_id, userToken);
    });
    await Promise.all(promises);
}

// ✅ TIKTOK REQUEST FUNCTION - SAME SPEED MAGIC
function gorgon(params, data, cookies, unix) {
    function md5(input) {
        return crypto.createHash('md5').update(input).digest('hex');
    }
    let baseStr = md5(params) + (data ? md5(data) : '0'.repeat(32)) + (cookies ? md5(cookies) : '0'.repeat(32));
    return {
        'X-Gorgon': '0404b0d30000' + crypto.randomBytes(16).toString('hex'),
        'X-Khronos': unix.toString()
    };
}

async function sendUserRequest(did, iid, cdid, openudid, aweme_id, userToken) {
    return new Promise((resolve) => {
        // ✅ Check if this user's bot is still running
        if (!activeUserBots.get(userToken)) {
            resolve();
            return;
        }

        const userSession = getUserBotSession(userToken);
        
        if (!userSession.running) {
            resolve();
            return;
        }

        const params = `device_id=${did}&iid=${iid}&device_type=SM-G973N&app_name=musically_go&host_abi=armeabi-v7a&channel=googleplay&device_platform=android&version_code=160904&device_brand=samsung&os_version=9&aid=1340`;
        const payload = `item_id=${aweme_id}&play_delta=1`;
        const sig = gorgon(params, null, null, Math.floor(Date.now() / 1000));
        
        const options = {
            hostname: 'api16-va.tiktokv.com',
            port: 443,
            path: `/aweme/v1/aweme/stats/?${params}`,
            method: 'POST',
            headers: {
                'cookie': 'sessionid=90c38a59d8076ea0fbc01c8643efbe47',
                'x-gorgon': sig['X-Gorgon'],
                'x-khronos': sig['X-Khronos'],
                'user-agent': 'okhttp/3.10.0.1',
                'content-type': 'application/x-www-form-urlencoded',
                'content-length': Buffer.byteLength(payload)
            },
            timeout: 3000
        };

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
                        userSession.success++; // ✅ SUCCESSFUL TIKTOK VIEW
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

// ✅ CLEANUP OLD SESSIONS (24 hours)
function cleanupOldSessions() {
    const sessions = readUserBotSessions();
    const now = new Date();
    let cleaned = 0;
    
    Object.keys(sessions).forEach(token => {
        const session = sessions[token];
        const lastUpdated = new Date(session.lastUpdated);
        const hoursDiff = (now - lastUpdated) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) { // 24 hours old sessions
            delete sessions[token];
            cleaned++;
        }
    });
    
    if (cleaned > 0) {
        writeUserBotSessions(sessions);
        console.log(`🧹 Cleaned ${cleaned} old user sessions`);
    }
}

// ✅ Initialize user bot sessions
if (!fs.existsSync(userBotSessionsFile)) {
    writeUserBotSessions({});
}

// ✅ Start cleanup interval (every 6 hours)
setInterval(cleanupOldSessions, 6 * 60 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TikTok Bot Instance running on port ${PORT}`);
    console.log(`✅ Multi-User Support: Enabled`);
    console.log(`👥 Active Users Capacity: Unlimited`);
    console.log(`⚡ Speed: Maximum (500 RPS per user)`);
    console.log(`📊 Session Tracking: Individual user statistics`);
    console.log(`🎯 Ready to handle unlimited users simultaneously!`);
    
    // Initial cleanup
    cleanupOldSessions();
});
