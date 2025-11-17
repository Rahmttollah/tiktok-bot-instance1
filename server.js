const express = require('express');
const crypto = require('crypto');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Global variables
let botStatus = {
  running: false,
  success: 0,
  fails: 0,
  reqs: 0,
  targetViews: 0,
  aweme_id: '',
  startTime: null,
  rps: 0,
  rpm: 0,
  successRate: '0%'
};

let isRunning = false;

// 🚀 ULTRA FAST ROUTES
app.get('/', (req, res) => {
  res.json({ 
    status: '🔥 ULTRA FAST TIKTOK BOT',
    message: 'MAXIMUM SPEED - NO VERIFICATION DELAYS',
    endpoints: ['GET /status', 'POST /start', 'POST /stop']
  });
});

app.get('/status', (req, res) => {
  const total = botStatus.reqs;
  const success = botStatus.success;
  botStatus.successRate = total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '0%';
  res.json(botStatus);
});

app.post('/start', (req, res) => {
  const { targetViews, videoLink } = req.body;
  
  if (!videoLink) {
    return res.json({ success: false, message: 'Video link required' });
  }

  const idMatch = videoLink.match(/\d{18,19}/g);
  if (!idMatch) {
    return res.json({ success: false, message: 'Invalid TikTok video link' });
  }

  isRunning = false;
  
  // Reset stats
  botStatus = {
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

  console.log('🚀 ULTRA FAST BOT STARTING...');
  
  isRunning = true;
  startUltraFastBot();
  
  res.json({ 
    success: true, 
    message: '🔥 ULTRA FAST BOT STARTED! 50+ RPS',
    target: botStatus.targetViews,
    videoId: botStatus.aweme_id
  });
});

app.post('/stop', (req, res) => {
  isRunning = false;
  botStatus.running = false;
  res.json({ success: true, message: 'Bot stopped' });
});

// 🚀 ULTRA FAST DEVICE GENERATION
function generateUltraDevice() {
  const device_id = Array.from({length: 19}, () => '0123456789'[Math.floor(Math.random() * 10)]).join('');
  const iid = Array.from({length: 19}, () => '0123456789'[Math.floor(Math.random() * 10)]).join('');
  const cdid = crypto.randomBytes(16).toString('hex');
  const openudid = Array.from({length: 16}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  
  return { device_id, iid, cdid, openudid };
}

// 🚀 ULTRA FAST REQUEST
function sendUltraRequest(aweme_id) {
  return new Promise((resolve) => {
    if (!isRunning) {
      resolve();
      return;
    }

    // 🚀 INSTANT DEVICE GENERATION - No storage, no verification
    const device = generateUltraDevice();
    
    const params = `device_id=${device.device_id}&iid=${device.iid}&device_type=SM-G973N&app_name=musically_go&host_abi=armeabi-v7a&channel=googleplay&device_platform=android&version_code=160904&device_brand=samsung&os_version=9&aid=1340`;
    const payload = `item_id=${aweme_id}&play_delta=1`;
    
    const unix = Math.floor(Date.now() / 1000);
    const sig = {
      'X-Gorgon': '0404b0d30000' + crypto.randomBytes(12).toString('hex'),
      'X-Khronos': unix.toString()
    };
    
    const options = {
      hostname: 'api16-va.tiktokv.com',
      port: 443,
      path: `/aweme/v1/aweme/stats/?${params}`,
      method: 'POST',
      headers: {
        'cookie': 'sessionid=' + crypto.randomBytes(8).toString('hex'),
        'x-gorgon': sig['X-Gorgon'],
        'x-khronos': sig['X-Khronos'],
        'user-agent': 'okhttp/3.10.0.1',
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': Buffer.byteLength(payload)
      },
      timeout: 3000  // 🚀 SHORT TIMEOUT - Faster failures
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        botStatus.reqs++;
        try {
          if (data.includes('impr_id')) {
            botStatus.success++;
          } else {
            botStatus.fails++;
          }
        } catch (e) {
          botStatus.fails++;
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      botStatus.fails++;
      botStatus.reqs++;
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      botStatus.fails++;
      botStatus.reqs++;
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

// 🚀 ULTRA FAST BOT LOOP
async function startUltraFastBot() {
  console.log('🔥 ULTRA FAST BOT ACTIVATED!');
  console.log('🎯 MAXIMUM SPEED - NO DELAYS');
  console.log(`📹 Target: ${botStatus.targetViews} views`);

  let lastReqs = 0;
  let consecutiveFails = 0;

  const statsInterval = setInterval(() => {
    botStatus.rps = ((botStatus.reqs - lastReqs) / 1).toFixed(1);
    botStatus.rpm = (botStatus.rps * 60).toFixed(1);
    lastReqs = botStatus.reqs;
    
    const total = botStatus.reqs;
    const success = botStatus.success;
    botStatus.successRate = total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '0%';
    
    console.log(`📊 ${botStatus.success}/${botStatus.targetViews} | Success: ${botStatus.successRate} | RPS: ${botStatus.rps}`);
    
    if (!isRunning) {
      clearInterval(statsInterval);
    }
  }, 1000);

  // 🚀 ULTRA FAST LOOP - MAXIMUM CONCURRENCY
  console.log('🔥 Starting 100+ concurrent requests...');
  
  while (isRunning && botStatus.success < botStatus.targetViews) {
    const batchSize = 100; // 🚀 HIGH CONCURRENCY
    const promises = [];
    
    for (let i = 0; i < batchSize; i++) {
      promises.push(sendUltraRequest(botStatus.aweme_id));
    }
    
    await Promise.all(promises);
    
    // 🚀 MINIMAL DELAY - 10ms only
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Adaptive speed based on success rate
    const successRate = parseFloat(botStatus.successRate);
    if (successRate < 5) {
      consecutiveFails++;
      if (consecutiveFails > 10) {
        console.log('⚠️ Low success rate, reducing speed...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      consecutiveFails = 0;
    }
  }

  isRunning = false;
  botStatus.running = false;
  clearInterval(statsInterval);
  
  console.log('🛑 Bot stopped');
  console.log(`📈 Final: ${botStatus.success} views in ${((Date.now() - botStatus.startTime) / 1000).toFixed(1)}s`);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 ULTRA FAST TIKTOK BOT RUNNING ON PORT ${PORT}`);
  console.log(`🎯 TARGET: 50+ RPS | 3000+ RPM`);
  console.log(`🚀 NO VERIFICATION - PURE SPEED`);
});
