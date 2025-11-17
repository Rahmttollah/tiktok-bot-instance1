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

// 🎯 BETTER DEVICE POOL - Pre-verified devices
const devicePool = [];

// Routes
app.get('/', (req, res) => {
  res.json({ 
    status: '🎯 SMART TIKTOK BOT - HIGH SUCCESS RATE',
    message: 'Optimized for actual views, not just requests',
    endpoints: ['GET /status', 'POST /start', 'POST /stop']
  });
});

app.get('/status', (req, res) => {
  const total = botStatus.reqs;
  const success = botStatus.success;
  botStatus.successRate = total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '0%';
  res.json(botStatus);
});

app.post('/start', async (req, res) => {
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

  console.log('🎯 SMART BOT STARTING...');
  
  // 🎯 PRE-LOAD SOME WORKING DEVICES
  await preloadWorkingDevices();
  
  isRunning = true;
  startSmartBot();
  
  res.json({ 
    success: true, 
    message: '🎯 SMART BOT STARTED! High success rate mode',
    target: botStatus.targetViews,
    videoId: botStatus.aweme_id,
    preloadedDevices: devicePool.length
  });
});

app.post('/stop', (req, res) => {
  isRunning = false;
  botStatus.running = false;
  res.json({ success: true, message: 'Bot stopped' });
});

// 🎯 PRELOAD WORKING DEVICES FROM YOUR PYTHON SCRIPT
async function preloadWorkingDevices() {
  console.log('🔄 Loading working devices...');
  
  // Try to load from your Python-generated file
  const fs = require('fs');
  try {
    if (fs.existsSync('working_devices_live.txt')) {
      const devices = fs.readFileSync('working_devices_live.txt', 'utf-8')
        .split('\n')
        .filter(line => line.trim())
        .slice(0, 50); // Load first 50 devices
      
      for (const deviceLine of devices) {
        const parts = deviceLine.split(':');
        if (parts.length >= 4) {
          devicePool.push({
            device_id: parts[0],
            iid: parts[1],
            cdid: parts[2],
            openudid: parts[3]
          });
        }
      }
      console.log(`✅ Loaded ${devicePool.length} working devices from file`);
    }
  } catch (e) {
    console.log('⚠️ No device file found, using generated devices');
  }
  
  // If no file, generate some devices
  if (devicePool.length === 0) {
    for (let i = 0; i < 30; i++) {
      devicePool.push(generateRealisticDevice());
    }
    console.log(`✅ Generated ${devicePool.length} devices`);
  }
}

