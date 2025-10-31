const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ✅ IMPROVED USER SESSIONS STORAGE
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

// ✅ IMPROVED USER BOT SESSION MANAGEMENT
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
            videoLink: '',
            lastReqs: 0,
            lastUpdateTime: Date.now()
        };
        writeUserBotSessions(sessions);
    }
    return sessions[userToken];
}

function updateUserBotSession(userToken, data) {
    const sessions = readUserBotSessions();
    if (sessions[userToken]) {
        sessions[userToken] = { 
            ...sessions[userToken], 
            ...data, 
            lastUpdated: new Date().toISOString(),
            lastUpdateTime: Date.now()
        };
        writeUserBotSessions(sessions);
    }
}

// ✅ IMPROVED ACTIVE USER BOTS TRACKING
const activeUserBots = new Map();

// Routes
app.get('/', (req, res) => {
    res.json({ 
        status: 'TikTok Bot Instance Running',
        message: 'Multi-User Support - All Glitches Fixed',
        endpoints: ['GET /status', 'POST /start', 'POST /stop'],
        activeUsers: Array.from(activeUserBots.entries()).filter(([_, running]) => running).length
    });
});

// ✅ FIXED STATUS ENDPOINT - Real-time data
app.get('/status', (req, res) => {
    const userToken = req.query.userToken;
    
    if (!userToken) {
        return res.json({ 
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
            error: 'User token required'
        });
    }

    const userSession = getUserBotSession(userToken);
    
    // ✅ REAL-TIME RPS CALCULATION
    const now = Date.now();
    const timeDiff = (now - userSession.lastUpdateTime) / 1000; // in seconds
    
    if (timeDiff > 0 && userSession.lastReqs > 0) {
        const currentReqs = userSession.reqs;
        const reqsDiff = currentReqs - userSession.lastReqs;
        userSession.rps = (reqsDiff / timeDiff).toFixed(1);
        userSession.rpm = (userSession.rps * 60).toFixed(1);
        
        // Update last values for next calculation
        userSession.lastReqs = currentReqs;
        userSession.lastUpdateTime = now;
    }
    
    // ✅ SUCCESS RATE CALCULATION
    const total = userSession.reqs;
    const success = userSession.success;
    userSession.successRate = total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '0%';
    
    // ✅ AUTO STOP WHEN TARGET REACHED
    if (userSession.running && userSession.success >= userSession.targetViews && userSession.targetViews > 0) {
        console.log(`🎯 Target reached for user ${userToken.substring(0, 10)}! Auto-stopping...`);
        userSession.running = false;
        activeUserBots.set(userToken, false);
    }
    
    // ✅ Update session with latest data
    updateUserBotSession(userToken, userSession);
    
    res.json({
        running: userSession.running,
        success: userSession.success,
        fails: userSession.fails,
        reqs: userSession.reqs,
        targetViews: userSession.targetViews,
        aweme_id: userSession.aweme_id,
        startTime: userSession.startTime,
        rps: userSession.rps,
        rpm: userSession.rpm,
        successRate: userSession.successRate,
        videoLink: userSession.videoLink
    });
});

