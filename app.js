// node variables
//npm install express and node in order to use node app.js command and run on local server
var express = require('express'); 
var app = express(); 
var server = require('http').createServer(app); 
var io = require('socket.io').listen(server);
var port = process.env.PORT || 3000; 

server.listen(port);
app.use(express.static(__dirname + '/public'));