const http = require('http');

async function test() {
  try {
    const res = await fetch("http://localhost:5000/api/rooms");
    const text = await res.text();
    console.log("RESPONSE:", text);
  } catch (e) {
    console.log("ERROR:", e.message);
  }
}
test();
