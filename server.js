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
        itemId:12,
        created_at:1449617741005,
        status:1, // 0 no leido , 1 leido
        type:1, // 1 es verde
        message: "Message xx"
    },
    {
        id:11,
        itemId:12,
        created_at:1449617744862,
        status:1, // 0 no leido , 1 leido
        type:0, // 1 es verde
        message: "Message xy"
    },
    {
        id:12,
        itemId:12,
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
    mongodb.documents('alerts', {sort: {"created_at":-1}}, function (err, data) {
        var result = null;
        if (err || data.length === 0) {
            result = errorResponse;
        } else {
            result = data;
        }
        res.json(result);
    });
});

// Update notification's status
app.put('/notifications/:notificationId', authorized, function(req, res) {
    console.log('Executing PUT: notifications/notificationId:' + req.params.notificationId);
    var result = '';

    mongodb.findId('alerts', req.params.notificationId, function (err, data) {
        if (err || data.length == 0) {
            result = err;
            res.send(result);
        } else {
            data.status = 1;
            mongodb.updateId('alerts', req.params.notificationId, data, function (err, data) {
                if (err || data.length == 0) {
                    result = err;
                } else {
                    result = data;
                }
                res.send(result);
            }); // Update
        }
    }); // findId
}); // put

app.get('/add-notification', authorized, function(req, res) {
    var date = new Date(),
        noti = {
        id: date.getTime(),
        itemId: 13,
        created_at: date.getTime(),
        status: 0, // 0 no leido , 1 leido
        type: 1, // 1 es verde
        message: "new 10 Message xz"
    };

    Notifications.push(noti);
    io.sockets.emit('notification', JSON.stringify(noti));

});

app.get('/api', authorized, function(req, res) {
    mongodb.documents('user', {}, function (err, data) {
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

app.get('/lists/:userId', authorized, function(req, res) {
	mongodb.documents('lists', { where: {userid: req.params.userId}},function (err, data) {
    var result = null;

    if (err || data.length == 0) {
        result = err;
    } else {
        result = data;
    }
    res.send(result);
  });

});

app.get('/lists/:listId/items', authorized, function(req, res) {
	//mongodb.documents('items', {f:{"name":1}, where: {listId: req.body.listId}},function (err, data) {
	mongodb.documents('items', {where: {listId: req.body.listId}},function (err, data) {
    var result = null;

    if (err || data.length == 0) {
        result = err;
    } else {
        result = data;
    }
    res.send(result);
  });

});

// Get a item
app.get('/item/:itemId', authorized, function(req, res) {
    var result = '';

    mongodb.findId('items', req.params.itemId, function (err, data) {
        if (err || data.length == 0) {
            result = err;
            res.send(result);
        } else {
            result = data;
            res.send(result);
        }
    });
});

app.get('/lists/:listId/items/:itemId', authorized, function(req, res) {
	mongodb.documents('items', {where: { "_id": {"$oid":""+req.params.itemId} }}, function (err, data) {
    var result = null;

    if (err || data.length == 0) {
        result = err;
    } else {
        result = data;
    }
    res.send(result);
  });
});

app.put('/lists/:listId/items/:itemId', authorized, function(req, res) {
    //update('items', {where: { f:{"name":1},"_id": {"$oid":""+req.params.itemId} }}, params, function (err, data) {
    mongodb.updateId('items', req.params.itemId, req.body.item, function (err, data) {
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
    mongodb.documents('alerts', {}, function (err, data) {
        var result = null;

        if (err || data.length == 0) {
            result = errorResponse;
        } else {
            result = data;
        }
        res.send(result);
    });
});

http.listen(server_port, server_ip_address);
console.log("Server startet on 127.0.0.1 port 5000");