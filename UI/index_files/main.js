var serverIp = '';
var serverPort = '';

$.getJSON("configip.json", function(config) {
    serverIp = config.serverip;
    serverPort = config.serverport;
});

var serverUrl = "http://" + serverIp + ":" + serverPort;
var socket = io.connect(serverUrl);
var username = 'nlpbot';
var stats = {status: false, nlpbot: 0, bot: 0};
var myId = '';

function urlify(text) {
    var urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function(url) {
        return '<a href="' + url + '" target="_blank">' + url + '</a>';
    });

}
var new_chatID = 0;
function getNewText(text,flag){
    count = 0;
    var new_text = '';
    for(var i in text){
        if(count < 20000000){
            new_text += text[i];
            count += 1;
        }        
    }
    new_chatID += 1;
    return new_text + '<a id="'+ new_chatID + 'read_more">...more</a>';
}

function addMsg(msgText, owner) {
    var time_stamp = new Date().toLocaleTimeString();
    var msgHtml = '';
    if (owner == 'admin-chat') {
        msgHtml = '<div class="admin-chat"><div class="well inner-admin-chat">' + msgText + '<span class="admin-name">me</span><span class="time-stamp">' + time_stamp + '</span></div></div>';
    }
    else{
        msgText = urlify(msgText);
        length_of_text = msgText.length;
        if(length_of_text > 140){
            var new_text1 = getNewText(msgText);           
            msgHtml = '<div id="'+ new_chatID +'less_chat" class="user-chat"><div class="well inner-user-chat">' + new_text1 + '<span class="user-name">Bot</span><span class="time-stamp">' + time_stamp + '</span></div></div>';
            $(document).on('click',"#"+ new_chatID + "read_more", function(e){
                e.preventDefault();
                console.log("read_more..!!");
                $("#"+ new_chatID +"less_chat").hide();
                msgHtml = '<div class="user-chat"><div class="well inner-user-chat">' + msgText + '<span class="user-name">Bot</span><span class="time-stamp">' + time_stamp + '</span></div></div>';
                $("#msgbox").append(msgHtml);
            });
        }else{
            msgHtml = '<div class="user-chat"><div class="well inner-user-chat">' + msgText + '<span class="user-name">Bot</span><span class="time-stamp">' + time_stamp + '</span></div></div>';
        }        
    }
    $("#msgbox").append(msgHtml);
    var scrollDiv = $('#msgbox');
    scrollDiv.scrollTop(scrollDiv.prop("scrollHeight"));
}



function changeStats(stats) {
    var status = stats.status;
    if (status == true) {
        $('.com-status').removeClass('red');
        $('.com-status').addClass('green');
    } else {
        $('.com-status').removeClass('green');
        $('.com-status').addClass('red');
    }
}


socket.on('connect', function(){
    socket.emit('authenticate', {token: username});
});

socket.on('initial_msg', function(initial_msg){
    addMsg(initial_msg, "user-chat");
    });

socket.on('resp_message', function(data) {
    var msg = data.result;
    var lidSelected = $("#msgbox").attr("learner");
    if (lidSelected == data.lid) {
        var msgHtml = '<div class="row typing" style="float:right; clear:both; padding-right:20px;"><img src="image/typing.gif"></div>';
        $("#msgbox").append(msgHtml);
        var scrollDiv = $('#msgbox');
        scrollDiv.scrollTop(scrollDiv.prop("scrollHeight"));
        setTimeout(function(){
            $(".typing").remove();
            addMsg(msg, 'user-chat');
        }, 1000);
    }
});


socket.on('disc_count', function(data) { //connected event
    stats = data.stats;
    changeStats(stats);
});


socket.on('cli_connected', function(data) { //connected event
    stats = data.stats;
    changeStats(stats);
});

socket.on('ur_id', function(data) { //connected event
    stats = data.stats;
    changeStats(stats);
    myId = data.conId;
    var dataTosSend = {'query': 'hi' };
    socket.emit('message', dataTosSend);
});

function addMessage(data) { //connected event
    var lidSelected = $("#msgbox").attr("learner");
    if (lidSelected == data.lid) {
        addMsg(data.query, 'admin-chat');
    }
}

$( document ).ready(function() {
    function sendChat() {
        var chatMsg = $("#input_text").val();
        console.log(chatMsg);
        if (stats.status === true) {
            if (chatMsg.trim() !== '') {
                var dataTosSend = {'query': chatMsg };
                socket.emit('message', dataTosSend);
                addMessage(dataTosSend);
                $("#input_text").val('');
            }
        } else {
            Materialize.toast('Communication status is offline!!!', 3000, 'rounded red');
        }
    }

   
    $('#input_text').keypress(function(event) {
        var keycode = event.keyCode || event.which;
        if(keycode == '13') {
            sendChat();
        }
    });
    $('.send-button').click(function() {
        sendChat();
    });

});