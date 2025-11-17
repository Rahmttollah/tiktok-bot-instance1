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
  successRate: '0%',
  verifiedDevices: 0,
  totalDevicesTested: 0,
  backgroundVerification: true
};

let isRunning = false;
let verifiedDevices = [];
let temporaryDevices = [];
let backgroundVerificationActive = false;

// 🆕 VERIFY DEVICE FUNCTION - Ye missing tha
async function verifyDevice(device) {
  return new Promise((resolve) => {
    const { device_id, iid, cdid, openudid } = device;
    
    // Test parameters with REAL TikTok API
    const test_aweme_id = "7304597098286359854"; // Test video ID
    const params = `device_id=${device_id}&iid=${iid}&device_type=SM-G973N&app_name=musically_go&host_abi=armeabi-v7a&channel=googleplay&device_platform=android&version_code=160904&device_brand=samsung&os_version=9&aid=1340`;
    const payload = `item_id=${test_aweme_id}&play_delta=1`;
    
    const unix = Math.floor(Date.now() / 1000);
    const sig = generateGorgon(params, payload, null, unix);
    
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
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        botStatus.totalDevicesTested++;
        try {
          const jsonData = JSON.parse(data);
          // ✅ REAL TIKTOK VERIFICATION
          if (jsonData && jsonData.log_pb && jsonData.log_pb.impr_id) {
            console.log(`✅ DEVICE VERIFIED: ${device_id.substring(0,10)}...`);
            resolve(true);
          } else {
            console.log(`❌ DEVICE FAILED: ${device_id.substring(0,10)}...`);
            resolve(false);
          }
        } catch (e) {
          console.log(`❌ DEVICE ERROR: ${device_id.substring(0,10)}...`);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      botStatus.totalDevicesTested++;
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      botStatus.totalDevicesTested++;
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

// Routes
app.get('/', (req, res) => {
  res.json({ 
    status: '🎯 NON-STOP TIKTOK BOT',
    message: 'Instant start + Background verification',
    endpoints: ['GET /status', 'POST /start', 'POST /stop']
  });
});

app.get('/status', (req, res) => {
  const total = botStatus.reqs;
  const success = botStatus.success;
  botStatus.successRate = total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '0%';
  res.json(botStatus);
});

app.post('/stop', (req, res) => {
  isRunning = false;
  botStatus.running = false;
  backgroundVerificationActive = false;
  res.json({ success: true, message: 'Bot stopped' });
});

// 🆕 INSTANT START - NO INITIAL VERIFICATION
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
  backgroundVerificationActive = false;
  
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
    successRate: '0%',
    verifiedDevices: 0,
    totalDevicesTested: 0,
    backgroundVerification: true
  };

  console.log('🚀 INSTANT START - No verification delay!');
  
  // 🆕 IMMEDIATELY START WITH TEMPORARY DEVICES
  temporaryDevices = [];
  for (let i = 0; i < 100; i++) {
    temporaryDevices.push(generateDevice());
  }
  
  verifiedDevices = []; // Start with empty verified
  
  isRunning = true;
  
  // 🆕 START BOT IMMEDIATELY
  startBot();
  
  // 🆕 START BACKGROUND VERIFICATION
  startBackgroundVerification();

  res.json({ 
    success: true, 
    message: '🚀 BOT STARTED INSTANTLY! Background verification active',
    target: botStatus.targetViews,
    videoId: botStatus.aweme_id,
    initialDevices: temporaryDevices.length,
    status: 'RUNNING AT MAXIMUM SPEED'
  });
});

// 🆕 BACKGROUND VERIFICATION - Bot ko never roke
async function startBackgroundVerification() {
  if (backgroundVerificationActive) return;
  
  backgroundVerificationActive = true;
  console.log('🔄 BACKGROUND VERIFICATION STARTED...');
  
  let cycle = 0;
  
  while (isRunning) {
    cycle++;
    
    try {
      // Generate and verify new devices in background
      const newDevices = [];
      for (let i = 0; i < 20; i++) {
        newDevices.push(generateDevice());
      }
      
      const verificationPromises = newDevices.map(device => verifyDevice(device));
      const results = await Promise.all(verificationPromises);
      
      const newlyVerified = newDevices.filter((device, index) => results[index]);
      
      if (newlyVerified.length > 0) {
        verifiedDevices.push(...newlyVerified);
        // Remove duplicates based on device_id
        const uniqueDevices = [];
        const seen = new Set();
        for (const device of verifiedDevices) {
          if (!seen.has(device.device_id)) {
            seen.add(device.device_id);
            uniqueDevices.push(device);
          }
        }
        verifiedDevices = uniqueDevices;
        
        console.log(`✅ Background: ${newlyVerified.length} new devices verified | Total: ${verifiedDevices.length}`);
        
        // Remove some temporary devices as we get more verified
        if (verifiedDevices.length >= 10 && temporaryDevices.length > 50) {
          temporaryDevices = temporaryDevices.slice(0, 30);
        }
      }
      
      botStatus.verifiedDevices = verifiedDevices.length;
      botStatus.totalDevicesTested += newDevices.length;
      
    } catch (error) {
      console.log('⚠️ Background verification error:', error.message);
    }
    
    // Every 30 seconds check
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Also add some temporary devices periodically
    for (let i = 0; i < 10; i++) {
      temporaryDevices.push(generateDevice());
    }
  }
  
  backgroundVerificationActive = false;
  console.log('🛑 Background verification stopped');
}

// 🆕 SMART DEVICE SELECTOR - Verified priority, fallback to temporary
function getDevicesForBatch(batchSize = 15) {
  const devices = [];
  
  // First use verified devices
  const verifiedCount = Math.min(batchSize, verifiedDevices.length);
  for (let i = 0; i < verifiedCount; i++) {
    devices.push({
      device: verifiedDevices[Math.floor(Math.random() * verifiedDevices.length)],
      type: 'verified'
    });
  }
  
  // Fill remaining with temporary devices
  const remaining = batchSize - verifiedCount;
  for (let i = 0; i < remaining; i++) {
    if (temporaryDevices.length > 0) {
      devices.push({
        device: temporaryDevices[Math.floor(Math.random() * temporaryDevices.length)],
        type: 'temporary'
      });
    }
  }
  
  return devices;
}

// 🆕 HIGH SPEED VIEW SENDING
async function sendHighSpeedViews(aweme_id, batchSize = 15) {
  const devices = getDevicesForBatch(batchSize);
  
  if (devices.length === 0) {
    // Emergency fallback - generate on the spot
    for (let i = 0; i < 10; i++) {
      temporaryDevices.push(generateDevice());
    }
    return;
  }

  const promises = devices.map(({device, type}) => 
    sendViewWithDevice(aweme_id, device, type)
  );
  
  await Promise.all(promises);
}

async function sendViewWithDevice(aweme_id, device, type) {
  return new Promise((resolve) => {
    if (!isRunning) {
      resolve();
      return;
    }

    const params = `device_id=${device.device_id}&iid=${device.iid}&device_type=SM-G973N&app_name=musically_go&host_abi=armeabi-v7a&channel=googleplay&device_platform=android&version_code=160904&device_brand=samsung&os_version=9&aid=1340`;
    const payload = `item_id=${aweme_id}&play_delta=1`;
    
    const unix = Math.floor(Date.now() / 1000);
    const sig = generateGorgon(params, payload, null, unix);
    
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
          const jsonData = JSON.parse(data);
          if (jsonData && jsonData.log_pb && jsonData.log_pb.impr_id) {
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

// 🆕 NON-STOP BOT LOOP
async function startBot() {
  console.log('🔥 NON-STOP BOT STARTED!');
  console.log('🎯 Maximum speed - No verification delays');
  console.log(`📹 Target: ${botStatus.targetViews} views | Video: ${botStatus.aweme_id}`);

  let lastReqs = 0;
  let cycles = 0;

  const statsInterval = setInterval(() => {
    botStatus.rps = ((botStatus.reqs - lastReqs) / 2).toFixed(1);
    botStatus.rpm = (botStatus.rps * 60).toFixed(1);
    lastReqs = botStatus.reqs;
    
    const total = botStatus.reqs;
    const success = botStatus.success;
    botStatus.successRate = total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '0%';
    
    console.log(`📊 ${botStatus.success}/${botStatus.targetViews} | Success: ${botStatus.successRate} | RPS: ${botStatus.rps} | Devices: V:${verifiedDevices.length} T:${temporaryDevices.length}`);
    
    if (!isRunning) {
      clearInterval(statsInterval);
    }
  }, 2000);

  // 🆕 NON-STOP LOOP - Never waits for verification
  while (isRunning && botStatus.success < botStatus.targetViews) {
    cycles++;
    
    // Adaptive batch size based on available devices
    const totalDevices = verifiedDevices.length + temporaryDevices.length;
    const batchSize = Math.min(20, Math.max(5, Math.floor(totalDevices / 10)));
    
    await sendHighSpeedViews(botStatus.aweme_id, batchSize);
    
    // 🆕 MINIMAL DELAY - MAXIMUM SPEED
    const delay = verifiedDevices.length > 20 ? 50 : 100;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Occasionally add more temporary devices
    if (cycles % 10 === 0 && temporaryDevices.length < 100) {
      for (let i = 0; i < 5; i++) {
        temporaryDevices.push(generateDevice());
      }
    }
  }

  isRunning = false;
  botStatus.running = false;
  backgroundVerificationActive = false;
  clearInterval(statsInterval);
  
  console.log('🛑 Bot stopped');
  console.log(`📈 Final: ${botStatus.success} views | Verified: ${verifiedDevices.length} devices`);
}

function generateDevice() {
  function randomNumber(length) {
    return Array.from({length}, () => '0123456789'[Math.floor(Math.random() * 10)]).join('');
  }
  
  function randomHex(length) {
    return Array.from({length}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  }

  const device_id = randomNumber(19);
  const iid = randomNumber(19);  
  const cdid = crypto.randomUUID();
  const openudid = randomHex(16);

  return { device_id, iid, cdid, openudid };
}

function generateGorgon(params, data, cookies, unix) {
  function randomHex(length) {
    return Array.from({length}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  }

  return {
    'X-Gorgon': '0404' + randomHex(4) + '00' + randomHex(24),
    'X-Khronos': unix.toString()
  };
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NON-STOP TIKTOK BOT RUNNING ON PORT ${PORT}`);
  console.log(`🎯 INSTANT START + BACKGROUND VERIFICATION`);
  console.log(`🔥 MAXIMUM SPEED - NEVER STOPS FOR VERIFICATION`);
});