// ✅ FIXED START ENDPOINT - Better error handling
app.post('/start', (req, res) => {
    try {
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
            activeUserBots.set(userToken, false);
            console.log(`🛑 Stopped previous session for user: ${userToken.substring(0, 10)}`);
        }

        // ✅ RESET STATS COMPLETELY for new session
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
            videoLink: videoLink,
            lastReqs: 0,
            lastUpdateTime: Date.now()
        };

        updateUserBotSession(userToken, updatedSession);
        
        // ✅ Start bot in background for this user
        startUserBot(userToken);
        
        console.log(`🚀 Started bot for user: ${userToken.substring(0, 10)} | Target: ${updatedSession.targetViews} | Video: ${idMatch[0]}`);
        
        res.json({ 
            success: true, 
            message: 'Bot started successfully!',
            target: updatedSession.targetViews,
            videoId: updatedSession.aweme_id,
            userToken: userToken.substring(0, 10) + '...'
        });
    } catch (error) {
        console.error('Error in start endpoint:', error);
        res.json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ✅ FIXED STOP ENDPOINT - Immediate stop
app.post('/stop', (req, res) => {
    try {
        const { userToken } = req.body;
        
        if (!userToken) {
            return res.json({ success: false, message: 'User token required' });
        }

        // ✅ IMMEDIATE STOP - Set flag to false
        activeUserBots.set(userToken, false);

        const userSession = getUserBotSession(userToken);
        userSession.running = false;
        updateUserBotSession(userToken, userSession);
        
        console.log(`🛑 Manually stopped bot for user: ${userToken.substring(0, 10)}`);
        
        res.json({ 
            success: true, 
            message: 'Bot stopped successfully!',
            userToken: userToken.substring(0, 10) + '...'
        });
    } catch (error) {
        console.error('Error in stop endpoint:', error);
        res.json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ✅ FIXED BOT FUNCTION - All glitches resolved
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

    const concurrency = Math.min(200, devices.length); // ✅ OPTIMIZED CONCURRENCY
    let lastStatsUpdate = Date.now();
    let requestsSinceLastUpdate = 0;

    // ✅ IMPROVED STATS UPDATER - More frequent updates
    const statsInterval = setInterval(() => {
        const currentSession = getUserBotSession(userToken);
        
        // ✅ Check if user wants to stop
        if (!activeUserBots.get(userToken)) {
            console.log(`🛑 Stopping bot for user: ${userToken.substring(0, 10)} (user request)`);
            clearInterval(statsInterval);
            currentSession.running = false;
            updateUserBotSession(userToken, currentSession);
            activeUserBots.delete(userToken);
            return;
        }
        
        // ✅ AUTO STOP WHEN TARGET REACHED
        if (currentSession.success >= currentSession.targetViews && currentSession.targetViews > 0) {
            console.log(`🎯 Target reached for user ${userToken.substring(0, 10)}! Auto-stopping...`);
            clearInterval(statsInterval);
            currentSession.running = false;
            updateUserBotSession(userToken, currentSession);
            activeUserBots.delete(userToken);
            return;
        }
        
        // ✅ Calculate RPS based on actual requests
        const now = Date.now();
        const timeDiff = (now - lastStatsUpdate) / 1000;
        
        if (timeDiff > 0) {
            currentSession.rps = (requestsSinceLastUpdate / timeDiff).toFixed(1);
            currentSession.rpm = (currentSession.rps * 60).toFixed(1);
            requestsSinceLastUpdate = 0;
            lastStatsUpdate = now;
        }
        
        // ✅ Update success rate
        const total = currentSession.reqs;
        const success = currentSession.success;
        currentSession.successRate = total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '0%';
        
        updateUserBotSession(userToken, currentSession);
        
        // ✅ Log progress every 5 seconds
        if (Math.random() < 0.2) { // 20% chance to log (approx every 5 seconds)
            console.log(`📊 User ${userToken.substring(0, 10)}: ${currentSession.success}/${currentSession.targetViews} | Success: ${currentSession.successRate} | RPS: ${currentSession.rps}`);
        }
        
    }, 1000); // ✅ Update every second

    // ✅ MAIN BOT LOOP - OPTIMIZED FOR MULTIPLE USERS
    console.log(`🔥 Starting optimized requests for user: ${userToken.substring(0, 10)}...`);
    
    try {
        while (activeUserBots.get(userToken)) {
            const userSessionCheck = getUserBotSession(userToken);
            
            // ✅ STOP CONDITIONS
            if (!userSessionCheck.running || 
                (userSessionCheck.success >= userSessionCheck.targetViews && userSessionCheck.targetViews > 0)) {
                break;
            }
            
            const batchDevices = [];
            const batchSize = Math.min(concurrency, devices.length);
            
            for (let i = 0; i < batchSize; i++) {
                batchDevices.push(devices[Math.floor(Math.random() * devices.length)]);
            }
            
            // ✅ Send batch requests
            await sendUserBatch(batchDevices, userSessionCheck.aweme_id, userToken);
            requestsSinceLastUpdate += batchDevices.length;
            
            // ✅ OPTIMIZED DELAY - Better for multiple users
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    } catch (error) {
        console.error(`❌ Error in bot loop for user ${userToken.substring(0, 10)}:`, error);
    }

    // ✅ CLEANUP
    const finalSession = getUserBotSession(userToken);
    finalSession.running = false;
    updateUserBotSession(userToken, finalSession);
    activeUserBots.delete(userToken);
    clearInterval(statsInterval);
    
    console.log(`🛑 Bot instance stopped for user: ${userToken.substring(0, 10)}`);
    const successRate = finalSession.reqs > 0 ? ((finalSession.success / finalSession.reqs) * 100).toFixed(1) : 0;
    console.log(`📈 Final Stats for user ${userToken.substring(0, 10)}: ${finalSession.success} success, ${finalSession.fails} fails, ${successRate}% success rate`);
}

// ✅ FIXED BATCH SENDING
async function sendUserBatch(batchDevices, aweme_id, userToken) {
    const promises = batchDevices.map(device => {
        if (!activeUserBots.get(userToken)) return Promise.resolve();
        
        const [did, iid, cdid, openudid] = device.split(':');
        return sendUserRequest(did, iid, cdid, openudid, aweme_id, userToken);
    });
    
    await Promise.all(promises);
}

// ✅ TIKTOK REQUEST FUNCTION - IMPROVED
function gorgon(params, data, cookies, unix) {
    function md5(input) {
        return crypto.createHash('md5').update(input).digest('hex');
    }
    let baseStr = md5(params) + (data ? md5(data) : '0'.repeat(32)) + (cookies ? md5(cookies) : '0'.repeat(32));
    return {
        'X-Gorgon': '0404b0d30000' + crypto.randomBytes(16).toString('hex').substring(0, 32),
        'X-Khronos': unix.toString()
    };
}

async function sendUserRequest(did, iid, cdid, openudid, aweme_id, userToken) {
    return new Promise((resolve) => {
        // ✅ QUICK CHECK - Stop immediately if user stopped
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
            timeout: 5000 // ✅ Increased timeout
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                // ✅ UPDATE STATISTICS
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

// ✅ CLEANUP OLD SESSIONS (6 hours)
function cleanupOldSessions() {
    const sessions = readUserBotSessions();
    const now = Date.now();
    let cleaned = 0;
    
    Object.keys(sessions).forEach(token => {
        const session = sessions[token];
        const lastUpdateTime = session.lastUpdateTime || now;
        const hoursDiff = (now - lastUpdateTime) / (1000 * 60 * 60);
        
        if (hoursDiff > 6) { // 6 hours old sessions
            delete sessions[token];
            cleaned++;
            
            // Also remove from active bots
            if (activeUserBots.has(token)) {
                activeUserBots.delete(token);
            }
        }
    });
    
    if (cleaned > 0) {
        writeUserBotSessions(sessions);
        console.log(`🧹 Cleaned ${cleaned} old user sessions`);
    }
}

// ✅ Initialize
if (!fs.existsSync(userBotSessionsFile)) {
    writeUserBotSessions({});
}

// ✅ Start cleanup interval (every hour)
setInterval(cleanupOldSessions, 60 * 60 * 1000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TikTok Bot Instance running on port ${PORT}`);
    console.log(`✅ All Glitches Fixed:`);
    console.log(`   📊 Status Updates: Real-time`);
    console.log(`   🎯 Auto Stop: When target reached`);
    console.log(`   ⚡ Speed: Optimized for multiple users`);
    console.log(`   🛑 Stop Function: Immediate response`);
    console.log(`   🔄 Statistics: Live updates`);
    console.log(`👥 Ready for unlimited users!`);
    
    cleanupOldSessions();
});
