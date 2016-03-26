#!/bin/env node
/**
 * Created by john on 08/12/15.
 */
var config      = require('./config'); // get our config file
var mongodb     = require('mongolab-provider').init('liveupload', config.api_settings);
var express     = require('express');
var bodyParser  = require('body-parser');
var app         = express();

app.set('superSecret', config.secret); 

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());


app.use(bodyParser.raw());

app.use(function(req, res, next) {

	res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, Accept, X-Auth-Token, x-key");

    res.setHeader('Content-Type', 'application/json');
    next();

});

var http = require('http').Server(app);

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 5000;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

var io = require('socket.io').listen(http);

io.sockets.on("connection", function(socket) {
    socket.on('something', function(data){
        console.log(data);
        io.sockets.emit('saludo', "hola");
    });
});

// Authentication
var jwt = require('jsonwebtoken');
var expiresInSession = 86400; // expires in 24 hours

var errorResponse = {
    status: "ERROR"
};
var authResponse = {
    status: "OK"
};

function authorized(req, res, next) {
    var header = req.headers;
    console.log('header.authorization:' + header['x-auth-token']);
     // check header or url parameters or post parameters for token
    var token = req.body.token || req.query.token || header['x-auth-token'];
    // decode token
    if (token) {
        jwt.verify(token, app.get('superSecret'), function(err, decoded) {
            if(err) {
                res.status(403);
                res.send(errorResponse);
            } else {
                req.decoded = decoded;
                next();
            }
        });
    } else {
        return res.status(403).send({ 
            success: false, 
            message: 'No token provided.' 
        });
        
    }
}

var Notifications = [
    {
        id:10,
        tacticId:12,
        created_at:1449617741005,
        status:1, // 0 no leido , 1 leido
        type:1, // 1 es verde
        message: "Message xx"
    },
    {
        id:11,
        tacticId:12,
        created_at:1449617744862,
        status:1, // 0 no leido , 1 leido
        type:0, // 1 es verde
        message: "Message xy"
    },
    {
        id:12,
        tacticId:12,
        created_at:1449617749655,
        status:0, // 0 no leido , 1 leido
        type:1, // 1 es verde
        message: "Message xz"
    }
];

app.get('/', function(req, res) {
    res.send("Hello John");
});

app.get('/notifications', authorized, function(req, res) {
    // res.send(Notifications);
    console.log('Executing: notifications');
    mongodb.documents('alerts', {sort: {"created_at":-1}}, function (err, data) {
        var result = null;
        if (err || data.length === 0) {
            result = errorResponse;
        } else {
            result = data;
        }
        console.log('notifications DONE');
        res.json(result);
    });
});

// Update notification's status
app.put('/notifications/:notificationId', authorized, function(req, res) {
    console.log('Executing PUT: notifications/notificationId:' + req.params.notificationId);
    var result = '';
    mongodb.findId('alerts', req.params.notificationId, function (err, data) {
        if (err || data.length == 0) {
            console.log('Notifications error findId:' + err);
            result = err;
            res.send(result);
        } else {
            console.log('Notifications alert:' + data);
            data.status = 1;
            mongodb.updateId('alerts', req.params.notificationId, data, function (err, data) {
                if (err || data.length == 0) {
                    console.log('Notifications error updateId:' + err);
                    result = err;
                } else {
                    result = data;
                }
                console.log('PUT: notifications DONE');
                res.send(result);
            }); // Update
        }
    }); // findId
}); // put

app.get('/add-notification', authorized, function(req, res) {
    var date = new Date(),
        noti = {
        id:date.getTime(),
        tacticId:13,
        created_at: date.getTime(),
        status:0, // 0 no leido , 1 leido
        type:1, // 1 es verde
        message: "new 10 Message xz"
    };

    Notifications.push(noti);
    io.sockets.emit('notification', JSON.stringify(noti));

});

/*
setInterval(function(){
var     date = new Date(),
        noti = {
            _id:{$oid:date.getTime()},
            tacticId:'56689eade4b044a02d7fc66c',
            created_at: date.getTime(),
            status:0, // 0 no leido , 1 leido
            type:1, // 1 es angular.versionde
            message: "Message " + Math.floor((Math.random() * 1000) + 1)
        };

    Notifications.push(noti);
    io.sockets.emit('notification', JSON.stringify(noti));

}, 30000);
*/

