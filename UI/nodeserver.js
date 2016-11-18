var fs = require("fs");
var config = JSON.parse(fs.readFileSync('../config.json', 'utf8'));
var serverIp = config.serverip;
var serverPort = config.serverport;
var gearmanip = config.gearmanip;
var gearmanport = config.gearmanport;
var gearmanworker_apiai = config.gearmanworker_apiai;
var http = require("http"),
send = require('send'),
url = require('url'),
_ = require('underscore');

var Gearman = require("node-gearman");
var gearman_client = new Gearman(gearmanip, gearmanport);
//App core
var app = http.createServer(function(req, res) {
    
    //Http Error Handler
    function error(err) {
        res.statusCode = err.status || 500;
        res.setHeader('Content-Type', 'text/html');
        res.end("<span style='font: 15px Tahoma; color: red'>Error: </span><span'>Page not Found! <br>Click <a href='http://"+serverIp+":"+serverPort+"''>here</a> to go to Home Page...</span></span>");
    }

    //Http Redirect Handler
    function redirect() {
        res.statusCode = 301;
        res.setHeader('Location', req.url + '/');
        res.end('Redirecting to ' + req.url + '/');
    }

    //Http Root
    function setRoot(){ 
        res.setHeader("Access-Control-Allow-Origin", "*");
        return './';
    }

    //Http Set Index
    function setIndex(){
        res.setHeader("Access-Control-Allow-Origin", "*");
        return './index.html';
    }

    var path = url.parse(req.url).pathname;
    if( path == "/get_data") {
	if (req.method == 'POST') {
	    req.on('data', function(data) {
            data = data.toString();
            //console.log(data);
            js = JSON.parse(data);
            sendToId = js.sendToId;
            res.writeHead(200, {"Content-Type": "application/json"});
            redisClient.select(2, function(){
                redisClient.get(sendToId, function(errGet, replyGet) {
                    trackId_info = "";
                    if (replyGet !== null) {
                        replyGet = JSON.parse(replyGet);
                        replyGet = replyGet.trackId_info;
                        trackId_info = replyGet;
                    }
                    var result = {};
                    result.response = trackId_info;
                    jsonRes = JSON.stringify(result);
                    res.end(jsonRes);
                });
            });
	    });
	}
    } else {
	//Http Return Pipe
	send(req, url.parse(req.url).pathname, {root: setRoot(), index: setIndex()})
	    .on('error', error)
	    .on('directory', redirect)
	    .pipe(res);
    }

}).listen(serverPort);

//stats variable
var stats = {status: false, nlpbot: 0, bot: 0};
var iIds = {allId: [], nlpbotId: [], botId: []};

var updateStats = function(username, connect_count, socket_id) {
    if (username == "nlpbot") {
        if (connect_count == 1) {
            iIds.nlpbotId.push(socket_id);
            iIds.allId.push(socket_id);
            stats.nlpbot = stats.nlpbot + 1;
        } else {
            stats.nlpbot = stats.nlpbot - 1;
            var index_SC = iIds.nlpbotId.indexOf(socket_id);
            iIds.nlpbotId.splice(index_SC, 1);
            var index_AC = iIds.allId.indexOf(socket_id);
            iIds.allId.splice(index_AC, 1);
        }
    } else if(username == "bot") {
        if (connect_count == 1) {
            stats.bot = stats.bot + 1;
            iIds.botId.push(socket_id);
            iIds.allId.push(socket_id);
        } else {
            stats.bot = stats.bot - 1;
            var index_SL = iIds.botId.indexOf(socket_id);
            iIds.botId.splice(index_SL, 1);
            var index_AL = iIds.allId.indexOf(socket_id);
            iIds.allId.splice(index_AL, 1);
        }
    } 
   
    if (stats.nlpbot >= 1 /*&& stats.bot >= 1*/ ) {
        stats.status = true;
    } else {
        stats.status = false;
    }
   

    console.log("===== --- ===== --- UPDATE ===== --- ===== --- =====");
    console.log("nlpbot : " + stats.nlpbot + " B : " + stats.bot + " S : " + stats.status + ", U : " + username);
    console.log("===== --- ===== ---        ===== --- ===== --- =====\n");
};

