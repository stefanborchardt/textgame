/* global location, WebSocket */
var host = location.origin.replace(/^https/, 'wss')
var ws = new WebSocket(host);

ws.onerror = (error) => console.log(error);
ws.onopen = () => console.log('secure WebSocket connection established');
ws.onclose = () => console.log('WebSocket connection closed');

var textbox = $('input')
var button = $('button')

ws.onmessage = function(msg) {
  var response = msg.data;
  console.log(response);
}

var form = $('form');
form.onsubmit = function() {
  ws.send("gsdg");
  return false;
}