// Creates alert
function createAlert(tactic, tacticId) {
    var alert = {
        "tacticId": tacticId,
        "created_at": new Date(),
        "status": 0,
        "type": 1, // red:0, green: 1
        "message": "Test"
    };
    var tacticInfo = '' + tactic.tacticId + ' - ' + tactic.name.substr(0,10) + '...: ';
    var timeFactor = 1000 * 60 * 60 * 24;//1000 * 3600 * 24;
    var currentDate = new Date();
    var startDate = new Date(tactic.startDate);
    var endDate = new Date(tactic.endDate);
    var totalDays = Math.round(Math.abs(endDate.getTime() - startDate.getTime()) / (timeFactor));
    var currentDays = Math.round(Math.abs(currentDate.getTime() - startDate.getTime()) / (timeFactor));
    var goal = tactic.goal;
    var shortribs = tactic.shortribs;
    var expectedShortribs = Math.round((goal/totalDays)*currentDays); // (goal / totalDays) * currentDays
    var pacing = (shortribs/expectedShortribs)*100;// (shortribs / expectedShortribs) * 100
    console.log('createAlert: startDate:' + startDate + ', endDate:' + endDate);
    console.log('createAlert: totalDays: ' + totalDays + ', currentDays:' + currentDays + ', goal:', + goal + ', shortribs:' + shortribs + ', expectedShortribs:' + expectedShortribs + ', pacing:' + pacing);
    if (pacing < 76) {
        // red
        console.log('createAlert: RED alert');
        alert.type = 0;
        alert.message= tacticInfo + "Not as expected, let's take a look!";
    } else if (pacing > 90) {
        // green
        console.log('createAlert: GREEN alert');
        alert.type = 1;
        alert.message= tacticInfo + "You are doing great -> Well done!";
    } else {
        // yellow: nothing
        console.log('createAlert: No alert, pacing:' + pacing);
        alert = null;
    }
    console.log('createAlert.alert.result: ' + alert);
    return alert;
}


// Generate notifications: 
// curl --data "shortribs=108" http://127.0.0.1:5000/notifications/5668c278e4b0d637f20a5009
// curl --data "shortribs=100000" http://127.0.0.1:5000/notifications/5668c5b0e4b055b5130e9504
// curl --data "shortribs=150000" http://127.0.0.1:5000/notifications/5668c5b0e4b055b5130e9504
// curl --data "shortribs=170000" http://127.0.0.1:5000/notifications/5668c5b0e4b055b5130e9504
// curl --data "shortribs=200000" http://127.0.0.1:5000/notifications/5668c5b0e4b055b5130e9504
// curl --data "shortribs=300000" http://127.0.0.1:5000/notifications/5668c5b0e4b055b5130e9504
app.post('/notifications/:tacticId', function(req, res) {
    console.log('Executing POST: notifications:' + req.params.tacticId);
    var result = '';
    mongodb.findId('tactics', req.params.tacticId, function (err, data) {
        if (err || data.length == 0) {
            console.log('Tactic error findId:' + err);
            result = err;
            res.send(result);
        } else {
            // Update tactics
            var tactic = data;
            console.log('Tactic:' + tactic);
            tactic.shortribs = req.body.shortribs;
            console.log('shortribs:' + tactic.shortribs);
            mongodb.updateId('tactics', req.params.tacticId, tactic, function (err, data) {
               var result = null;
               if (err || data.length == 0) {
                    console.log('Tactic error updateId:' + err);
                   result = err;
               } else {
                   result = data;
               }

                // Insert alerts (notification)
                var alert = {
                    "tacticId": req.params.tacticId,
                    "created_at": new Date(),
                    "status": 0,
                    "type": 1,
                    "message": "Test Message2"
                };
                alert = createAlert(tactic, req.params.tacticId);
                if (alert == null) {
                    console.log('No alert');
                    res.send('No alert');
                } else {
                    console.log('Inserting alert');
                    mongodb.insert('alerts', alert, function (err, data) {
                        if (err) {
                            console.log('Alerts error insert:' + err);
                           result = err;
                       } else {
                            console.log('Alerts insert OK:' + data);
                           result = data;
                           console.log('notifications POST DONE');

                           // Push
                           io.sockets.emit('notification', JSON.stringify(data));
                           res.send(result);
                       }
                    });
                }
            });
        }
    });
});