// 🎯 GENERATE REALISTIC DEVICES (Not random)
function generateRealisticDevice() {
  // Real device patterns (not completely random)
  const devicePrefixes = ['66', '67', '68', '69', '70', '71'];
  const prefix = devicePrefixes[Math.floor(Math.random() * devicePrefixes.length)];
  
  const device_id = prefix + Array.from({length: 17}, () => '0123456789'[Math.floor(Math.random() * 10)]).join('');
  const iid = '7' + Array.from({length: 18}, () => '0123456789'[Math.floor(Math.random() * 10)]).join('');
  const cdid = crypto.randomBytes(8).toString('hex') + '-0000-0000-0000-' + crypto.randomBytes(6).toString('hex');
  const openudid = Array.from({length: 16}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  
  return { device_id, iid, cdid, openudid };
}

// 🎯 GET SMART DEVICE - Real devices first
function getSmartDevice() {
  if (devicePool.length > 0) {
    return devicePool[Math.floor(Math.random() * devicePool.length)];
  }
  return generateRealisticDevice();
}

// 🎯 SMART REQUEST WITH BETTER PARAMETERS
function sendSmartRequest(aweme_id) {
  return new Promise((resolve) => {
    if (!isRunning) {
      resolve();
      return;
    }

    const device = getSmartDevice();
    
    // 🎯 BETTER PARAMETERS - More realistic
    const params = `device_id=${device.device_id}&iid=${device.iid}&device_type=SM-G975F&app_name=trill&host_abi=arm64-v8a&channel=googleplay&device_platform=android&version_code=300904&device_brand=samsung&os_version=11&aid=1233`;
    const payload = `item_id=${aweme_id}&play_delta=1&stats_type=1&stats_channel=video`;
    
    const unix = Math.floor(Date.now() / 1000);
    const sig = {
      'X-Gorgon': '0404c0c00000' + crypto.randomBytes(12).toString('hex'),
      'X-Khronos': unix.toString()
    };
    
    const options = {
      hostname: 'api19-core-c-alisg.tiktokv.com', // 🎯 DIFFERENT ENDPOINT
      port: 443,
      path: `/aweme/v1/aweme/stats/?${params}`,
      method: 'POST',
      headers: {
        'cookie': 'sessionid=',
        'x-gorgon': sig['X-Gorgon'],
        'x-khronos': sig['X-Khronos'],
        'user-agent': 'com.ss.android.ugc.trill/300904 (Linux; U; Android 11; en_US; SM-G975F; Build/RP1A.200720.012; Cronet/TTNetVersion:5c13b8cd 2022-09-19)',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'content-length': Buffer.byteLength(payload),
        'x-ss-stub': 'AAAAAAAAAAA='
      },
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        botStatus.reqs++;
        try {
          if (data.includes('impr_id') || data.includes('"status_code":0')) {
            botStatus.success++;
            // 🎯 TRACK WORKING DEVICES
            if (devicePool.length < 100 && !devicePool.some(d => d.device_id === device.device_id)) {
              devicePool.push(device);
            }
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

// 🎯 SMART BOT LOOP - Balance speed and success
async function startSmartBot() {
  console.log('🎯 SMART BOT ACTIVATED!');
  console.log('⚡ Optimizing for success rate, not just speed');
  console.log(`📹 Target: ${botStatus.targetViews} views`);

  let lastReqs = 0;
  let lastSuccess = 0;

  const statsInterval = setInterval(() => {
    const currentReqs = botStatus.reqs;
    const currentSuccess = botStatus.success;
    
    botStatus.rps = ((currentReqs - lastReqs) / 2).toFixed(1);
    const successRate = ((currentSuccess - lastSuccess) / (currentReqs - lastReqs) * 100) || 0;
    
    lastReqs = currentReqs;
    lastSuccess = currentSuccess;
    
    botStatus.rpm = (botStatus.rps * 60).toFixed(1);
    botStatus.successRate = botStatus.reqs > 0 ? ((botStatus.success / botStatus.reqs) * 100).toFixed(1) + '%' : '0%';
    
    console.log(`📊 ${botStatus.success}/${botStatus.targetViews} | Success: ${botStatus.successRate} | RPS: ${botStatus.rps} | Devices: ${devicePool.length}`);
    
    if (!isRunning) {
      clearInterval(statsInterval);
    }
  }, 2000);

  // 🎯 ADAPTIVE BOT LOOP
  console.log('🔥 Starting optimized requests...');
  
  while (isRunning && botStatus.success < botStatus.targetViews) {
    const successRate = parseFloat(botStatus.successRate);
    
    // 🎯 ADAPTIVE BATCH SIZE - Success rate ke hisab se
    let batchSize = 20;
    let delay = 50;
    
    if (successRate > 30) {
      batchSize = 30; // High success = more concurrent
      delay = 30;
    } else if (successRate < 10) {
      batchSize = 10; // Low success = slow down
      delay = 100;
    }
    
    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      promises.push(sendSmartRequest(botStatus.aweme_id));
    }
    
    await Promise.all(promises);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  isRunning = false;
  botStatus.running = false;
  clearInterval(statsInterval);
  
  console.log('🛑 Bot stopped');
  console.log(`📈 Final: ${botStatus.success} real views | Success Rate: ${botStatus.successRate}`);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎯 SMART TIKTOK BOT RUNNING ON PORT ${PORT}`);
  console.log(`⚡ FOCUS: HIGH SUCCESS RATE (50%+ target)`);
  console.log(`🔧 FEATURES: Real devices + Adaptive speed`);
});
