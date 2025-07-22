const webpush = require('web-push');

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n===== VAPID KEYS =====');
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);

console.log('\n===== COPY THESE LINES TO YOUR .env FILE =====');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_MAILTO=example@yourdomain.com`);
console.log('\nThese keys are required for Web Push Notifications to work properly.\n'); 