app.get('/api', authorized, function(req, res) {
    mongodb.documents('user', {}, function (err, data) {
        console.log(err);
        console.log("data: " + data);
        res.send(data);
    });
});

// Verifying token
app.get('/check', authorized, function(req, res) {
    res.json(req.decoded);
});
app.get('/users/', authorized, function(req, res) {
    res.json({name: "name"});
});

// Auth
app.post('/users/login', function(req, res) {
    mongodb.documents('user', {where: {username: req.body.username, password: req.body.password}}, function (err, data) {
    var result = null;
    if (err || data.length == 0) {
        result = errorResponse;
    } else {
        var token = jwt.sign(data[0], app.get('superSecret'), {expiresIn: expiresInSession});
        authResponse.token = token;
        result = authResponse;
    }
    res.send(result);
  });
});

app.get('/campaigns/:userId', authorized, function(req, res) {

	mongodb.documents('campaigns', { where: {userid: req.params.userId}},function (err, data) {
    var result = null;

    if (err || data.length == 0) {
        result = err;
    } else {
        result = data;
    }
    res.send(result);
  });

});

app.get('/campaigns/:campaignId/tactics', authorized, function(req, res) {
	//mongodb.documents('tactics', {f:{"name":1}, where: {campaignid: req.body.campaignId}},function (err, data) {
	mongodb.documents('tactics', {where: {campaignid: req.body.campaignId}},function (err, data) {
    var result = null;

    if (err || data.length == 0) {
        result = err;
    } else {
        result = data;
    }
    res.send(result);
  });

});

// Get a tactic
app.get('/tactic/:tacticId', authorized, function(req, res) {
    /*
    var result = {
        id:"11",
        name:"Ad 11",
        orgName:"Starcom-Bank of America-Platform",
        campaignName: "Campaign 1",
        status:"LIVE",
        startDate:1429612105921,
        endDate:1479612105921,
        pacing:"0.1",
        impressions:"10",
        goal:"10000",
        spend:"2000.00"
       };

    res.send(result);
    */
    console.log('Executing GET: tactics/tacticId:' + req.params.tacticId);
    var result = '';
    mongodb.findId('tactics', req.params.tacticId, function (err, data) {
        if (err || data.length == 0) {
            console.log('Tactic error findId:' + err);
            result = err;
            res.send(result);
        } else {
            result = data;
            console.log('Tactic DONE');
            res.send(result);
        }
    });
});

app.get('/campaigns/:campaignId/tactics/:tacticId', authorized, function(req, res) {
	mongodb.documents('tactics', {where: { "_id": {"$oid":""+req.params.tacticId} }}, function (err, data) {
    var result = null;
    if (err || data.length == 0) {
        result = err;
    } else {
        result = data;
    }
    res.send(result);
  });
});

app.put('/campaigns/:campaignId/tactics/:tacticId', authorized, function(req, res) {
    console.log(req.body.tactic);

    //update('tactics', {where: { f:{"name":1},"_id": {"$oid":""+req.params.tacticId} }}, params, function (err, data) {
    mongodb.updateId('tactics', req.params.tacticId, req.body.tactic, function (err, data) {
       var result = null;
       if (err || data.length === 0) {
           result = err;
       } else {
           result = data;
       }
       res.send(result);
     });
});

// Alerts
app.get('/api/alerts/',  authorized, function(req, res) {
    console.log('Executing: alters');
    mongodb.documents('alerts', {}, function (err, data) {
        var result = null;
        if (err || data.length == 0) {
            result = errorResponse;
        } else {
            result = data;
        }
        console.log('alters DONE');
        res.send(result);
    });
});

http.listen(server_port, server_ip_address);
console.log("Server startet on 127.0.0.1 port 5000");