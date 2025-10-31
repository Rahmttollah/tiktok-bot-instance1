const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

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

// Global variables for bot control
let activeUserSessions = new Set();

// Routes
app.get('/', (req, res) => {
    res.json({ 
        status: 'TikTok Bot Instance Running',
        message: 'Ready to receive commands from main controller',
        endpoints: ['GET /status', 'POST /start', 'POST /stop'],
        activeUsers: activeUserSessions.size
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
    
    // Add user to active sessions
    activeUserSessions.add(userToken);
    
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
    
    // Remove user from active sessions
    activeUserSessions.delete(userToken);
    
    res.json({ success: true, message: 'Bot stopped for user' });
});

// Bot functions - YAHI REAL TIKTOK VIEWS KA MAGIC HAI
function gorgon(params, data, cookies, unix) {
    function md5(input) {
        return crypto.createHash('md5').update(input).digest('hex');
    }
    let baseStr = md5(params) + (data ? md5(data) : '0'.repeat(32)) + (cookies ? md5(cookies) : '0'.repeat(32));
    return {
        'X-Gorgon': '0404b0d300000000000000000000000000000000',
        'X-Khronos': unix.toString()
    };
}

function sendRequest(did, iid, cdid, openudid, aweme_id) {
    return new Promise((resolve) => {
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
                resolve({ success: true, data: data });
            });
        });

        req.on('error', (e) => {
            resolve({ success: false, error: e.message });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, error: 'timeout' });
        });

        req.write(payload);
        req.end();
    });
}

async function sendBatch(batchDevices, aweme_id) {
    const promises = batchDevices.map(device => {
        const [did, iid, cdid, openudid] = device.split(':');
        return sendRequest(did, iid, cdid, openudid, aweme_id);
    });
    return await Promise.all(promises);
}

// ✅ USER SPECIFIC BOT LOOP
async function startUserBot(userToken) {
    console.log(`🚀 Starting TikTok Bot for user: ${userToken.substring(0, 10)}...`);
    
    const devices = fs.existsSync('devices.txt') ? 
        fs.readFileSync('devices.txt', 'utf-8').split('\n').filter(Boolean) : [];
    
    if (devices.length === 0) {
        console.log('❌ No devices found!');
        updateUserBotSession(userToken, { running: false });
        activeUserSessions.delete(userToken);
        return;
    }

    const userSession = getUserBotSession(userToken);
    
    console.log(`📱 Loaded ${devices.length} devices for user ${userToken.substring(0, 10)}`);
    console.log(`🎯 Target: ${userSession.targetViews} views`);
    console.log(`📹 Video ID: ${userSession.aweme_id}`);

    const concurrency = 500; // MAXIMUM SPEED - SAME FOR ALL USERS
    let lastReqs = 0;

    // RPS Calculator for this user
    const statsInterval = setInterval(() => {
        const currentSession = getUserBotSession(userToken);
        if (!currentSession.running) {
            clearInterval(statsInterval);
            return;
        }
        
        currentSession.rps = ((currentSession.reqs - lastReqs) / 1).toFixed(1);
        currentSession.rpm = (currentSession.rps * 60).toFixed(1);
        lastReqs = currentSession.reqs;
        
        const total = currentSession.reqs;
        const success = currentSession.success;
        currentSession.successRate = total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '0%';
        
        updateUserBotSession(userToken, currentSession);
        
        console.log(`📊 User ${userToken.substring(0, 10)}: ${currentSession.success}/${currentSession.targetViews} | Success Rate: ${currentSession.successRate} | RPS: ${currentSession.rps}`);
        
    }, 1000);

    // MAIN BOT LOOP - User specific
    console.log(`🔥 Starting maximum speed requests for user: ${userToken.substring(0, 10)}...`);
    
    let userSessionCheck = getUserBotSession(userToken);
    
    while (userSessionCheck.running && userSessionCheck.success < userSessionCheck.targetViews) {
        const batchDevices = [];
        for (let i = 0; i < concurrency && i < devices.length; i++) {
            batchDevices.push(devices[Math.floor(Math.random() * devices.length)]);
        }
        
        const results = await sendBatch(batchDevices, userSessionCheck.aweme_id);
        
        // ✅ Update user specific stats
        let batchSuccess = 0;
        let batchFails = 0;
        
        results.forEach(result => {
            if (result.success) {
                try {
                    const jsonData = JSON.parse(result.data);
                    if (jsonData && jsonData.log_pb && jsonData.log_pb.impr_id) {
                        batchSuccess++;
                    } else {
                        batchFails++;
                    }
                } catch (e) {
                    batchFails++;
                }
            } else {
                batchFails++;
            }
        });
        
        userSessionCheck.success += batchSuccess;
        userSessionCheck.fails += batchFails;
        userSessionCheck.reqs += results.length;
        
        updateUserBotSession(userToken, userSessionCheck);
        
        // Check user session status
        userSessionCheck = getUserBotSession(userToken);
        
        // MINIMAL DELAY FOR MAXIMUM SPEED - SAME FOR ALL USERS
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Cleanup
    userSessionCheck.running = false;
    updateUserBotSession(userToken, userSessionCheck);
    activeUserSessions.delete(userToken);
    clearInterval(statsInterval);
    
    console.log(`🛑 Bot instance stopped for user: ${userToken.substring(0, 10)}`);
    const finalSession = getUserBotSession(userToken);
    const successRate = finalSession.reqs > 0 ? ((finalSession.success / finalSession.reqs) * 100).toFixed(1) : 0;
    console.log(`📈 Final Stats for user ${userToken.substring(0, 10)}: ${finalSession.success} success, ${finalSession.fails} fails, ${successRate}% success rate`);
}

// ✅ Clean up inactive sessions periodically
setInterval(() => {
    const sessions = readUserBotSessions();
    const now = new Date();
    let cleaned = 0;
    
    Object.keys(sessions).forEach(userToken => {
        const session = sessions[userToken];
        const lastUpdated = new Date(session.lastUpdated);
        const diffMinutes = (now - lastUpdated) / (1000 * 60);
        
        // Remove sessions inactive for more than 1 hour
        if (diffMinutes > 60 && !session.running) {
            delete sessions[userToken];
            activeUserSessions.delete(userToken);
            cleaned++;
        }
    });
    
    if (cleaned > 0) {
        writeUserBotSessions(sessions);
        console.log(`🧹 Cleaned ${cleaned} inactive user sessions`);
    }
}, 30 * 60 * 1000); // Check every 30 minutes

// Initialize user bot sessions
if (!fs.existsSync(userBotSessionsFile)) {
    writeUserBotSessions({});
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TikTok Bot Instance running on port ${PORT}`);
    console.log(`✅ Multi-User Support: Enabled`);
    console.log(`🔥 Maximum Speed: 500 RPS per user`);
    console.log(`👥 Ready for unlimited users simultaneously!`);
    console.log(`📊 Active Users: ${activeUserSessions.size}`);
});
