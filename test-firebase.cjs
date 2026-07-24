const admin = require('firebase-admin');
admin.initializeApp({
  databaseURL: 'https://guardianmdm-724c7-default-rtdb.asia-southeast1.firebasedatabase.app'
});
const db = admin.database();
db.ref('devices').once('value', (snapshot) => {
  console.log(JSON.stringify(snapshot.val(), null, 2));
  process.exit(0);
});