var checkAuthToken = function(token, callback){
    authenticate_this = false;
    if (token == "nlpbot") {
        authenticate_this = true;
    }
    if (token == "bot") {
        authenticate_this = true;
    }
    return callback(null, authenticate_this);
};

function getSocketID(data){
    var new_string = '';
    var flag = false;
    for(var i in data){
        if(data[i] == '_' && !flag){
            flag = true;
            continue;
        }
        if(flag){
            new_string = new_string + data[i];
        }
    }
    return new_string;
}

//Socket Handler
io = require('socket.io').listen(app).sockets.on('connection', function (socket) {
    socket.auth = false;
    //check the auth data sent by the client
    socket.on('authenticate', function(data){
        checkAuthToken(data.token, function(err, success){
            if (!err && success){
                console.log("Authenticated socket ", socket.id);
                socket.auth = true;
                _.each(io.nsps, function(nsp) {
                    if(_.findWhere(nsp.sockets, {id: socket.id})) {
                        console.log("restoring socket to", nsp.name);
                        nsp.connected[socket.id] = socket;
                    }
                });
                console.log("----------" + data.token);
                updateStats(data.token, 1, socket.id);
                io.to(socket.id).emit('ur_id', {"connected": data.token, "stats": stats, "conId": socket.id, nlpbotId: iIds.nlpbotId});
                socket.broadcast.emit('cli_connected', {"connected": data.token, "stats": stats, "conId": socket.id, nlpbotId: iIds.nlpbotId});
            }
        });
        console.log("authenticate - " , socket.id);
        var timestamp = "6:59:30"
        var job_first_msg = gearman_client.submitJob("initial_msg_worker", timestamp);
        job_first_msg.on("data", function(data){
            var jsonContent = JSON.parse(data);
            console.log("==========",jsonContent)
            //var initial_bot_msg = data
            io.to(socket.id).emit('initial_msg', jsonContent);
            });
        job_first_msg.on("end", function(){
            console.log("Job completed!");
            });
        job_first_msg.on("error", function(error){
            console.log(error.message);
            });
    });

   
    //Disconnect Event
    socket.on('disconnect', function() {
        console.log("Disconnect - " , socket.id);
        disconnectType = "";
        
        console.log("iIds.allId - " ,  iIds.allId);
        console.log("iIds.nlpbot. - " ,  iIds.nlpbotId);
        indAid = iIds.allId.indexOf(socket.id);
        indSAid = iIds.nlpbotId.indexOf(socket.id);
        indBid = iIds.botId.indexOf(socket.id);

        if (indSAid != -1) {
            disconnectType = "nlpbot";
        } else if (indBid != -1) {
            disconnectType = "bot";
        } 
        if (disconnectType !== "") {
            console.log("disconnect Type " + disconnectType);
            updateStats(disconnectType, -1, socket.id);
            socket.broadcast.emit('disc_count', {"stats": stats, "disconId": socket.id, "disconnectType": disconnectType});
        }
    });

    //Message Event
    socket.on('message', function(data){
        console.log("in Message Event")
        var cust_info = { 'FirstName':'', 'LastName':'' };
        var query_obj = { 'customer_info':cust_info, 'query':data.query, 'v':'20150910', 'confidence':0.8, 'uId':socket.id, 'lang':'en', 'channel':'ui'};
        dataToSend = JSON.stringify(query_obj);
        var job = gearman_client.submitJob(gearmanworker_apiai, dataToSend);
        job.on("data", function(data){
            console.log("in gearman Event")
            var jsonContent = JSON.parse(data);
            var socket_id = getSocketID(jsonContent.sessionId);
            job.on("end", function(){
                io.to(socket_id).emit('resp_message', jsonContent);
                console.log("Job completed!");
            });
            job.on("error", function(error){
               console.log(error.message);
            });
         });
        
    });
    
});